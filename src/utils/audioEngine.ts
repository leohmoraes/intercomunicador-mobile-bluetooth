import { AudioProfileType, RogerBeepType } from '../types/intercom';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private bgGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private isBgMusicPlaying = false;
  private bgTimer: number | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private micFilterHigh: BiquadFilterNode | null = null;
  private micFilterLow: BiquadFilterNode | null = null;
  private micCompressor: DynamicsCompressorNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private rxAnalyser: AnalyserNode | null = null;
  private duckingTimeout: number | null = null;
  private isDucked = false;

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output gain
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGainNode.connect(this.ctx.destination);

      // Background audio bus (for Ducking)
      this.bgGainNode = this.ctx.createGain();
      this.bgGainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.bgGainNode.connect(this.masterGainNode);

      // RX Analyser (for received voice metering)
      this.rxAnalyser = this.ctx.createAnalyser();
      this.rxAnalyser.fftSize = 256;
      this.rxAnalyser.smoothingTimeConstant = 0.8;
      this.rxAnalyser.connect(this.masterGainNode);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public getContext(): AudioContext {
    return this.init();
  }

  // --- SQUELCH SOUND SYNTHESIZER ---
  public playSquelch(type: 'open' | 'close' = 'open') {
    const ctx = this.getContext();
    const duration = type === 'open' ? 0.065 : 0.085;
    const now = ctx.currentTime;

    // Generate white/pink noise buffer
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pinkish noise filter approximation
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2 + white * 0.5) * 0.35;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Bandpass filter to sound like an authentic walkie-talkie receiver carrier burst
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(type === 'open' ? 1800 : 1400, now);
    filter.Q.setValueAtTime(3.5, now);

    // Sharp squelch envelope
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.4, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(filter);
    filter.connect(env);
    env.connect(this.masterGainNode || ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration + 0.01);

    // Add subtle mechanical sub-click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(140, now);
    click.frequency.exponentialRampToValueAtTime(40, now + 0.02);

    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    click.connect(clickGain);
    clickGain.connect(this.masterGainNode || ctx.destination);
    click.start(now);
    click.stop(now + 0.03);
  }

  // --- ROGER BEEP SYNTHESIZER ---
  public playRogerBeep(type: RogerBeepType = 'tactical') {
    if (type === 'none') return;
    const ctx = this.getContext();
    const now = ctx.currentTime;

    if (type === 'quindar') {
      // NASA Apollo Quindar Tone: 2524 Hz sine burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2524, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gain.gain.setValueAtTime(0.3, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGainNode || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'tactical') {
      // Dual-tone stepped military chirp: 1150 Hz then 1750 Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1150, now);
      osc.frequency.setValueAtTime(1750, now + 0.07);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gain.gain.setValueAtTime(0.35, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGainNode || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'classic') {
      // Standard 1000 Hz short radio beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1050, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gain.gain.setValueAtTime(0.3, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGainNode || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'chirp') {
      // Pitch ramp chirp 800 -> 2400 Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGainNode || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    }
  }

  // --- AUDIO DUCKING SYSTEM ---
  // When voice begins transmitting or receiving, background audio drops immediately.
  // When voice finishes, volume gradually restores.
  public applyAudioDucking(duckingEnabled: boolean, duckingDepth: number = 0.85) {
    if (!duckingEnabled || !this.bgGainNode || !this.ctx) return;
    if (this.duckingTimeout) {
      window.clearTimeout(this.duckingTimeout);
      this.duckingTimeout = null;
    }

    const now = this.ctx.currentTime;
    const targetGain = Math.max(0.01, 0.5 * (1 - duckingDepth)); // e.g. Drops to 15% or 5%

    this.isDucked = true;
    this.bgGainNode.gain.cancelScheduledValues(now);
    // Fast attack ducking (35ms)
    this.bgGainNode.gain.linearRampToValueAtTime(targetGain, now + 0.035);
  }

  public releaseAudioDucking(duckingEnabled: boolean, releaseMs: number = 700) {
    if (!duckingEnabled || !this.bgGainNode || !this.ctx) return;
    if (this.duckingTimeout) {
      window.clearTimeout(this.duckingTimeout);
    }

    // Small delay to ensure no voice tail cutoff before restoring
    this.duckingTimeout = window.setTimeout(() => {
      if (!this.ctx || !this.bgGainNode) return;
      const now = this.ctx.currentTime;
      this.isDucked = false;
      this.bgGainNode.gain.cancelScheduledValues(now);
      // Smooth release curve back to baseline 0.5
      this.bgGainNode.gain.linearRampToValueAtTime(0.5, now + (releaseMs / 1000));
    }, 150);
  }

  public getIsDucked(): boolean {
    return this.isDucked;
  }

  // --- BACKGROUND MUSIC & SPOTIFY SIMULATOR ---
  // Generates pleasant ambient lo-fi chords so user can test the Audio Ducking effect immediately
  public toggleBackgroundMusic(): boolean {
    const ctx = this.getContext();
    if (this.isBgMusicPlaying) {
      this.stopBackgroundMusic();
      return false;
    } else {
      this.startBackgroundMusic();
      return true;
    }
  }

  public isMusicPlaying(): boolean {
    return this.isBgMusicPlaying;
  }

  private startBackgroundMusic() {
    const ctx = this.getContext();
    this.isBgMusicPlaying = true;

    // Ambient procedural Lo-Fi chord player
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23], // G7
    ];
    let chordIdx = 0;

    const playChord = () => {
      if (!this.isBgMusicPlaying || !this.ctx || !this.bgGainNode) return;
      const now = this.ctx.currentTime;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      notes.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgGainNode!);

        osc.start(now);
        osc.stop(now + 3.3);
      });

      // Soft kick pulse
      const kick = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kick.frequency.setValueAtTime(90, now);
      kick.frequency.exponentialRampToValueAtTime(35, now + 0.15);
      kickGain.gain.setValueAtTime(0.08, now);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      kick.connect(kickGain);
      kickGain.connect(this.bgGainNode);
      kick.start(now);
      kick.stop(now + 0.3);

      this.bgTimer = window.setTimeout(playChord, 3000);
    };

    playChord();
  }

  public stopBackgroundMusic() {
    this.isBgMusicPlaying = false;
    if (this.bgTimer) {
      window.clearTimeout(this.bgTimer);
      this.bgTimer = null;
    }
  }

  // --- MICROPHONE INPUT & SIGNAL CHAIN ---
  public async setupMicrophone(): Promise<MediaStream | null> {
    try {
      if (this.micStream) return this.micStream;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      const ctx = this.getContext();

      this.micSource = ctx.createMediaStreamSource(stream);

      // Mic Gain / Boost
      this.micGain = ctx.createGain();
      this.micGain.gain.setValueAtTime(1.0, ctx.currentTime);

      // Walkie-Talkie Filters (Highpass & Lowpass)
      this.micFilterHigh = ctx.createBiquadFilter();
      this.micFilterHigh.type = 'highpass';
      this.micFilterHigh.frequency.setValueAtTime(300, ctx.currentTime);

      this.micFilterLow = ctx.createBiquadFilter();
      this.micFilterLow.type = 'lowpass';
      this.micFilterLow.frequency.setValueAtTime(3400, ctx.currentTime);

      // Limiter / Compressor to avoid harsh clipping when boosted
      this.micCompressor = ctx.createDynamicsCompressor();
      this.micCompressor.threshold.setValueAtTime(-14, ctx.currentTime);
      this.micCompressor.knee.setValueAtTime(8, ctx.currentTime);
      this.micCompressor.ratio.setValueAtTime(8, ctx.currentTime);
      this.micCompressor.attack.setValueAtTime(0.005, ctx.currentTime);
      this.micCompressor.release.setValueAtTime(0.1, ctx.currentTime);

      // Analyser for metering & VOX
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.5;

      // Connect graph: source -> gain -> compressor -> analyser
      this.micSource.connect(this.micGain);
      this.micGain.connect(this.micCompressor);
      this.micCompressor.connect(this.micAnalyser);

      return stream;
    } catch (err) {
      console.warn('Microphone access denied or not available:', err);
      return null;
    }
  }

  public updateMicProfile(profile: AudioProfileType, gainMultiplier: number = 1.0) {
    if (!this.micGain || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Apply Boost gain
    let targetGain = gainMultiplier;
    if (profile === 'boost_amplified') {
      targetGain = gainMultiplier * 2.5; // +8dB to +14dB boost
    }
    this.micGain.gain.setTargetAtTime(targetGain, now, 0.05);

    // Apply walkie bandpass if tactical profile
    if (this.micSource && this.micFilterHigh && this.micFilterLow && this.micCompressor) {
      try {
        this.micSource.disconnect();
        this.micGain.disconnect();
        this.micFilterHigh.disconnect();
        this.micFilterLow.disconnect();

        if (profile === 'tactical_walkie') {
          // Bandpass chain
          this.micSource.connect(this.micFilterHigh);
          this.micFilterHigh.connect(this.micFilterLow);
          this.micFilterLow.connect(this.micGain);
          this.micGain.connect(this.micCompressor);
        } else {
          // Clean HQ chain
          this.micSource.connect(this.micGain);
          this.micGain.connect(this.micCompressor);
        }
      } catch {
        // Safe reconnection
      }
    }
  }

  // Measure current microphone RMS level (0 - 100)
  public getMicLevel(): number {
    if (!this.micAnalyser) return 0;
    const data = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;
    return Math.min(100, Math.round((avg / 128) * 100));
  }

  // --- SYNTHESIZED TEST TRANSMISSION TONE & VOICE ---
  // Plays simulated voice or 1kHz test tone for instant testing without speaking aloud
  public playTestTone(frequency: number = 1000, durationSec: number = 1.0) {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.setValueAtTime(0.25, now + durationSec - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(this.masterGainNode || ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  }

  public playSimulatedVoice(phrase: string = 'Alfa para Bravo, teste de rádio, câmbio', onEnd?: () => void) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback: 3 pleasant radio tonal beeps
      this.playTestTone(880, 0.4);
      setTimeout(() => this.playTestTone(1100, 0.4), 450);
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 950);
    }
  }

  // Haptic feedback for tactical PTT sensation
  public triggerHaptic(type: 'press' | 'release' | 'roger') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'press') {
          navigator.vibrate(30);
        } else if (type === 'release') {
          navigator.vibrate([15, 15]);
        } else if (type === 'roger') {
          navigator.vibrate([20, 30, 20]);
        }
      } catch {
        // Ignore vibration errors
      }
    }
  }
}

export const audioEngine = new AudioEngine();
