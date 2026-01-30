/**
 * Multiplayer Module
 * Memory Card Game - Firebase Realtime Database
 */

import {
    auth,
    db,
    signInAnonymously,
    onAuthStateChanged,
    ref,
    set,
    get,
    update,
    remove,
    onValue,
    onDisconnect,
    serverTimestamp
} from './firebase-config.js';

// ========================================
// Multiplayer State
// ========================================
let multiplayerState = {
    roomCode: null,
    isHost: false,
    playerId: null,
    opponentId: null,
    roomRef: null,
    listeners: [],
    gameTimer: null,
    timeRemaining: 600 // 10 minutes in seconds
};

// ========================================
// Authentication
// ========================================
async function initAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                multiplayerState.playerId = user.uid;
                resolve(user);
            } else {
                try {
                    const result = await signInAnonymously(auth);
                    multiplayerState.playerId = result.user.uid;
                    resolve(result.user);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}

// ========================================
// Room Management
// ========================================

/**
 * Generate a random 5-digit room code
 */
function generateRoomCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

/**
 * Create a new room as host
 */
async function createRoom() {
    await initAuth();

    let roomCode = generateRoomCode();
    let roomExists = true;

    // Make sure room code is unique
    while (roomExists) {
        const snapshot = await get(ref(db, `rooms/${roomCode}`));
        if (!snapshot.exists()) {
            roomExists = false;
        } else {
            roomCode = generateRoomCode();
        }
    }

    const roomData = {
        host: {
            id: multiplayerState.playerId,
            ready: true
        },
        guest: null,
        boardSize: 4,
        cards: [],
        gameState: 'waiting',
        hostScore: 0,
        guestScore: 0,
        currentTurn: 'host',
        flippedCards: [],
        timeRemaining: 600,
        createdAt: serverTimestamp()
    };

    await set(ref(db, `rooms/${roomCode}`), roomData);

    multiplayerState.roomCode = roomCode;
    multiplayerState.isHost = true;
    multiplayerState.roomRef = ref(db, `rooms/${roomCode}`);

    // Clean up room on disconnect
    onDisconnect(ref(db, `rooms/${roomCode}`)).remove();

    return roomCode;
}

/**
 * Join an existing room as guest
 */
async function joinRoom(roomCode) {
    await initAuth();

    const roomSnapshot = await get(ref(db, `rooms/${roomCode}`));

    if (!roomSnapshot.exists()) {
        throw new Error('Oda bulunamadı');
    }

    const roomData = roomSnapshot.val();

    if (roomData.guest) {
        throw new Error('Oda dolu');
    }

    if (roomData.gameState !== 'waiting') {
        throw new Error('Oyun başlamış');
    }

    await update(ref(db, `rooms/${roomCode}`), {
        guest: {
            id: multiplayerState.playerId,
            ready: false
        }
    });

    multiplayerState.roomCode = roomCode;
    multiplayerState.isHost = false;
    multiplayerState.roomRef = ref(db, `rooms/${roomCode}`);
    multiplayerState.opponentId = roomData.host.id;

    // Remove guest on disconnect
    onDisconnect(ref(db, `rooms/${roomCode}/guest`)).remove();

    return roomData;
}

/**
 * Leave current room
 */
async function leaveRoom() {
    if (!multiplayerState.roomCode) return;

    // Remove all listeners
    multiplayerState.listeners.forEach(unsubscribe => unsubscribe());
    multiplayerState.listeners = [];

    // Stop timer
    if (multiplayerState.gameTimer) {
        clearInterval(multiplayerState.gameTimer);
        multiplayerState.gameTimer = null;
    }

    if (multiplayerState.isHost) {
        // Host leaves = delete room
        await remove(ref(db, `rooms/${multiplayerState.roomCode}`));
    } else {
        // Guest leaves = remove guest
        await remove(ref(db, `rooms/${multiplayerState.roomCode}/guest`));
    }

    // Reset state
    multiplayerState.roomCode = null;
    multiplayerState.isHost = false;
    multiplayerState.roomRef = null;
    multiplayerState.opponentId = null;
    multiplayerState.timeRemaining = 600;
}

// ========================================
// Waiting Room
// ========================================

/**
 * Set board size (host only)
 */
async function setBoardSize(size) {
    if (!multiplayerState.isHost || !multiplayerState.roomCode) return;

    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        boardSize: size
    });
}

/**
 * Set ready status (guest only)
 */
async function setGuestReady(ready) {
    if (multiplayerState.isHost || !multiplayerState.roomCode) return;

    await update(ref(db, `rooms/${multiplayerState.roomCode}/guest`), {
        ready: ready
    });
}

/**
 * Start game (host only, when guest is ready)
 */
async function startMultiplayerGame(cards) {
    if (!multiplayerState.isHost || !multiplayerState.roomCode) return;

    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        cards: cards,
        gameState: 'playing',
        hostScore: 0,
        guestScore: 0,
        currentTurn: 'host',
        flippedCards: [],
        timeRemaining: 600
    });
}

// ========================================
// Game Actions
// ========================================

/**
 * Flip a card
 */
async function flipCard(cardIndex) {
    if (!multiplayerState.roomCode) return;

    const roomSnapshot = await get(ref(db, `rooms/${multiplayerState.roomCode}`));
    const roomData = roomSnapshot.val();

    // Check if it's player's turn
    const isMyTurn = (multiplayerState.isHost && roomData.currentTurn === 'host') ||
        (!multiplayerState.isHost && roomData.currentTurn === 'guest');

    if (!isMyTurn) return;

    const flippedCards = roomData.flippedCards || [];

    if (flippedCards.length >= 2) return;
    if (flippedCards.includes(cardIndex)) return;

    flippedCards.push(cardIndex);

    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        flippedCards: flippedCards
    });

    // Check for match when 2 cards flipped
    if (flippedCards.length === 2) {
        setTimeout(() => checkMultiplayerMatch(roomData, flippedCards), 1000);
    }
}

/**
 * Check if flipped cards match
 */
async function checkMultiplayerMatch(roomData, flippedCards) {
    const [idx1, idx2] = flippedCards;
    const card1 = roomData.cards[idx1];
    const card2 = roomData.cards[idx2];

    const isMatch = card1.pairId === card2.pairId;
    const currentPlayer = roomData.currentTurn;

    const updates = {
        flippedCards: []
    };

    if (isMatch) {
        // Update score
        const newHostScore = currentPlayer === 'host' ? roomData.hostScore + 1 : roomData.hostScore;
        const newGuestScore = currentPlayer === 'guest' ? roomData.guestScore + 1 : roomData.guestScore;

        updates.hostScore = newHostScore;
        updates.guestScore = newGuestScore;

        // Mark cards as matched
        const updatedCards = [...roomData.cards];
        updatedCards[idx1] = { ...updatedCards[idx1], matched: true, matchedBy: currentPlayer };
        updatedCards[idx2] = { ...updatedCards[idx2], matched: true, matchedBy: currentPlayer };
        updates.cards = updatedCards;

        // Check if all cards are matched
        const totalPairs = updatedCards.length / 2;
        const matchedPairs = newHostScore + newGuestScore;

        if (matchedPairs >= totalPairs) {
            // All cards matched - determine winner
            let winner = 'tie';
            if (newHostScore > newGuestScore) winner = 'host';
            else if (newGuestScore > newHostScore) winner = 'guest';

            updates.gameState = 'ended';
            updates.winner = winner;

            // Stop the timer
            if (multiplayerState.gameTimer) {
                clearInterval(multiplayerState.gameTimer);
                multiplayerState.gameTimer = null;
            }
        }
        // Same player continues (if game not ended)
    } else {
        // Switch turn
        updates.currentTurn = currentPlayer === 'host' ? 'guest' : 'host';
    }

    await update(ref(db, `rooms/${multiplayerState.roomCode}`), updates);
}

/**
 * End game (time up or all cards matched)
 */
async function endMultiplayerGame(winner) {
    if (!multiplayerState.roomCode) return;

    if (multiplayerState.gameTimer) {
        clearInterval(multiplayerState.gameTimer);
        multiplayerState.gameTimer = null;
    }

    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        gameState: 'ended',
        winner: winner,
        hostConfirmPlayAgain: false,
        guestConfirmPlayAgain: false,
        hostConfirmReturn: false,
        guestConfirmReturn: false
    });
}

/**
 * Set play again confirmation
 */
async function setPlayAgainConfirm(confirmed) {
    if (!multiplayerState.roomCode) return;

    const field = multiplayerState.isHost ? 'hostConfirmPlayAgain' : 'guestConfirmPlayAgain';
    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        [field]: confirmed
    });
}

/**
 * Set return to room confirmation
 */
async function setReturnRoomConfirm(confirmed) {
    if (!multiplayerState.roomCode) return;

    const field = multiplayerState.isHost ? 'hostConfirmReturn' : 'guestConfirmReturn';
    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        [field]: confirmed
    });
}

/**
 * Reset game (play again) - called when both confirm
 */
async function resetMultiplayerGame(cards) {
    if (!multiplayerState.isHost || !multiplayerState.roomCode) return;

    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        cards: cards,
        gameState: 'playing',
        hostScore: 0,
        guestScore: 0,
        currentTurn: 'host',
        flippedCards: [],
        timeRemaining: 600,
        winner: null,
        hostConfirmPlayAgain: false,
        guestConfirmPlayAgain: false,
        hostConfirmReturn: false,
        guestConfirmReturn: false
    });
}

/**
 * Return to waiting room - called when both confirm
 */
async function returnToWaitingRoom() {
    if (!multiplayerState.roomCode) return;

    if (multiplayerState.gameTimer) {
        clearInterval(multiplayerState.gameTimer);
        multiplayerState.gameTimer = null;
    }

    await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
        gameState: 'waiting',
        cards: [],
        hostScore: 0,
        guestScore: 0,
        flippedCards: [],
        timeRemaining: 600,
        winner: null,
        'guest/ready': false,
        hostConfirmPlayAgain: false,
        guestConfirmPlayAgain: false,
        hostConfirmReturn: false,
        guestConfirmReturn: false
    });
}

// ========================================
// Real-time Listeners
// ========================================

/**
 * Listen to room changes
 */
function listenToRoom(callback) {
    if (!multiplayerState.roomCode) return;

    const unsubscribe = onValue(ref(db, `rooms/${multiplayerState.roomCode}`), (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            // Room was deleted (host left)
            callback(null);
        }
    });

    multiplayerState.listeners.push(unsubscribe);
    return unsubscribe;
}

/**
 * Start game timer (host manages timer)
 */
function startGameTimer(onTick, onEnd) {
    if (!multiplayerState.isHost) return;

    multiplayerState.timeRemaining = 600;

    multiplayerState.gameTimer = setInterval(async () => {
        multiplayerState.timeRemaining--;

        // Sync timer to database every second
        await update(ref(db, `rooms/${multiplayerState.roomCode}`), {
            timeRemaining: multiplayerState.timeRemaining
        });

        onTick(multiplayerState.timeRemaining);

        if (multiplayerState.timeRemaining <= 0) {
            clearInterval(multiplayerState.gameTimer);
            multiplayerState.gameTimer = null;
            onEnd();
        }
    }, 1000);
}

// ========================================
// Exports
// ========================================
export {
    multiplayerState,
    initAuth,
    createRoom,
    joinRoom,
    leaveRoom,
    setBoardSize,
    setGuestReady,
    startMultiplayerGame,
    flipCard,
    endMultiplayerGame,
    setPlayAgainConfirm,
    setReturnRoomConfirm,
    resetMultiplayerGame,
    returnToWaitingRoom,
    listenToRoom,
    startGameTimer
};
