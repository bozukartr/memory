// Sound & Haptics Manager
// =======================

class SoundManager {
    constructor() {
        this.enabled = true;
        this.musicEnabled = false;
        this.vibrationEnabled = true;

        // AudioContext for generating sounds
        this.audioContext = null;

        // Load settings from localStorage
        this.loadSettings();
    }

    init() {
        // Create AudioContext on user interaction
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    loadSettings() {
        const settings = localStorage.getItem('memoryGameSettings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.enabled = parsed.sound ?? true;
            this.musicEnabled = parsed.music ?? false;
            this.vibrationEnabled = parsed.vibration ?? true;
        }
    }

    saveSettings() {
        localStorage.setItem('memoryGameSettings', JSON.stringify({
            sound: this.enabled,
            music: this.musicEnabled,
            vibration: this.vibrationEnabled
        }));
    }

    // Generate a simple beep/tone
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.enabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Sound Effects
    playFlip() {
        this.playTone(800, 0.1, 'sine', 0.2);
        this.vibrate(10);
    }

    playMatch() {
        // Play a pleasant chord
        this.playTone(523, 0.3, 'sine', 0.2); // C5
        setTimeout(() => this.playTone(659, 0.3, 'sine', 0.2), 100); // E5
        setTimeout(() => this.playTone(784, 0.4, 'sine', 0.2), 200); // G5
        this.vibrate([50, 30, 50]);
    }

    playMismatch() {
        this.playTone(200, 0.15, 'sawtooth', 0.15);
        setTimeout(() => this.playTone(150, 0.2, 'sawtooth', 0.1), 100);
        this.vibrate([30, 20, 30, 20, 30]);
    }

    playWin() {
        // Victory fanfare
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, 0.3, 'sine', 0.25), i * 150);
        });
        this.vibrate([100, 50, 100, 50, 200]);
    }

    playLose() {
        // Sad trombone-ish
        this.playTone(400, 0.3, 'sawtooth', 0.15);
        setTimeout(() => this.playTone(350, 0.3, 'sawtooth', 0.15), 200);
        setTimeout(() => this.playTone(300, 0.5, 'sawtooth', 0.1), 400);
        this.vibrate([200, 100, 200]);
    }

    playClick() {
        this.playTone(600, 0.05, 'square', 0.1);
        this.vibrate(5);
    }

    playNotification() {
        this.playTone(880, 0.15, 'sine', 0.2);
        setTimeout(() => this.playTone(1100, 0.2, 'sine', 0.2), 100);
        this.vibrate([30, 30, 30]);
    }

    playTurnChange() {
        this.playTone(440, 0.1, 'sine', 0.15);
        this.vibrate(20);
    }

    playTimerWarning() {
        this.playTone(1000, 0.1, 'square', 0.15);
        this.vibrate(30);
    }

    playCopy() {
        this.playTone(1200, 0.08, 'sine', 0.15);
        setTimeout(() => this.playTone(1500, 0.08, 'sine', 0.15), 80);
        this.vibrate(15);
    }

    // Vibration
    vibrate(pattern) {
        if (!this.vibrationEnabled) return;
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    // Settings toggle methods
    toggleSound(enabled) {
        this.enabled = enabled;
        this.saveSettings();
    }

    toggleMusic(enabled) {
        this.musicEnabled = enabled;
        this.saveSettings();
    }

    toggleVibration(enabled) {
        this.vibrationEnabled = enabled;
        this.saveSettings();
    }
}

// Global instance
const soundManager = new SoundManager();
