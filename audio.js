/**
 * SUPER CUCUMBER SLICER - PROCEDURAL AUDIO ENGINE
 * Synthesizes organic sound effects using the Web Audio API
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.masterVolume = 0.6;
    }

    /**
     * Initialise the AudioContext on first user interaction
     */
    init() {
        if (this.ctx) return;
        
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            console.log("Web Audio API Context initialized successfully.");
        } catch (e) {
            console.error("Web Audio API is not supported in this browser:", e);
        }
    }

    /**
     * Resumes AudioContext if suspended (browser security)
     */
    async resume() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * Toggle mute state
     */
    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    /**
     * Synthesizes a knife hitting the wooden board
     * Blends a low wood thud, metallic ring, and a juicy squish if slicing
     * @param {boolean} hitCucumber - Whether the chop sliced through a cucumber
     * @param {number} intensity - Chop strength (0.0 to 1.0)
     */
    playChop(hitCucumber = false, intensity = 1.0) {
        this.resume();
        if (this.muted || !this.ctx) return;

        const now = this.ctx.currentTime;

        // Create a master gain for this specific chop sound
        const chopGain = this.ctx.createGain();
        chopGain.gain.setValueAtTime(intensity * this.masterVolume, now);
        chopGain.connect(this.ctx.destination);

        // 1. BOARD THUD (Bass impact of knife hitting wood)
        const thudOsc = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        
        thudOsc.type = 'triangle';
        // Fast pitch slide down (bassy wood resonance)
        thudOsc.frequency.setValueAtTime(130, now);
        thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

        // Volume envelope
        thudGain.gain.setValueAtTime(0.8, now);
        thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        thudOsc.connect(thudGain);
        thudGain.connect(chopGain);
        
        thudOsc.start(now);
        thudOsc.stop(now + 0.15);

        // Noise element of wood thud (gives it the "crunch" of impact)
        const bufferSize = this.ctx.sampleRate * 0.1; // 100ms
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const thudNoise = this.ctx.createBufferSource();
        thudNoise.buffer = buffer;

        const thudFilter = this.ctx.createBiquadFilter();
        thudFilter.type = 'lowpass';
        thudFilter.frequency.setValueAtTime(150, now); // Dampened impact noise

        const thudNoiseGain = this.ctx.createGain();
        thudNoiseGain.gain.setValueAtTime(0.4, now);
        thudNoiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        thudNoise.connect(thudFilter);
        thudFilter.connect(thudNoiseGain);
        thudNoiseGain.connect(chopGain);
        
        thudNoise.start(now);
        thudNoise.stop(now + 0.1);

        // 2. STEEL BLADE RING (Subtle metallic resonance)
        const ringOsc1 = this.ctx.createOscillator();
        const ringOsc2 = this.ctx.createOscillator();
        const ringGain = this.ctx.createGain();

        ringOsc1.type = 'sine';
        ringOsc1.frequency.setValueAtTime(3200, now); // High pitch ringing

        ringOsc2.type = 'sine';
        ringOsc2.frequency.setValueAtTime(4500, now); // Anharmonic ring node

        ringGain.gain.setValueAtTime(0.04, now); // Very subtle!
        ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        ringOsc1.connect(ringGain);
        ringOsc2.connect(ringGain);
        ringGain.connect(chopGain);

        ringOsc1.start(now);
        ringOsc2.start(now);
        ringOsc1.stop(now + 0.2);
        ringOsc2.stop(now + 0.2);

        // 3. JUICY SQUISH (Only triggers if we actually hit the cucumber!)
        if (hitCucumber) {
            const squishBufferSize = this.ctx.sampleRate * 0.08; // 80ms
            const squishBuffer = this.ctx.createBuffer(1, squishBufferSize, this.ctx.sampleRate);
            const squishData = squishBuffer.getChannelData(0);
            
            // Generate pink-ish noisy clicks for texture
            for (let i = 0; i < squishBufferSize; i++) {
                squishData[i] = (Math.random() * 2 - 1) * (1 - i / squishBufferSize);
            }

            const squishSource = this.ctx.createBufferSource();
            squishSource.buffer = squishBuffer;

            // Bandpass filter centered in high-mid range for "wetness"
            const squishFilter = this.ctx.createBiquadFilter();
            squishFilter.type = 'bandpass';
            squishFilter.frequency.setValueAtTime(1800, now);
            squishFilter.Q.setValueAtTime(3.0, now);

            const squishGain = this.ctx.createGain();
            squishGain.gain.setValueAtTime(0.9, now);
            squishGain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

            squishSource.connect(squishFilter);
            squishFilter.connect(squishGain);
            squishGain.connect(chopGain);

            squishSource.start(now);
            squishSource.stop(now + 0.09);
        }
    }

    /**
     * Play satisfying click sound for UI interactions
     */
    playClick() {
        this.resume();
        if (this.muted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    /**
     * Play perfect rating fan-fare chime
     */
    playPerfectChime() {
        this.resume();
        if (this.muted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        // Harmonious major third interval
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now + 0.04); // G5
        osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.2); // C6

        gainNode.gain.setValueAtTime(0.0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
    }

    /**
     * Play failure or poor hit buzzer
     */
    playMissBuzz() {
        this.resume();
        if (this.muted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.setValueAtTime(90, now + 0.1);

        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// Export for usage
window.audio = new AudioEngine();
