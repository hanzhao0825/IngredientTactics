export default class AudioManager {
    constructor() {
        this.context = null;
        this.bgmNode = null;
        this.bgmSource = null;
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
        if (!this.context) return;

        // Stop existing BGM
        this.stopBGM();

        // Try to load external audio file
        this.bgmAudioElement = new Audio(url);
        this.bgmAudioElement.loop = true;
        this.bgmAudioElement.volume = this.isMuted ? 0 : 1;

        this.bgmAudioElement.play().then(() => {
            console.log('External BGM loaded:', url);
        }).catch(err => {
            console.warn('Failed to load external BGM, using procedural:', err);
            this.generateProceduralBGM();
        });
    }

    stopBGM() {
        // Stop procedural BGM
        if (this.bgmNode) {
            try {
                this.bgmNode.stop();
            } catch (e) {
                // Already stopped
            }
            this.bgmNode = null;
        }

        // Stop HTML5 Audio
        if (this.bgmAudioElement) {
            this.bgmAudioElement.pause();
            this.bgmAudioElement = null;
        }
    }

    generateProceduralBGM() {
        if (!this.context) return;

        // Stop existing BGM
        this.stopBGM();

        // Create a simple melodic loop using oscillators
        const now = this.context.currentTime;
        const tempo = 120; // BPM
        const beatDuration = 60 / tempo;
        const loopDuration = beatDuration * 16; // 16-beat loop

        // Melody notes (C major pentatonic scale for a cheerful vibe)
        const melody = [
            { note: 523.25, start: 0, duration: 0.5 },    // C5
            { note: 587.33, start: 0.5, duration: 0.5 },  // D5
            { note: 659.25, start: 1, duration: 0.5 },    // E5
            { note: 783.99, start: 1.5, duration: 0.5 },  // G5
            { note: 659.25, start: 2, duration: 0.5 },    // E5
            { note: 587.33, start: 2.5, duration: 0.5 },  // D5
            { note: 523.25, start: 3, duration: 1 },      // C5
            { note: 392.00, start: 4, duration: 0.5 },    // G4
            { note: 523.25, start: 4.5, duration: 0.5 },  // C5
            { note: 587.33, start: 5, duration: 0.5 },    // D5
            { note: 659.25, start: 5.5, duration: 0.5 },  // E5
            { note: 587.33, start: 6, duration: 1 },      // D5
            { note: 523.25, start: 7, duration: 1 },      // C5
        ];

        // Bass line (simple root notes)
        const bass = [
            { note: 130.81, start: 0, duration: 2 },      // C3
            { note: 146.83, start: 2, duration: 2 },      // D3
            { note: 164.81, start: 4, duration: 2 },      // E3
            { note: 130.81, start: 6, duration: 2 },      // C3
        ];

        const scheduleLoop = (startTime) => {
            // Melody
            melody.forEach(({ note, start, duration }) => {
                const osc = this.context.createOscillator();
                const gain = this.context.createGain();

                osc.type = 'square';
                osc.frequency.value = note;

                gain.gain.setValueAtTime(0, startTime + start);
                gain.gain.linearRampToValueAtTime(0.08, startTime + start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + start + duration);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(startTime + start);
                osc.stop(startTime + start + duration);
            });

            // Bass
            bass.forEach(({ note, start, duration }) => {
                const osc = this.context.createOscillator();
                const gain = this.context.createGain();

                osc.type = 'sawtooth';
                osc.frequency.value = note;

                gain.gain.setValueAtTime(0.12, startTime + start);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + start + duration);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(startTime + start);
                osc.stop(startTime + start + duration);
            });

            // Schedule next loop
            setTimeout(() => {
                if (this.context && this.context.state === 'running' && !this.bgmAudioElement) {
                    scheduleLoop(this.context.currentTime);
                }
            }, loopDuration * 1000 - 100); // Schedule slightly before end
        };

        scheduleLoop(now);
        console.log('Procedural BGM started');
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
