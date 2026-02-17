export default class AudioManager {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.isMuted = false;
        this.isInitialized = false;
        this.bgmAudioElement = null; // For HTML5 Audio
    }

    init() {
        if (this.isInitialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.isInitialized = true;
            console.log('AudioManager initialized');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    playBGM(url) {
        // Stop existing BGM
        this.stopBGM();

        // Load external audio file
        this.bgmAudioElement = new Audio(url);
        this.bgmAudioElement.loop = true;
        this.bgmAudioElement.volume = this.isMuted ? 0 : 1;

        this.bgmAudioElement.play().then(() => {
            console.log('BGM loaded:', url);
        }).catch(err => {
            console.error('Failed to load BGM:', err);
        });
    }

    stopBGM() {
        // Stop HTML5 Audio
        if (this.bgmAudioElement) {
            this.bgmAudioElement.pause();
            this.bgmAudioElement = null;
        }
    }

    playSFX(type) {
        if (!this.context || this.isMuted) return;

        const now = this.context.currentTime;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        switch (type) {
            case 'hit':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'select':
                osc.type = 'sine';
                osc.frequency.value = 800;
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;

            case 'skill':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;

            case 'win':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.1);
                osc.frequency.setValueAtTime(783.99, now + 0.2);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
                break;

            case 'merge':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(392.00, now);
                osc.frequency.setValueAtTime(523.25, now + 0.08);
                osc.frequency.setValueAtTime(659.25, now + 0.16);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;

            default:
                return;
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.isMuted ? 0 : 1;
        }
        if (this.bgmAudioElement) {
            this.bgmAudioElement.volume = this.isMuted ? 0 : 1;
        }
        return this.isMuted;
    }

    setVolume(value) {
        if (this.masterGain && !this.isMuted) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, value));
        }
        if (this.bgmAudioElement && !this.isMuted) {
            this.bgmAudioElement.volume = Math.max(0, Math.min(1, value));
        }
    }
}
