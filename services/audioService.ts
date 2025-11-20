import * as Tone from 'tone';

class AudioService {
  private jumpSynth: Tone.MembraneSynth | null = null;
  private grappleSynth: Tone.MetalSynth | null = null;
  private grappleNoise: Tone.NoiseSynth | null = null;
  private collectSynth: Tone.PolySynth | null = null;
  
  private explosionSynth: Tone.MembraneSynth | null = null;
  private explosionNoise: Tone.NoiseSynth | null = null;
  
  // Sentinel Drone
  private sentinelOsc: Tone.FatOscillator | null = null;
  private sentinelLFO: Tone.LFO | null = null;
  private sentinelPanner: Tone.Panner | null = null;
  private sentinelGain: Tone.Gain | null = null;

  private isInitialized = false;

  init() {
    if (this.isInitialized) return;

    // 1. JUMP (Kick/Thud)
    this.jumpSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 1 }
    }).toDestination();
    // Boosted volume, Note: triggering C2 ensures audible low end
    this.jumpSynth.volume.value = 0;

    // 2. GRAPPLE (Metallic + Noise Burst)
    this.grappleSynth = new Tone.MetalSynth({
      frequency: 100, // 100Hz base for reliable metal clank
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).toDestination();
    this.grappleSynth.volume.value = -10;

    this.grappleNoise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0 }
    }).toDestination();
    this.grappleNoise.volume.value = -12;

    // 3. COLLECT (Sparkle Chord)
    this.collectSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 1 }
    }).toDestination();
    this.collectSynth.volume.value = -5; // Boosted

    // 4. EXPLOSION (Heavy Thud + Crunch)
    this.explosionSynth = new Tone.MembraneSynth({
        pitchDecay: 0.1,
        octaves: 5,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0 }
    }).toDestination();
    this.explosionSynth.volume.value = -2;

    this.explosionNoise = new Tone.NoiseSynth({
        noise: { type: "brown" }, // Deeper noise
        envelope: { attack: 0.001, decay: 0.3, sustain: 0 }
    }).toDestination();
    this.explosionNoise.volume.value = -5;


    // 5. SENTINEL DRONE (Scary Glitch Hum)
    this.sentinelGain = new Tone.Gain(0).toDestination();
    this.sentinelPanner = new Tone.Panner(0).connect(this.sentinelGain);
    
    this.sentinelOsc = new Tone.FatOscillator("C2", "sawtooth", 40).connect(this.sentinelPanner);
    this.sentinelLFO = new Tone.LFO(5, 100, 600).connect(this.sentinelOsc.frequency); // Wobble pitch
    this.sentinelOsc.start();
    this.sentinelLFO.start();

    this.isInitialized = true;
  }

  playJump() {
    if (!this.isInitialized) this.init();
    this.jumpSynth?.triggerAttackRelease("C2", "8n"); // C2 is audible, C1 is sub-bass
  }

  playGrapple() {
    if (!this.isInitialized) this.init();
    this.grappleSynth?.triggerAttackRelease("32n");
    this.grappleNoise?.triggerAttackRelease("32n");
  }

  playCollect() {
    if (!this.isInitialized) this.init();
    // Play a quick major triad arpeggio feel
    this.collectSynth?.triggerAttackRelease(["C6", "E6", "G6"], "16n");
  }

  playExplosion() {
      if (!this.isInitialized) this.init();
      this.explosionSynth?.triggerAttackRelease("G1", "8n");
      this.explosionNoise?.triggerAttackRelease("8n");
  }

  updateSentinelDrone(distance: number) {
      if (!this.isInitialized || !this.sentinelGain || !this.sentinelLFO) return;

      // Distance 0-20 is "Close", 100+ is "Far"
      // Volume: 0 at 100 distance, 1 at 0 distance
      const normalizedDist = Math.max(0, Math.min(1, 1 - (distance / 100)));
      
      // Exponential volume ramp for dramatic effect
      // Multiplier 0.2 keeps it from being overpowering
      const vol = normalizedDist * normalizedDist * 0.2; 
      
      // Smoothly ramp gain
      this.sentinelGain.gain.rampTo(vol, 0.1);

      // Increase wobble speed as they get closer (panic inducer)
      const wobbleSpeed = 2 + (normalizedDist * 15); // 2Hz to 17Hz
      this.sentinelLFO.frequency.rampTo(wobbleSpeed, 0.1);
  }

  stopSentinelDrone() {
      if (this.sentinelGain) {
          this.sentinelGain.gain.cancelScheduledValues(Tone.now());
          this.sentinelGain.gain.rampTo(0, 0.5);
      }
  }
}

export const audioService = new AudioService();