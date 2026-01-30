/**
 * Memory Card Game
 * Solo & Multiplayer
 */

import {
    multiplayerState,
    initAuth,
    createRoom,
    joinRoom,
    leaveRoom,
    setBoardSize,
    setGuestReady,
    startMultiplayerGame,
    flipCard as mpFlipCard,
    endMultiplayerGame,
    setPlayAgainConfirm,
    setReturnRoomConfirm,
    resetMultiplayerGame,
    returnToWaitingRoom,
    listenToRoom,
    startGameTimer
} from './multiplayer.js';

// ========================================
// Game Configuration
// ========================================
const EMOJIS = [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
    '🦄', '🐝', '🦋', '🐢', '🐙', '🦀', '🐬', '🦈',
    '🌸', '🌺', '🌻', '🌹', '🍎', '🍊', '🍋', '🍇'
];

// ========================================
// Game State
// ========================================
let gameState = {
    mode: 'solo', // 'solo' or 'multiplayer'
    boardSize: 4,
    cards: [],
    flippedCards: [],
    matchedPairs: 0,
    totalPairs: 0,
    moves: 0,
    timer: 0,
    timerInterval: null,
    isLocked: false
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    // Screens
    startScreen: document.getElementById('start-screen'),
    soloScreen: document.getElementById('solo-screen'),
    lobbyScreen: document.getElementById('lobby-screen'),
    waitingRoomScreen: document.getElementById('waiting-room-screen'),
    gameScreen: document.getElementById('game-screen'),

    // Game elements
    gameBoard: document.getElementById('game-board'),

    // Modals
    winModal: document.getElementById('win-modal'),
    mpEndModal: document.getElementById('mp-end-modal'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),

    // Solo stats
    timerDisplay: document.getElementById('timer'),
    movesDisplay: document.getElementById('moves'),
    matchesDisplay: document.getElementById('matches'),
    finalTime: document.getElementById('final-time'),
    finalMoves: document.getElementById('final-moves'),

    // Solo/MP headers & footers
    soloHeader: document.getElementById('solo-header'),
    mpHeader: document.getElementById('mp-header'),
    soloFooter: document.getElementById('solo-footer'),
    mpFooter: document.getElementById('mp-footer'),

    // MP stats
    mpYourScore: document.getElementById('mp-your-score'),
    mpOpponentScore: document.getElementById('mp-opponent-score'),
    mpTimer: document.getElementById('mp-timer'),
    turnIndicator: document.getElementById('turn-indicator'),

    // MP end modal
    mpResultIcon: document.getElementById('mp-result-icon'),
    mpResultTitle: document.getElementById('mp-result-title'),
    mpResultSubtitle: document.getElementById('mp-result-subtitle'),
    mpFinalYourScore: document.getElementById('mp-final-your-score'),
    mpFinalOpponentScore: document.getElementById('mp-final-opponent-score'),
    mpYourConfirm: document.getElementById('mp-your-confirm'),
    mpOpponentConfirm: document.getElementById('mp-opponent-confirm'),
    mpConfirmHint: document.getElementById('mp-confirm-hint'),

    // Main menu buttons
    soloBtn: document.getElementById('solo-btn'),
    multiplayerBtn: document.getElementById('multiplayer-btn'),

    // Solo screen
    backToMenu: document.getElementById('back-to-menu'),
    sizeButtons: document.querySelectorAll('.size-btn'),

    // Lobby screen
    backToMenu2: document.getElementById('back-to-menu-2'),
    createRoomBtn: document.getElementById('create-room-btn'),
    roomCodeInput: document.getElementById('room-code-input'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    lobbyError: document.getElementById('lobby-error'),

    // Waiting room
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    displayRoomCode: document.getElementById('display-room-code'),
    copyCodeBtn: document.getElementById('copy-code-btn'),
    guestCard: document.getElementById('guest-card'),
    hostControls: document.getElementById('host-controls'),
    guestControls: document.getElementById('guest-controls'),
    toggleBtns: document.querySelectorAll('.toggle-btn'),
    startGameBtn: document.getElementById('start-game-btn'),
    startHint: document.getElementById('start-hint'),
    readyBtn: document.getElementById('ready-btn'),

    // Game buttons
    restartBtn: document.getElementById('restart-btn'),
    menuBtn: document.getElementById('menu-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    changeSizeBtn: document.getElementById('change-size-btn'),
    mpLeaveBtn: document.getElementById('mp-leave-btn'),
    mpPlayAgainBtn: document.getElementById('mp-play-again-btn'),
    mpReturnRoomBtn: document.getElementById('mp-return-room-btn')
};

// ========================================
// Utility Functions
// ========================================

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
}

function showLoading(text = 'Bağlanıyor...') {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function generateCards(size) {
    const pairsNeeded = (size * size) / 2;
    const selectedEmojis = shuffleArray(EMOJIS).slice(0, pairsNeeded);

    const cardPairs = [];
    selectedEmojis.forEach((emoji, index) => {
        cardPairs.push({ emoji, pairId: index, matched: false });
        cardPairs.push({ emoji, pairId: index, matched: false });
    });

    return shuffleArray(cardPairs);
}

// ========================================
// Solo Game Logic
// ========================================

function initSoloGame(size) {
    gameState = {
        mode: 'solo',
        boardSize: size,
        cards: generateCards(size),
        flippedCards: [],
        matchedPairs: 0,
        totalPairs: (size * size) / 2,
        moves: 0,
        timer: 0,
        timerInterval: null,
        isLocked: false
    };

    showScreen('game-screen');
    elements.soloHeader.classList.remove('hidden');
    elements.mpHeader.classList.add('hidden');
    elements.soloFooter.classList.remove('hidden');
    elements.mpFooter.classList.add('hidden');

    renderBoard(gameState.cards, size);
    updateSoloStats();
    startSoloTimer();
}

function renderBoard(cards, size) {
    const board = elements.gameBoard;
    board.innerHTML = '';
    board.className = `game-board size-${size}`;

    cards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        if (card.matched) cardElement.classList.add('matched', 'flipped');
        cardElement.dataset.index = index;
        cardElement.style.setProperty('--card-index', index);
        cardElement.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-back"></div>
                <div class="card-face card-front">${card.emoji}</div>
            </div>
        `;
        cardElement.addEventListener('click', () => handleCardClick(index));
        board.appendChild(cardElement);
    });
}

function handleCardClick(index) {
    if (gameState.mode === 'solo') {
        handleSoloCardClick(index);
    } else {
        handleMultiplayerCardClick(index);
    }
}

function handleSoloCardClick(index) {
    if (gameState.isLocked) return;

    const cardElement = elements.gameBoard.children[index];
    const card = gameState.cards[index];

    if (cardElement.classList.contains('flipped') || cardElement.classList.contains('matched')) return;
    if (gameState.flippedCards.length >= 2) return;

    cardElement.classList.add('flipped');
    gameState.flippedCards.push({ index, card, element: cardElement });

    if (gameState.flippedCards.length === 2) {
        gameState.moves++;
        updateSoloStats();
        checkSoloMatch();
    }
}

function checkSoloMatch() {
    const [first, second] = gameState.flippedCards;
    gameState.isLocked = true;

    if (first.card.pairId === second.card.pairId) {
        setTimeout(() => {
            first.element.classList.add('matched');
            second.element.classList.add('matched');
            gameState.matchedPairs++;
            gameState.flippedCards = [];
            gameState.isLocked = false;
            updateSoloStats();

            if (gameState.matchedPairs === gameState.totalPairs) {
                endSoloGame();
            }
        }, 300);
    } else {
        setTimeout(() => {
            first.element.classList.add('mismatch');
            second.element.classList.add('mismatch');

            setTimeout(() => {
                first.element.classList.add('flipping-back');
                second.element.classList.add('flipping-back');
                first.element.classList.remove('flipped', 'mismatch');
                second.element.classList.remove('flipped', 'mismatch');

                setTimeout(() => {
                    first.element.classList.remove('flipping-back');
                    second.element.classList.remove('flipping-back');
                    gameState.flippedCards = [];
                    gameState.isLocked = false;
                }, 600);
            }, 800);
        }, 600);
    }
}

function updateSoloStats() {
    elements.timerDisplay.textContent = formatTime(gameState.timer);
    elements.movesDisplay.textContent = gameState.moves;
    elements.matchesDisplay.textContent = `${gameState.matchedPairs}/${gameState.totalPairs}`;
}

function startSoloTimer() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(() => {
        gameState.timer++;
        elements.timerDisplay.textContent = formatTime(gameState.timer);
    }, 1000);
}

function stopSoloTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function endSoloGame() {
    stopSoloTimer();
    elements.finalTime.textContent = formatTime(gameState.timer);
    elements.finalMoves.textContent = gameState.moves;
    setTimeout(() => elements.winModal.classList.add('active'), 500);
}

function restartSoloGame() {
    stopSoloTimer();
    elements.winModal.classList.remove('active');
    initSoloGame(gameState.boardSize);
}

function goToMainMenu() {
    stopSoloTimer();
    elements.winModal.classList.remove('active');
    elements.gameScreen.classList.remove('active');
    showScreen('start-screen');
}

// ========================================
// Multiplayer Logic
// ========================================

let mpBoardSize = 4;
let isGuestReady = false;
let mpGameStarted = false;

async function handleCreateRoom() {
    showLoading('Oda oluşturuluyor...');
    try {
        const roomCode = await createRoom();
        elements.displayRoomCode.textContent = roomCode;
        elements.hostControls.classList.remove('hidden');
        elements.guestControls.classList.add('hidden');
        showScreen('waiting-room-screen');
        listenToRoomUpdates();
    } catch (error) {
        elements.lobbyError.textContent = error.message;
    }
    hideLoading();
}

async function handleJoinRoom() {
    const roomCode = elements.roomCodeInput.value.trim();
    if (roomCode.length !== 5) {
        elements.lobbyError.textContent = '5 haneli oda kodu girin';
        return;
    }

    showLoading('Odaya bağlanılıyor...');
    try {
        await joinRoom(roomCode);
        elements.displayRoomCode.textContent = roomCode;
        elements.hostControls.classList.add('hidden');
        elements.guestControls.classList.remove('hidden');
        isGuestReady = false;
        elements.readyBtn.textContent = '✋ HAZIRIM';
        elements.readyBtn.classList.remove('ready');
        showScreen('waiting-room-screen');
        listenToRoomUpdates();
    } catch (error) {
        elements.lobbyError.textContent = error.message;
    }
    hideLoading();
}

async function handleLeaveRoom() {
    showLoading('Ayrılıyor...');
    await leaveRoom();
    hideLoading();
    showScreen('lobby-screen');
}

function listenToRoomUpdates() {
    listenToRoom((roomData) => {
        if (!roomData) {
            // Room was deleted
            hideLoading();
            alert('Oda kapatıldı');
            showScreen('lobby-screen');
            return;
        }

        // Update guest card
        if (roomData.guest) {
            elements.guestCard.innerHTML = `
                <span class="player-icon">${roomData.guest.ready ? '✅' : '👤'}</span>
                <span class="player-name">Rakip</span>
                <span class="player-status ${roomData.guest.ready ? 'ready' : ''}">${roomData.guest.ready ? 'Hazır' : 'Bekleniyor'}</span>
            `;
            elements.guestCard.classList.add('connected');

            // Enable start button if guest is ready
            if (multiplayerState.isHost) {
                if (roomData.guest.ready) {
                    elements.startGameBtn.classList.remove('disabled');
                    elements.startHint.textContent = 'Oyunu başlatabilirsin!';
                } else {
                    elements.startGameBtn.classList.add('disabled');
                    elements.startHint.textContent = 'Rakip hazır olunca başlatabilirsin';
                }
            }
        } else {
            elements.guestCard.innerHTML = `
                <span class="player-icon">⏳</span>
                <span class="player-name">Bekleniyor...</span>
                <span class="player-status"></span>
            `;
            elements.guestCard.classList.remove('connected');
            if (multiplayerState.isHost) {
                elements.startGameBtn.classList.add('disabled');
                elements.startHint.textContent = 'Rakip bekleniyor...';
            }
        }

        // Update board size display
        mpBoardSize = roomData.boardSize || 4;
        elements.toggleBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size) === mpBoardSize);
        });

        // Handle game state changes
        if (roomData.gameState === 'playing' && !mpGameStarted) {
            mpGameStarted = true;
            startMultiplayerGameUI(roomData);
        } else if (roomData.gameState === 'ended') {
            mpGameStarted = false;
            // Show modal if not already showing
            if (!elements.mpEndModal.classList.contains('active')) {
                showMultiplayerEndModal(roomData);
            } else {
                // Update confirmation status
                updateConfirmationUI(roomData);
            }
        } else if (roomData.gameState === 'waiting') {
            mpGameStarted = false;
            // Stay in waiting room or return to it
            if (elements.gameScreen.classList.contains('active') || elements.mpEndModal.classList.contains('active')) {
                elements.mpEndModal.classList.remove('active');
                showScreen('waiting-room-screen');
            }
        }

        // During gameplay - always update UI
        if (roomData.gameState === 'playing') {
            updateMultiplayerUI(roomData);
        }
    });
}


function startMultiplayerGameUI(roomData) {
    gameState.mode = 'multiplayer';
    gameState.boardSize = roomData.boardSize;
    gameState.cards = roomData.cards;
    gameState.totalPairs = roomData.cards.length / 2;

    showScreen('game-screen');
    elements.soloHeader.classList.add('hidden');
    elements.mpHeader.classList.remove('hidden');
    elements.soloFooter.classList.add('hidden');
    elements.mpFooter.classList.remove('hidden');

    renderBoard(roomData.cards, roomData.boardSize);
    updateMultiplayerUI(roomData);

    // Host starts timer
    if (multiplayerState.isHost) {
        startGameTimer(
            (timeRemaining) => {
                elements.mpTimer.textContent = formatTime(timeRemaining);
                if (timeRemaining <= 60) {
                    elements.mpTimer.classList.add('warning');
                }
            },
            async () => {
                // Time's up - determine winner based on displayed scores
                const hostScore = parseInt(elements.mpYourScore.textContent) || 0;
                const guestScore = parseInt(elements.mpOpponentScore.textContent) || 0;
                let winner = 'tie';
                if (hostScore > guestScore) winner = 'host';
                else if (guestScore > hostScore) winner = 'guest';
                await endMultiplayerGame(winner);
            }
        );
    }
}


function updateMultiplayerUI(roomData) {
    const isHost = multiplayerState.isHost;

    // Update scores
    elements.mpYourScore.textContent = isHost ? roomData.hostScore : roomData.guestScore;
    elements.mpOpponentScore.textContent = isHost ? roomData.guestScore : roomData.hostScore;

    // Update timer
    elements.mpTimer.textContent = formatTime(roomData.timeRemaining);
    if (roomData.timeRemaining <= 60) {
        elements.mpTimer.classList.add('warning');
    }

    // Update turn indicator
    const isMyTurn = (isHost && roomData.currentTurn === 'host') || (!isHost && roomData.currentTurn === 'guest');
    elements.turnIndicator.textContent = isMyTurn ? 'Senin Sıran' : 'Rakibin Sırası';
    elements.turnIndicator.classList.toggle('opponent-turn', !isMyTurn);

    // Update cards
    if (roomData.cards) {
        roomData.cards.forEach((card, index) => {
            const cardEl = elements.gameBoard.children[index];
            if (!cardEl) return;

            if (card.matched) {
                cardEl.classList.add('matched', 'flipped');
            }
        });

        // Show flipped cards
        if (roomData.flippedCards) {
            roomData.flippedCards.forEach(idx => {
                const cardEl = elements.gameBoard.children[idx];
                if (cardEl && !cardEl.classList.contains('matched')) {
                    cardEl.classList.add('flipped');
                }
            });
        }

        // Hide non-flipped, non-matched cards
        roomData.cards.forEach((card, index) => {
            const cardEl = elements.gameBoard.children[index];
            if (!cardEl) return;
            if (!card.matched && !roomData.flippedCards?.includes(index)) {
                cardEl.classList.remove('flipped');
            }
        });
    }
}

async function handleMultiplayerCardClick(index) {
    await mpFlipCard(index);
}

function showMultiplayerEndModal(roomData) {
    const isHost = multiplayerState.isHost;
    const myScore = isHost ? roomData.hostScore : roomData.guestScore;
    const opponentScore = isHost ? roomData.guestScore : roomData.hostScore;

    let isWinner = false;
    let isTie = false;

    if (roomData.winner === 'tie') {
        isTie = true;
    } else if ((roomData.winner === 'host' && isHost) || (roomData.winner === 'guest' && !isHost)) {
        isWinner = true;
    }

    elements.mpResultIcon.textContent = isTie ? '🤝' : (isWinner ? '🏆' : '😢');
    elements.mpResultTitle.textContent = isTie ? 'Berabere!' : (isWinner ? 'Kazandın!' : 'Kaybettin!');
    elements.mpResultSubtitle.textContent = isTie ? 'Eşit skor!' : (isWinner ? 'Tebrikler!' : 'Bir dahaki sefere!');
    elements.mpFinalYourScore.textContent = myScore;
    elements.mpFinalOpponentScore.textContent = opponentScore;

    // Reset confirmation UI
    updateConfirmationUI(roomData);

    // Both players can confirm
    elements.mpPlayAgainBtn.style.display = 'flex';

    elements.mpEndModal.classList.add('active');
}

function updateConfirmationUI(roomData) {
    const isHost = multiplayerState.isHost;

    // Get confirmation states
    const myPlayAgainConfirm = isHost ? roomData.hostConfirmPlayAgain : roomData.guestConfirmPlayAgain;
    const opponentPlayAgainConfirm = isHost ? roomData.guestConfirmPlayAgain : roomData.hostConfirmPlayAgain;
    const myReturnConfirm = isHost ? roomData.hostConfirmReturn : roomData.guestConfirmReturn;
    const opponentReturnConfirm = isHost ? roomData.guestConfirmReturn : roomData.hostConfirmReturn;

    // Any confirmation counts
    const myConfirm = myPlayAgainConfirm || myReturnConfirm;
    const opponentConfirm = opponentPlayAgainConfirm || opponentReturnConfirm;

    // Update UI
    elements.mpYourConfirm.querySelector('.confirm-icon').textContent = myConfirm ? '✅' : '⏳';
    elements.mpYourConfirm.classList.toggle('confirmed', myConfirm);
    elements.mpOpponentConfirm.querySelector('.confirm-icon').textContent = opponentConfirm ? '✅' : '⏳';
    elements.mpOpponentConfirm.classList.toggle('confirmed', opponentConfirm);

    // Update button states
    elements.mpPlayAgainBtn.textContent = myPlayAgainConfirm ? '✅ Tekrar Oyna' : '🎮 Tekrar Oyna';
    elements.mpReturnRoomBtn.textContent = myReturnConfirm ? '✅ Odaya Dön' : '🏠 Odaya Dön';

    // Check if both confirmed the same action
    if (roomData.hostConfirmPlayAgain && roomData.guestConfirmPlayAgain) {
        elements.mpConfirmHint.textContent = 'Oyun başlıyor...';
        // Both players close modal and prepare for new game
        setTimeout(async () => {
            elements.mpEndModal.classList.remove('active');
            mpGameStarted = false;
            // Only host sends the reset command
            if (isHost) {
                const cards = generateCards(mpBoardSize);
                await resetMultiplayerGame(cards);
            }
        }, 500);
    } else if (roomData.hostConfirmReturn && roomData.guestConfirmReturn) {
        elements.mpConfirmHint.textContent = 'Odaya dönülüyor...';
        setTimeout(async () => {
            elements.mpEndModal.classList.remove('active');
            mpGameStarted = false;
            if (isHost) {
                await returnToWaitingRoom();
            }
            showScreen('waiting-room-screen');
        }, 500);
    } else if (myConfirm) {
        elements.mpConfirmHint.textContent = 'Rakip bekleniyor...';
    } else {
        elements.mpConfirmHint.textContent = 'Her iki oyuncu da onaylamalı';
    }
}

async function handleMpPlayAgain() {
    await setPlayAgainConfirm(true);
    // Also clear return confirm if set
    await setReturnRoomConfirm(false);
}

async function handleMpReturnToRoom() {
    await setReturnRoomConfirm(true);
    // Also clear play again confirm if set
    await setPlayAgainConfirm(false);
}

async function handleStartMultiplayerGame() {
    if (elements.startGameBtn.classList.contains('disabled')) return;

    const cards = generateCards(mpBoardSize);
    await startMultiplayerGame(cards);
}

async function handleToggleReady() {
    isGuestReady = !isGuestReady;
    await setGuestReady(isGuestReady);
    elements.readyBtn.textContent = isGuestReady ? '✅ HAZIRIM' : '✋ HAZIRIM';
    elements.readyBtn.classList.toggle('ready', isGuestReady);
}

async function handleBoardSizeChange(size) {
    if (!multiplayerState.isHost) return;
    mpBoardSize = size;
    await setBoardSize(size);
}

// ========================================
// Event Listeners
// ========================================

// Main menu
elements.soloBtn.addEventListener('click', () => showScreen('solo-screen'));
elements.multiplayerBtn.addEventListener('click', () => showScreen('lobby-screen'));

// Solo screen
elements.backToMenu.addEventListener('click', () => showScreen('start-screen'));
elements.sizeButtons.forEach(btn => {
    btn.addEventListener('click', () => initSoloGame(parseInt(btn.dataset.size)));
});

// Lobby screen
elements.backToMenu2.addEventListener('click', () => showScreen('start-screen'));
elements.createRoomBtn.addEventListener('click', handleCreateRoom);
elements.joinRoomBtn.addEventListener('click', handleJoinRoom);
elements.roomCodeInput.addEventListener('input', () => {
    elements.lobbyError.textContent = '';
});

// Waiting room
elements.leaveRoomBtn.addEventListener('click', handleLeaveRoom);
elements.copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(elements.displayRoomCode.textContent);
});
elements.toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => handleBoardSizeChange(parseInt(btn.dataset.size)));
});
elements.startGameBtn.addEventListener('click', handleStartMultiplayerGame);
elements.readyBtn.addEventListener('click', handleToggleReady);

// Game screen - Solo
elements.restartBtn.addEventListener('click', restartSoloGame);
elements.menuBtn.addEventListener('click', goToMainMenu);
elements.playAgainBtn.addEventListener('click', restartSoloGame);
elements.changeSizeBtn.addEventListener('click', () => {
    elements.winModal.classList.remove('active');
    stopSoloTimer();
    showScreen('solo-screen');
});

// Game screen - Multiplayer
elements.mpLeaveBtn.addEventListener('click', async () => {
    await leaveRoom();
    showScreen('lobby-screen');
});
elements.mpPlayAgainBtn.addEventListener('click', handleMpPlayAgain);
elements.mpReturnRoomBtn.addEventListener('click', handleMpReturnToRoom);

// Prevent context menu on cards
document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.card')) e.preventDefault();
});

// ========================================
// Initialize
// ========================================
console.log('🧠 Memory Card Game loaded!');

// Hide splash screen with cinematic transition to start screen
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    const startScreen = document.getElementById('start-screen');

    if (splash && startScreen) {
        // Start hiding splash
        splash.classList.add('hidden');

        // Trigger start screen reveal
        startScreen.classList.remove('splash-hidden');
        startScreen.classList.add('splash-reveal');

        // Remove splash after transition
        setTimeout(() => {
            splash.remove();
        }, 800);

        // Clean up reveal class after animation
        setTimeout(() => {
            startScreen.classList.remove('splash-reveal');
        }, 2000);
    }
}, 3500);
