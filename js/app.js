// Main Application Controller
// ===========================

class App {
    constructor() {
        // Screens
        this.screens = {
            splash: document.getElementById('splash-screen'),
            menu: document.getElementById('menu-screen'),
            waiting: document.getElementById('waiting-screen'),
            game: document.getElementById('game-screen'),
            result: document.getElementById('result-screen')
        };

        // Modals
        this.modals = {
            join: document.getElementById('join-modal'),
            settings: document.getElementById('settings-modal'),
            howto: document.getElementById('howto-modal')
        };

        // Elements
        this.roomCodeText = document.getElementById('room-code-text');
        this.joinCodeInput = document.getElementById('join-code-input');
        this.btnConfirmJoin = document.getElementById('btn-confirm-join');
        this.player2Slot = document.getElementById('player2-slot');
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toast-message');

        // Settings toggles
        this.toggleSound = document.getElementById('toggle-sound');
        this.toggleVibration = document.getElementById('toggle-vibration');
        this.toggleMusic = document.getElementById('toggle-music');

        this.init();
    }

    init() {
        // Show splash then transition to menu with animation
        setTimeout(() => {
            this.transitionFromSplash();
        }, 2500);

        this.setupEventListeners();
        this.setupMultiplayerCallbacks();
        this.loadSettings();
    }

    transitionFromSplash() {
        const splashScreen = this.screens.splash;

        // Add exiting class to trigger animations
        splashScreen.classList.add('exiting');

        // Wait for animation to complete, then show menu
        setTimeout(() => {
            splashScreen.classList.remove('active', 'exiting');
            this.screens.menu.classList.add('active', 'fade-in');

            // Remove fade-in class after animation
            setTimeout(() => {
                this.screens.menu.classList.remove('fade-in');
            }, 600);
        }, 700);
    }

    setupEventListeners() {
        // Menu buttons
        document.getElementById('btn-create-room').addEventListener('click', () => {
            soundManager.playClick();
            this.createRoom();
        });

        document.getElementById('btn-join-room').addEventListener('click', () => {
            soundManager.playClick();
            this.showModal('join');
        });

        document.getElementById('btn-settings').addEventListener('click', () => {
            soundManager.playClick();
            this.showModal('settings');
        });

        document.getElementById('btn-how-to-play').addEventListener('click', () => {
            soundManager.playClick();
            this.showModal('howto');
        });

        // Waiting room
        document.getElementById('btn-leave-room').addEventListener('click', () => {
            soundManager.playClick();
            this.leaveRoom();
        });

        document.getElementById('btn-copy-code').addEventListener('click', () => {
            this.copyRoomCode();
        });

        // Game screen - leave button
        document.getElementById('btn-leave-game').addEventListener('click', () => {
            soundManager.playClick();
            this.confirmLeaveGame();
        });

        // Join modal
        document.getElementById('btn-close-join').addEventListener('click', () => {
            soundManager.playClick();
            this.hideModal('join');
        });

        this.joinCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            this.btnConfirmJoin.disabled = e.target.value.length !== 5;
        });

        this.btnConfirmJoin.addEventListener('click', () => {
            soundManager.playClick();
            this.joinRoom();
        });

        // Settings modal
        document.getElementById('btn-close-settings').addEventListener('click', () => {
            soundManager.playClick();
            this.hideModal('settings');
        });

        this.toggleSound.addEventListener('change', (e) => {
            soundManager.toggleSound(e.target.checked);
            if (e.target.checked) soundManager.playClick();
        });

        this.toggleVibration.addEventListener('change', (e) => {
            soundManager.toggleVibration(e.target.checked);
            if (e.target.checked) soundManager.vibrate(50);
        });

        this.toggleMusic.addEventListener('change', (e) => {
            soundManager.toggleMusic(e.target.checked);
        });

        // How to play modal
        document.getElementById('btn-close-howto').addEventListener('click', () => {
            soundManager.playClick();
            this.hideModal('howto');
        });

        // Result buttons
        document.getElementById('btn-play-again').addEventListener('click', () => {
            soundManager.playClick();
            this.playAgain();
        });

        document.getElementById('btn-back-menu').addEventListener('click', () => {
            soundManager.playClick();
            this.backToMenu();
        });

        // Close modals on backdrop click
        Object.values(this.modals).forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    soundManager.playClick();
                    modal.classList.remove('active');
                }
            });
        });

        // Initialize audio context on first interaction
        document.addEventListener('click', () => {
            soundManager.init();
        }, { once: true });
    }

    setupMultiplayerCallbacks() {
        multiplayerManager.onOpponentJoined = () => {
            soundManager.playNotification();
            this.showToast('Rakip katıldı!');
            this.updateWaitingRoom(true);

            // Start game after a short delay
            setTimeout(() => {
                this.startGame();
            }, 1500);
        };

        multiplayerManager.onOpponentLeft = () => {
            soundManager.playNotification();

            // Check if we're in game or waiting
            if (this.screens.game.classList.contains('active') || this.screens.result.classList.contains('active')) {
                // Opponent left during game
                this.showToast('Rakip oyundan ayrıldı!');
                game.reset();
                multiplayerManager.leaveRoom();
                this.resetWaitingRoomUI();
                this.showScreen('menu');
            } else {
                // Opponent left during waiting
                this.showToast('Rakip ayrıldı');
                this.updateWaitingRoom(false);
            }
        };

        multiplayerManager.onGameStart = (cards) => {
            // Update game room code display
            document.getElementById('game-room-code-text').textContent = multiplayerManager.roomCode;
            game.initializeGame(cards, multiplayerManager.isHost);
            this.showScreen('game');
        };

        multiplayerManager.onOpponentFlip = (cardIndex) => {
            game.onOpponentFlip(cardIndex);
        };

        multiplayerManager.onMatchUpdate = (pairId, scores) => {
            game.onMatchUpdate(pairId, scores);
        };

        multiplayerManager.onTurnChange = (newTurn) => {
            game.onTurnChange(newTurn);
        };

        multiplayerManager.onMismatchUpdate = (cardIndices) => {
            game.onMismatchUpdate(cardIndices);
        };

        multiplayerManager.onPlayAgainRequest = () => {
            soundManager.playNotification();
            this.showToast('Rakip tekrar oynamak istiyor!');
        };

        multiplayerManager.onRoomClosed = () => {
            // Room was deleted (host left)
            if (!multiplayerManager.isHost) {
                soundManager.playNotification();
                this.showToast('Oda kapatıldı!');
                game.reset();
                this.resetWaitingRoomUI();
                this.showScreen('menu');
            }
        };
    }

    loadSettings() {
        this.toggleSound.checked = soundManager.enabled;
        this.toggleVibration.checked = soundManager.vibrationEnabled;
        this.toggleMusic.checked = soundManager.musicEnabled;
    }

    // Screen management
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });

        this.screens[screenName].classList.add('active');
    }

    // Modal management
    showModal(modalName) {
        this.modals[modalName].classList.add('active');
    }

    hideModal(modalName) {
        this.modals[modalName].classList.remove('active');

        if (modalName === 'join') {
            this.joinCodeInput.value = '';
            this.btnConfirmJoin.disabled = true;
        }
    }

    // Toast notification
    showToast(message, duration = 2500) {
        this.toastMessage.textContent = message;
        this.toast.classList.add('active');

        setTimeout(() => {
            this.toast.classList.remove('active');
        }, duration);
    }

    // Room management
    async createRoom() {
        try {
            const roomCode = await multiplayerManager.createRoom();
            this.roomCodeText.textContent = roomCode;
            this.updateWaitingRoom(false);
            this.showScreen('waiting');
            this.showToast('Oda oluşturuldu!');
        } catch (error) {
            this.showToast('Hata: ' + error.message);
        }
    }

    async joinRoom() {
        const code = this.joinCodeInput.value;

        try {
            await multiplayerManager.joinRoom(code);
            this.hideModal('join');

            // Wait for host to start game
            this.roomCodeText.textContent = code;

            // Update player slot to show we're the guest
            document.getElementById('player1-slot').innerHTML = `
                <div class="player-avatar">👤</div>
                <span class="player-name">Host</span>
                <span class="player-status ready">✓</span>
            `;

            this.player2Slot.classList.remove('waiting');
            this.player2Slot.innerHTML = `
                <div class="player-avatar">😊</div>
                <span class="player-name">Sen (Misafir)</span>
                <span class="player-status ready">✓</span>
            `;

            document.querySelector('.waiting-info p').textContent = 'Host oyunu başlatıyor...';

            this.showScreen('waiting');
            this.showToast('Odaya katıldın!');
        } catch (error) {
            this.showToast('Hata: ' + error.message);
        }
    }

    updateWaitingRoom(opponentConnected) {
        if (opponentConnected) {
            this.player2Slot.classList.remove('waiting');
            this.player2Slot.innerHTML = `
                <div class="player-avatar">😈</div>
                <span class="player-name">Rakip</span>
                <span class="player-status ready">✓</span>
            `;
            document.querySelector('.waiting-info p').textContent = 'Oyun başlıyor...';
        } else {
            this.player2Slot.classList.add('waiting');
            this.player2Slot.innerHTML = `
                <div class="player-avatar">❓</div>
                <span class="player-name">Rakip bekleniyor...</span>
                <div class="waiting-dots">
                    <span></span><span></span><span></span>
                </div>
            `;
            document.querySelector('.waiting-info p').textContent = 'Arkadaşına oda kodunu gönder!';
        }
    }

    async leaveRoom() {
        await multiplayerManager.leaveRoom();
        game.reset();
        this.resetWaitingRoomUI();
        this.showScreen('menu');
    }

    resetWaitingRoomUI() {
        // Reset waiting room UI
        document.getElementById('player1-slot').innerHTML = `
            <div class="player-avatar">👤</div>
            <span class="player-name">Sen (Host)</span>
            <span class="player-status ready">✓</span>
        `;
        this.updateWaitingRoom(false);
    }

    // Confirm leave during game
    confirmLeaveGame() {
        // Simple confirm - in a real app you'd use a modal
        this.showToast('Oyundan ayrılıyorsun...');
        setTimeout(async () => {
            await multiplayerManager.leaveRoom();
            game.reset();
            this.resetWaitingRoomUI();
            this.showScreen('menu');
        }, 500);
    }

    copyRoomCode() {
        const code = this.roomCodeText.textContent;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                soundManager.playCopy();
                this.showToast('Kod kopyalandı!');
            });
        } else {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            soundManager.playCopy();
            this.showToast('Kod kopyalandı!');
        }
    }

    // Game management
    startGame() {
        if (multiplayerManager.isHost) {
            const cards = game.generateCards();
            multiplayerManager.startGame(cards);
            document.getElementById('game-room-code-text').textContent = multiplayerManager.roomCode;
            game.initializeGame(cards, true);
            this.showScreen('game');
        }
    }

    showResult(myScore, opponentScore, timeString, matches) {
        // Determine result
        const resultHeader = document.getElementById('result-header');
        const resultTitle = document.getElementById('result-title');
        const resultIcon = document.querySelector('#result-header .result-icon');

        resultHeader.className = 'result-header';

        if (myScore > opponentScore) {
            resultHeader.classList.add('win');
            resultTitle.textContent = 'Kazandın!';
            resultIcon.textContent = '🏆';
            soundManager.playWin();
        } else if (myScore < opponentScore) {
            resultHeader.classList.add('lose');
            resultTitle.textContent = 'Kaybettin!';
            resultIcon.textContent = '😢';
            soundManager.playLose();
        } else {
            resultHeader.classList.add('draw');
            resultTitle.textContent = 'Berabere!';
            resultIcon.textContent = '🤝';
            soundManager.playNotification();
        }

        // Update scores
        document.getElementById('final-your-score').textContent = myScore;
        document.getElementById('final-opponent-score').textContent = opponentScore;

        // Update stats
        document.getElementById('stat-time').textContent = timeString;
        document.getElementById('stat-matches').textContent = matches;

        this.showScreen('result');
    }

    async playAgain() {
        if (multiplayerManager.isHost) {
            const cards = game.generateCards();
            await multiplayerManager.resetGame(cards);
            game.initializeGame(cards, true);
            this.showScreen('game');
        } else {
            await multiplayerManager.requestPlayAgain();
            this.showToast('İstek gönderildi');
        }
    }

    async backToMenu() {
        await multiplayerManager.leaveRoom();
        game.reset();
        this.showScreen('menu');
    }
}

// Initialize app
window.app = new App();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered:', registration.scope);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}
