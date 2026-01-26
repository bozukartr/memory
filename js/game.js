// Game Logic
// ==========

class MemoryGame {
    constructor() {
        // Card emojis (8 pairs)
        this.cardEmojis = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🥝', '🍑'];

        // Game state
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = [];
        this.scores = { host: 0, guest: 0 };
        this.currentTurn = 'host';
        this.isMyTurn = false;
        this.isProcessing = false;
        this.gameStartTime = null;

        // Timer
        this.turnTimer = null;
        this.turnTimeLeft = 30;
        this.maxTurnTime = 30;

        // DOM Elements
        this.boardElement = document.getElementById('game-board');
        this.yourScoreElement = document.getElementById('your-score');
        this.opponentScoreElement = document.getElementById('opponent-score');
        this.yourTurnIndicator = document.getElementById('your-turn');
        this.opponentTurnIndicator = document.getElementById('opponent-turn');
        this.timerProgress = document.getElementById('timer-progress');
        this.timerText = document.getElementById('timer-text');
        this.gameStatus = document.getElementById('game-status');
    }

    // Generate shuffled cards
    generateCards() {
        const cards = [];

        // Create pairs
        this.cardEmojis.forEach((emoji, index) => {
            cards.push({ id: index * 2, emoji, pairId: index });
            cards.push({ id: index * 2 + 1, emoji, pairId: index });
        });

        // Fisher-Yates shuffle
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        return cards;
    }

    // Initialize game with cards (from host or received)
    initializeGame(cards, isHost) {
        this.cards = cards;
        this.flippedCards = [];
        this.matchedPairs = [];
        this.scores = { host: 0, guest: 0 };
        this.currentTurn = 'host';
        this.isMyTurn = isHost;
        this.isProcessing = false;
        this.gameStartTime = Date.now();

        this.renderBoard();
        this.updateScores();
        this.updateTurnDisplay();
        this.startTurnTimer();
    }

    // Render the game board
    renderBoard() {
        this.boardElement.innerHTML = '';

        this.cards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.dataset.index = index;

            cardElement.innerHTML = `
                <div class="card-inner">
                    <div class="card-front"></div>
                    <div class="card-back">${card.emoji}</div>
                </div>
            `;

            cardElement.addEventListener('click', () => this.handleCardClick(index));
            this.boardElement.appendChild(cardElement);
        });
    }

    // Handle card click
    handleCardClick(index) {
        // Check if click is valid
        if (!this.isMyTurn || this.isProcessing) return;
        if (this.flippedCards.includes(index)) return;
        if (this.matchedPairs.includes(this.cards[index].pairId)) return;
        if (this.flippedCards.length >= 2) return;

        // Flip the card locally and sync
        this.flipCard(index, true);
    }

    // Flip a card
    flipCard(index, isLocal = false) {
        const cardElement = this.boardElement.children[index];

        if (!cardElement.classList.contains('flipped')) {
            cardElement.classList.add('flipped');
            this.flippedCards.push(index);
            soundManager.playFlip();

            // Sync with Firebase if local action
            if (isLocal && window.multiplayerManager) {
                window.multiplayerManager.syncFlippedCard(index);
            }

            // Check for pair after 2 cards
            if (this.flippedCards.length === 2) {
                this.isProcessing = true;
                setTimeout(() => this.checkMatch(), 800);
            }
        }
    }

    // Check if flipped cards match
    checkMatch() {
        const [firstIndex, secondIndex] = this.flippedCards;
        const firstCard = this.cards[firstIndex];
        const secondCard = this.cards[secondIndex];

        if (firstCard.pairId === secondCard.pairId) {
            // Match found!
            this.handleMatch(firstIndex, secondIndex);
        } else {
            // No match
            this.handleMismatch(firstIndex, secondIndex);
        }
    }

    // Handle matched cards
    handleMatch(firstIndex, secondIndex) {
        const firstCardElement = this.boardElement.children[firstIndex];
        const secondCardElement = this.boardElement.children[secondIndex];

        firstCardElement.classList.add('matched');
        secondCardElement.classList.add('matched');

        // Update matched pairs
        this.matchedPairs.push(this.cards[firstIndex].pairId);

        // Update score
        this.scores[this.currentTurn]++;
        this.updateScores();

        soundManager.playMatch();

        // Animation
        firstCardElement.classList.add('celebrate');
        secondCardElement.classList.add('celebrate');
        setTimeout(() => {
            firstCardElement.classList.remove('celebrate');
            secondCardElement.classList.remove('celebrate');
        }, 600);

        this.flippedCards = [];
        this.isProcessing = false;

        // Sync match with Firebase
        if (this.isMyTurn && window.multiplayerManager) {
            window.multiplayerManager.syncMatch(this.cards[firstIndex].pairId, this.scores);
        }

        // Check if game is over
        if (this.matchedPairs.length === this.cardEmojis.length) {
            this.endGame();
            return;
        }

        // Same player continues after a match
        this.resetTurnTimer();
    }

    // Handle mismatched cards
    handleMismatch(firstIndex, secondIndex) {
        const firstCardElement = this.boardElement.children[firstIndex];
        const secondCardElement = this.boardElement.children[secondIndex];

        soundManager.playMismatch();

        // Shake animation
        firstCardElement.classList.add('shake');
        secondCardElement.classList.add('shake');

        // Sync mismatch with Firebase if it's my turn
        if (this.isMyTurn && window.multiplayerManager) {
            window.multiplayerManager.syncMismatch([firstIndex, secondIndex]);
        }

        setTimeout(() => {
            firstCardElement.classList.remove('flipped', 'shake');
            secondCardElement.classList.remove('flipped', 'shake');

            this.flippedCards = [];
            this.isProcessing = false;

            // Switch turn
            this.switchTurn();
        }, 800);
    }

    // Switch turn
    switchTurn() {
        this.currentTurn = this.currentTurn === 'host' ? 'guest' : 'host';

        // Determine if it's my turn
        const amHost = window.multiplayerManager?.isHost;
        this.isMyTurn = (this.currentTurn === 'host' && amHost) ||
            (this.currentTurn === 'guest' && !amHost);

        this.updateTurnDisplay();
        soundManager.playTurnChange();

        // Sync turn change
        if (window.multiplayerManager) {
            window.multiplayerManager.syncTurn(this.currentTurn);
        }

        this.resetTurnTimer();
    }

    // Update turn display
    updateTurnDisplay() {
        const amHost = window.multiplayerManager?.isHost;
        const isMyTurn = (this.currentTurn === 'host' && amHost) ||
            (this.currentTurn === 'guest' && !amHost);

        this.isMyTurn = isMyTurn;

        if (isMyTurn) {
            this.yourTurnIndicator.classList.add('active');
            this.opponentTurnIndicator.classList.remove('active');
            this.gameStatus.className = 'game-status your-turn';
            this.gameStatus.innerHTML = '<span>Senin sıran!</span>';
        } else {
            this.yourTurnIndicator.classList.remove('active');
            this.opponentTurnIndicator.classList.add('active');
            this.gameStatus.className = 'game-status opponent-turn';
            this.gameStatus.innerHTML = '<span>Rakibin oynuyor...</span>';
        }
    }

    // Update scores display
    updateScores() {
        const amHost = window.multiplayerManager?.isHost;

        if (amHost) {
            this.yourScoreElement.textContent = this.scores.host;
            this.opponentScoreElement.textContent = this.scores.guest;
        } else {
            this.yourScoreElement.textContent = this.scores.guest;
            this.opponentScoreElement.textContent = this.scores.host;
        }
    }

    // Timer functions
    startTurnTimer() {
        this.turnTimeLeft = this.maxTurnTime;
        this.updateTimerDisplay();

        this.turnTimer = setInterval(() => {
            this.turnTimeLeft--;
            this.updateTimerDisplay();

            if (this.turnTimeLeft <= 5) {
                soundManager.playTimerWarning();
            }

            if (this.turnTimeLeft <= 0) {
                this.handleTimeout();
            }
        }, 1000);
    }

    resetTurnTimer() {
        clearInterval(this.turnTimer);
        this.startTurnTimer();
    }

    stopTurnTimer() {
        clearInterval(this.turnTimer);
    }

    updateTimerDisplay() {
        this.timerText.textContent = this.turnTimeLeft;

        // Update circular progress
        const progress = (this.turnTimeLeft / this.maxTurnTime) * 100;
        const offset = 100 - progress;
        this.timerProgress.style.strokeDashoffset = offset;

        // Color changes
        this.timerProgress.classList.remove('warning', 'danger');
        if (this.turnTimeLeft <= 5) {
            this.timerProgress.classList.add('danger');
        } else if (this.turnTimeLeft <= 10) {
            this.timerProgress.classList.add('warning');
        }
    }

    handleTimeout() {
        // If it's my turn and I timeout, switch turn
        if (this.isMyTurn) {
            // Close any flipped cards
            this.flippedCards.forEach(index => {
                const cardElement = this.boardElement.children[index];
                cardElement.classList.remove('flipped');
            });
            this.flippedCards = [];
            this.isProcessing = false;

            this.switchTurn();
        }
    }

    // End game
    endGame() {
        this.stopTurnTimer();

        const amHost = window.multiplayerManager?.isHost;
        const myScore = amHost ? this.scores.host : this.scores.guest;
        const opponentScore = amHost ? this.scores.guest : this.scores.host;

        // Calculate game duration
        const duration = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Show result
        setTimeout(() => {
            window.app?.showResult(myScore, opponentScore, timeString, myScore);
        }, 500);
    }

    // External updates from opponent
    onOpponentFlip(index) {
        if (!this.flippedCards.includes(index)) {
            this.flipCard(index, false);
        }
    }

    onMatchUpdate(pairId, scores) {
        this.matchedPairs.push(pairId);
        this.scores = scores;
        this.updateScores();

        // Find and mark matched cards
        this.cards.forEach((card, index) => {
            if (card.pairId === pairId) {
                const cardElement = this.boardElement.children[index];
                cardElement.classList.add('matched', 'celebrate');
                setTimeout(() => cardElement.classList.remove('celebrate'), 600);
            }
        });

        this.flippedCards = [];
        this.isProcessing = false;
        this.resetTurnTimer();

        // Check game end
        if (this.matchedPairs.length === this.cardEmojis.length) {
            this.endGame();
        }
    }

    onTurnChange(newTurn) {
        this.currentTurn = newTurn;
        this.flippedCards = [];
        this.isProcessing = false;

        // Unflip any flipped cards that are not matched
        Array.from(this.boardElement.children).forEach(card => {
            if (card.classList.contains('flipped') && !card.classList.contains('matched')) {
                card.classList.remove('flipped');
            }
        });

        this.updateTurnDisplay();
        this.resetTurnTimer();
    }

    // Handle opponent's mismatch - close the flipped cards
    onMismatchUpdate(cardIndices) {
        // Only process if it was opponent's turn
        if (this.isMyTurn) return;

        soundManager.playMismatch();

        cardIndices.forEach(index => {
            const cardElement = this.boardElement.children[index];
            if (cardElement && !cardElement.classList.contains('matched')) {
                cardElement.classList.add('shake');
                setTimeout(() => {
                    cardElement.classList.remove('flipped', 'shake');
                }, 800);
            }
        });

        this.flippedCards = [];
        this.isProcessing = false;
    }

    // Reset game
    reset() {
        this.stopTurnTimer();
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = [];
        this.scores = { host: 0, guest: 0 };
        this.currentTurn = 'host';
        this.isProcessing = false;
        this.boardElement.innerHTML = '';
    }
}

// Global instance
const game = new MemoryGame();
