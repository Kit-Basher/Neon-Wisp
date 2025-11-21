import React, { useEffect, useRef } from 'react';
import * as Tone from 'tone';

interface MusicSystemProps {
  score: number;
  isLocked: boolean;
  isGameOver: boolean;
}

const MusicSystem: React.FC<MusicSystemProps> = ({ score, isLocked, isGameOver }) => {
  const isInitialized = useRef(false);

  // Retro Instruments
  const bassSynth = useRef<Tone.MonoSynth | null>(null);
  const chordSynth = useRef<Tone.PolySynth | null>(null);
  const leadSynth = useRef<Tone.Synth | null>(null);
  const drumSynth = useRef<Tone.NoiseSynth | null>(null);
  const arpSynth = useRef<Tone.AMSynth | null>(null); // New layer for high-speed arps

  // Effects & Master
  const lowPass = useRef<Tone.Filter | null>(null);
  const bitCrusher = useRef<Tone.BitCrusher | null>(null);
  const distortion = useRef<Tone.Distortion | null>(null);
  const chorus = useRef<Tone.Chorus | null>(null);
  const volume = useRef<Tone.Volume | null>(null);

  const scoreRef = useRef(score);

  // Keep score ref updated for the audio loop
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Initialize Audio Engine
  useEffect(() => {
    if (isInitialized.current) return;

    // --- Master Chain ---
    volume.current = new Tone.Volume(-8).toDestination();
    bitCrusher.current = new Tone.BitCrusher(8).connect(volume.current); 
    distortion.current = new Tone.Distortion(0).connect(bitCrusher.current);
    chorus.current = new Tone.Chorus(4, 2.5, 0.5).connect(distortion.current).start();
    lowPass.current = new Tone.Filter(800, "lowpass").connect(chorus.current);

    // --- 1. BASS (Triangle/Saw Mix for grit) ---
    bassSynth.current = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.1 },
      filterEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.2, baseFrequency: 80, octaves: 4 }
    }).connect(lowPass.current);
    bassSynth.current.volume.value = 2;

    // --- 2. CHORDS (SuperSaw-ish) ---
    chordSynth.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.2, decay: 0.4, sustain: 0.5, release: 1.2 },
    }).connect(lowPass.current);
    chordSynth.current.volume.value = -12;

    // --- 3. LEAD (Pulse/Square) ---
    leadSynth.current = new Tone.Synth({
      oscillator: { type: "pulse", width: 0.5 },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.2 },
      portamento: 0.05
    }).connect(lowPass.current);
    leadSynth.current.volume.value = -5;

    // --- 4. ARP (New Layer for 50+ Score) ---
    arpSynth.current = new Tone.AMSynth({
      harmonicity: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0 }
    }).connect(lowPass.current);
    arpSynth.current.volume.value = -20; // Start quiet

    // --- 5. DRUMS ---
    drumSynth.current = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0 }
    }).connect(lowPass.current);
    drumSynth.current.volume.value = -8;

    // --- SEQUENCER DATA ---
    
    // Progression A: Dark/Epic (Default)
    // Cm - Ab - Bb - G
    const progA = [
      { bass: "C2", chord: ["C4", "Eb4", "G4"], root: "C5" },
      { bass: "Ab1", chord: ["Ab3", "C4", "Eb4"], root: "Ab4" },
      { bass: "Bb1", chord: ["Bb3", "D4", "F4"], root: "Bb4" },
      { bass: "G1", chord: ["G3", "B3", "D4"], root: "G4" },
    ];

    // Progression B: Uplifting/Flying (Unlocks > Score 18)
    // F - G - Eb - Bb (IV - V - bIII - bVII)
    const progB = [
      { bass: "F1", chord: ["F3", "A3", "C4"], root: "F4" },
      { bass: "G1", chord: ["G3", "B3", "D4"], root: "G4" },
      { bass: "Eb1", chord: ["Eb3", "G3", "Bb3"], root: "Eb4" },
      { bass: "Bb1", chord: ["Bb3", "D4", "F4"], root: "Bb4" },
    ];

    const pentatonic = [0, 3, 5, 7, 10, 12, 15, 17];

    let tick = 0;

    Tone.Transport.scheduleRepeat((time) => {
      const s = scoreRef.current;
      const step = tick % 16; 
      const barTotal = Math.floor(tick / 16);
      
      // Determine Progression
      // If Score > 18, swap to B section every 2nd set of 4 bars (Bars 4-7, 12-15, etc.)
      let harmony = progA[barTotal % 4];
      
      if (s > 18) {
        // Switch logic: AAAA (0-3) -> BBBB (4-7)
        const section = Math.floor(barTotal / 4) % 2; 
        if (section === 1) {
             harmony = progB[barTotal % 4];
        }
      }

      // --- BASS ---
      // Base pattern: Beat 0 and 8 (Kick sim).
      // Score > 25: Add syncopated 16ths (Gallop)
      if (step === 0 || step === 8) {
         bassSynth.current?.triggerAttackRelease(harmony.bass, "8n", time);
      } else if (step % 4 === 2) {
         // Offbeat
         bassSynth.current?.triggerAttackRelease(harmony.bass, "16n", time);
      }
      
      // GALLOP RHYTHM (Score > 25)
      if (s > 25) {
          if (step === 11 || step === 15) {
             bassSynth.current?.triggerAttackRelease(harmony.bass, "32n", time, 0.7);
          }
      }
      // OCTAVE DISCO BOUNCE (Score > 65)
      if (s > 65 && (step === 2 || step === 6 || step === 10 || step === 14)) {
         const octaveUp = Tone.Frequency(harmony.bass).transpose(12);
         bassSynth.current?.triggerAttackRelease(octaveUp, "16n", time, 0.8);
      }

      // --- DRUMS ---
      if (s > 3) {
         // Kicks Accent (Score > 10)
         if (s > 10 && (step === 0 || step === 8)) {
            drumSynth.current?.envelope.set({ decay: 0.15 });
            drumSynth.current?.triggerAttackRelease("16n", time, 0.7);
         }
         
         // Snare / Hats
         if (step === 4 || step === 12) {
             // Snare (Longer decay)
             drumSynth.current?.envelope.set({ decay: 0.25 });
             drumSynth.current?.triggerAttackRelease("16n", time, 1);
         } else if (step % 2 === 0) {
             // Closed Hat (Short decay)
             drumSynth.current?.envelope.set({ decay: 0.05 });
             drumSynth.current?.triggerAttackRelease("32n", time, 0.4);
         }

         // BREAKBEAT GHOST NOTES (Score > 45)
         if (s > 45) {
             if (step === 2 || step === 7 || step === 10 || step === 15) {
                 drumSynth.current?.envelope.set({ decay: 0.03 });
                 drumSynth.current?.triggerAttackRelease("32n", time, 0.3);
             }
         }
      }

      // --- CHORDS ---
      if (s > 5) {
          // Standard Pad
          if (step === 0) {
              const dur = s > 50 ? "8n" : "1n"; // Staccato gate at high score
              chordSynth.current?.triggerAttackRelease(harmony.chord, dur, time, 0.6);
          }
          
          // TRANCE GATE RHYTHM (Score > 50)
          if (s > 50 && step % 4 === 2) {
               chordSynth.current?.triggerAttackRelease(harmony.chord, "16n", time, 0.4);
          }
      }

      // --- MELODY (Lead) ---
      if (s > 8) {
          // Phase 1: Simple Melodic Hook
          if (s <= 30) {
               if (step === 0 || step === 3 || step === 6 || step === 10) {
                    let noteIdx = 0;
                    if (step === 3) noteIdx = 1;
                    if (step === 6) noteIdx = 2;
                    // Simple chord tones
                    const note = harmony.chord[noteIdx % 3];
                    const highNote = Tone.Frequency(note).transpose(12);
                    leadSynth.current?.triggerAttackRelease(highNote, "16n", time);
               }
          } 
          // Phase 2: Arpeggio
          else {
               if (step % 2 === 0) {
                    // Arpeggiate the pentatonic scale relative to root
                    const rootMidi = Tone.Frequency(harmony.root).toMidi();
                    // Walk up/down based on tick
                    const interval = pentatonic[(tick % 8)];
                    const note = Tone.Frequency(rootMidi + interval, "midi");
                    leadSynth.current?.triggerAttackRelease(note, "16n", time);
               }
          }
      }
      
      // --- HYPER ARP LAYER (Score > 80) ---
      if (s > 80) {
          if (step % 2 !== 0) {
               const rootMidi = Tone.Frequency(harmony.root).toMidi();
               // Offset arpeggio for chaotic texture
               const note = Tone.Frequency(rootMidi + pentatonic[(tick + 4) % 8] + 24, "midi");
               arpSynth.current?.triggerAttackRelease(note, "32n", time);
          }
      }

      tick++;
    }, "16n");

    isInitialized.current = true;

    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []);

  // Dynamic Mixing & Effects based on Score
  useEffect(() => {
    if (!isInitialized.current) return;

    // 1. Tempo Ramp (110 -> 240 BPM)
    const targetBpm = Math.min(110 + score * 2.5, 240);
    Tone.Transport.bpm.rampTo(targetBpm, 1);

    // 2. Filter Opening (500Hz -> 20kHz)
    // As score increases, sound gets brighter and fuller
    const targetFreq = Math.min(500 + score * 250, 20000);
    lowPass.current?.frequency.rampTo(targetFreq, 0.5);

    // 3. Distortion (Heat)
    // Adds grit as intensity builds (Max 0.4)
    // Fix: distortion.distortion is not a Signal, set directly
    const distAmount = Math.min(score * 0.005, 0.4);
    if (distortion.current) {
        distortion.current.distortion = distAmount;
    }

    // 4. Bitcrusher (Clarity vs Chaos)
    // Fix: bits is not a Signal, set directly
    if (bitCrusher.current) {
        if (score < 80) {
            // Clean up signal as you play (8 -> 16)
            bitCrusher.current.bits = Math.min(16, 8 + (score / 10)); 
        } else {
            // Reality breakdown glitch
            bitCrusher.current.bits = 4; 
        }
    }

    // 5. Arp Volume Fade In
    if (score > 80) {
        arpSynth.current?.volume.rampTo(-10, 1);
    }

  }, [score]);

  // Play/Pause State Logic
  useEffect(() => {
    if (isLocked && !isGameOver) {
      if (Tone.context.state === 'suspended') Tone.start();
      Tone.Transport.start();
      if (volume.current) volume.current.volume.rampTo(-8, 0.5);
    } else {
      Tone.Transport.pause();
    }
  }, [isLocked, isGameOver]);

  return null;
};

export default MusicSystem;