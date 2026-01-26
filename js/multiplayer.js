// Multiplayer Manager
// ===================

class MultiplayerManager {
    constructor() {
        this.roomRef = null;
        this.roomCode = null;
        this.playerId = this.generatePlayerId();
        this.isHost = false;
        this.opponentConnected = false;

        // Callbacks
        this.onOpponentJoined = null;
        this.onOpponentLeft = null;
        this.onGameStart = null;
        this.onOpponentFlip = null;
        this.onMatchUpdate = null;
        this.onTurnChange = null;
        this.onMismatchUpdate = null;
        this.onPlayAgainRequest = null;
        this.onRoomClosed = null;
    }

    // Generate unique player ID
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    // Generate 5-digit room code
    generateRoomCode() {
        return Math.floor(10000 + Math.random() * 90000).toString();
    }

    // Create a new room
    async createRoom() {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;

        const roomData = {
            host: this.playerId,
            guest: null,
            status: 'waiting',
            currentTurn: 'host',
            cards: null,
            flippedCards: [],
            matchedPairs: [],
            scores: { host: 0, guest: 0 },
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastActivity: firebase.database.ServerValue.TIMESTAMP
        };

        this.roomRef = database.ref(`rooms/${this.roomCode}`);

        try {
            await this.roomRef.set(roomData);
            this.setupRoomListeners();
            this.setupPresence();

            console.log('Room created:', this.roomCode);
            return this.roomCode;
        } catch (error) {
            console.error('Error creating room:', error);
            throw error;
        }
    }

    // Join an existing room
    async joinRoom(code) {
        this.roomCode = code;
        this.isHost = false;
        this.roomRef = database.ref(`rooms/${this.roomCode}`);

        try {
            const snapshot = await this.roomRef.once('value');
            const roomData = snapshot.val();

            if (!roomData) {
                throw new Error('Oda bulunamadı');
            }

            if (roomData.status !== 'waiting') {
                throw new Error('Oyun zaten başlamış');
            }

            if (roomData.guest) {
                throw new Error('Oda dolu');
            }

            // Join as guest
            await this.roomRef.update({
                guest: this.playerId,
                status: 'ready',
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });

            this.setupRoomListeners();
            this.setupPresence();

            console.log('Joined room:', this.roomCode);
            return true;
        } catch (error) {
            console.error('Error joining room:', error);
            throw error;
        }
    }

    // Setup room listeners
    setupRoomListeners() {
        // Listen for status changes
        this.roomRef.child('status').on('value', (snapshot) => {
            const status = snapshot.val();

            if (status === 'ready' && this.isHost) {
                // Guest joined, notify host
                this.opponentConnected = true;
                if (this.onOpponentJoined) this.onOpponentJoined();
            }

            if (status === 'playing') {
                // Game started
                if (this.onGameStart) {
                    this.roomRef.child('cards').once('value', (cardsSnapshot) => {
                        const cards = cardsSnapshot.val();
                        this.onGameStart(cards);
                    });
                }
            }
        });

        // Listen for guest changes (disconnect detection)
        this.roomRef.child('guest').on('value', (snapshot) => {
            const guest = snapshot.val();

            if (this.isHost && !guest && this.opponentConnected) {
                // Guest left
                this.opponentConnected = false;
                if (this.onOpponentLeft) this.onOpponentLeft();
            }

            if (!this.isHost && guest === this.playerId) {
                this.opponentConnected = true;
            }
        });

        // Listen for flipped cards (opponent's moves)
        this.roomRef.child('flippedCards').on('value', (snapshot) => {
            const flippedCards = snapshot.val() || [];

            if (flippedCards.length > 0 && this.onOpponentFlip) {
                const lastFlipped = flippedCards[flippedCards.length - 1];

                // Only process if it's opponent's turn
                const isOpponentsTurn = (this.isHost && game.currentTurn === 'guest') ||
                    (!this.isHost && game.currentTurn === 'host');

                if (isOpponentsTurn) {
                    this.onOpponentFlip(lastFlipped);
                }
            }
        });

        // Listen for match updates
        this.roomRef.child('matchedPairs').on('value', (snapshot) => {
            const matchedPairs = snapshot.val() || [];

            if (matchedPairs.length > game.matchedPairs.length && this.onMatchUpdate) {
                const newPair = matchedPairs[matchedPairs.length - 1];

                // Also get scores
                this.roomRef.child('scores').once('value', (scoresSnapshot) => {
                    const scores = scoresSnapshot.val();
                    this.onMatchUpdate(newPair, scores);
                });
            }
        });

        // Listen for turn changes
        this.roomRef.child('currentTurn').on('value', (snapshot) => {
            const currentTurn = snapshot.val();

            if (currentTurn && currentTurn !== game.currentTurn && this.onTurnChange) {
                this.onTurnChange(currentTurn);
            }
        });

        // Listen for mismatch updates (to close cards on opponent's mismatch)
        this.roomRef.child('lastMismatch').on('value', (snapshot) => {
            const mismatch = snapshot.val();
            if (mismatch && this.onMismatchUpdate) {
                this.onMismatchUpdate(mismatch.cards);
            }
        });

        // Listen for room deletion (host left)
        this.roomRef.on('value', (snapshot) => {
            if (!snapshot.exists() && this.onRoomClosed) {
                this.onRoomClosed();
            }
        });

        // Listen for play again requests
        this.roomRef.child('playAgain').on('value', (snapshot) => {
            const playAgain = snapshot.val();

            if (playAgain && playAgain !== this.playerId && this.onPlayAgainRequest) {
                this.onPlayAgainRequest();
            }
        });
    }

    // Setup presence (disconnect handling)
    setupPresence() {
        const presenceRef = this.isHost ?
            this.roomRef.child('hostPresence') :
            this.roomRef.child('guestPresence');

        presenceRef.set(true);
        presenceRef.onDisconnect().set(false);

        // If guest, clear guest field on disconnect
        if (!this.isHost) {
            this.roomRef.child('guest').onDisconnect().set(null);
            this.roomRef.child('status').onDisconnect().set('waiting');
        }

        // If host, delete room on disconnect (optional, can be removed)
        // this.roomRef.onDisconnect().remove();
    }

    // Start the game (host only)
    async startGame(cards) {
        if (!this.isHost) return;

        try {
            await this.roomRef.update({
                cards: cards,
                status: 'playing',
                currentTurn: 'host',
                flippedCards: [],
                matchedPairs: [],
                scores: { host: 0, guest: 0 },
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('Game started');
        } catch (error) {
            console.error('Error starting game:', error);
        }
    }

    // Sync flipped card
    async syncFlippedCard(cardIndex) {
        try {
            const snapshot = await this.roomRef.child('flippedCards').once('value');
            const currentFlipped = snapshot.val() || [];
            currentFlipped.push(cardIndex);

            await this.roomRef.update({
                flippedCards: currentFlipped,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error syncing flipped card:', error);
        }
    }

    // Sync match
    async syncMatch(pairId, scores) {
        try {
            const snapshot = await this.roomRef.child('matchedPairs').once('value');
            const matchedPairs = snapshot.val() || [];
            matchedPairs.push(pairId);

            await this.roomRef.update({
                matchedPairs: matchedPairs,
                scores: scores,
                flippedCards: [],
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error syncing match:', error);
        }
    }

    // Sync turn change
    async syncTurn(newTurn) {
        try {
            await this.roomRef.update({
                currentTurn: newTurn,
                flippedCards: [],
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error syncing turn:', error);
        }
    }

    // Sync mismatch (notify opponent that cards didn't match)
    async syncMismatch(cardIndices) {
        try {
            await this.roomRef.update({
                lastMismatch: {
                    cards: cardIndices,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                },
                flippedCards: [],
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error syncing mismatch:', error);
        }
    }

    // Request play again
    async requestPlayAgain() {
        try {
            await this.roomRef.update({
                playAgain: this.playerId
            });
        } catch (error) {
            console.error('Error requesting play again:', error);
        }
    }

    // Reset for new game
    async resetGame(cards) {
        if (!this.isHost) return;

        try {
            await this.roomRef.update({
                cards: cards,
                status: 'playing',
                currentTurn: 'host',
                flippedCards: [],
                matchedPairs: [],
                scores: { host: 0, guest: 0 },
                playAgain: null,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error resetting game:', error);
        }
    }

    // Leave room
    async leaveRoom() {
        if (this.roomRef) {
            // Remove listeners
            this.roomRef.off();

            try {
                if (this.isHost) {
                    // Delete the room
                    await this.roomRef.remove();
                } else {
                    // Just leave as guest
                    await this.roomRef.update({
                        guest: null,
                        status: 'waiting'
                    });
                }
            } catch (error) {
                console.error('Error leaving room:', error);
            }

            this.roomRef = null;
            this.roomCode = null;
            this.isHost = false;
            this.opponentConnected = false;
        }
    }
}

// Global instance
const multiplayerManager = new MultiplayerManager();
window.multiplayerManager = multiplayerManager;
