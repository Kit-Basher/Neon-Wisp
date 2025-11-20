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
  
  // Effects & Master
  const lowPass = useRef<Tone.Filter | null>(null);
  const bitCrusher = useRef<Tone.BitCrusher | null>(null);
  const volume = useRef<Tone.Volume | null>(null);
  
  const scoreRef = useRef(score);

  // Keep score ref updated for the audio loop
  useEffect(() => {
      scoreRef.current = score;
  }, [score]);
  
  // Initialize Audio Engine
  useEffect(() => {
    if (isInitialized.current) return;

    // --- Master Chain (The "SNES" Output) ---
    volume.current = new Tone.Volume(-8).toDestination();
    bitCrusher.current = new Tone.BitCrusher(4).connect(volume.current); 
    lowPass.current = new Tone.Filter(2000, "lowpass").connect(bitCrusher.current);

    // --- 1. BASS (Triangle Wave - Smooth NES Bass) ---
    bassSynth.current = new Tone.MonoSynth({
      oscillator: { type: "triangle" }, 
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.1 },
      filterEnvelope: { attack: 0.02, decay: 0.5, sustain: 0.5, baseFrequency: 100, octaves: 3 }
    }).connect(lowPass.current);
    // BOOST BASS: Volume set to 6 for maximum rumble
    bassSynth.current.volume.value = 6; 

    // --- 2. CHORDS (Sawtooth - 16-bit Strings) ---
    chordSynth.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" }, 
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.8 },
    }).connect(lowPass.current);
    chordSynth.current.volume.value = -10; 

    // --- 3. LEAD (Pulse/Square - Classic Beep) ---
    leadSynth.current = new Tone.Synth({
      oscillator: { type: "pulse", width: 0.5 }, 
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.2 },
      portamento: 0.02 // Slight slide for expressive feel
    }).connect(lowPass.current);
    leadSynth.current.volume.value = -6;

    // --- 4. DRUMS (White Noise) ---
    drumSynth.current = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0 }
    }).connect(lowPass.current);
    drumSynth.current.volume.value = -8;

    // --- Sequencer Logic (Cyberpunk Chiptune) ---
    
    const progression = [
        { bass: "C2", chord: ["C4", "Eb4", "G4"], root: "C5" },
        { bass: "Ab1", chord: ["Ab3", "C4", "Eb4"], root: "Ab4" },
        { bass: "Bb1", chord: ["Bb3", "D4", "F4"], root: "Bb4" },
        { bass: "G1",  chord: ["G3", "B3", "D4"], root: "G4" },
    ];

    const arpNotes = [0, 7, 12, 7, 0, 7, 12, 7]; 

    let tick = 0;

    Tone.Transport.scheduleRepeat((time) => {
        const s = scoreRef.current;
        const step = tick % 16; // 16 steps per bar
        const bar = Math.floor(tick / 16) % 4;
        const harmony = progression[bar];

        // --- LAYER 1: KICK & BASS (Always On) ---
        // Pseudo-Kick using Bass Synth drop
        if (step === 0 || step === 8) {
             bassSynth.current?.triggerAttackRelease(harmony.bass, "8n", time);
        } 
        // Rolling bassline on off-beats
        else if (step % 4 === 2) {
             bassSynth.current?.triggerAttackRelease(harmony.bass, "16n", time);
        }

        // --- LAYER 2: NOISE PERCUSSION (Enters Score > 3) ---
        if (s > 3) {
            // Hi-Hats (Short noise ticks on off-beats)
            if (step % 4 === 2) {
                drumSynth.current?.envelope.set({ decay: 0.05 });
                drumSynth.current?.triggerAttackRelease("32n", time, 0.5);
            }
            // Snare (Longer noise on beats 2 and 4)
            if (step === 4 || step === 12) {
                drumSynth.current?.envelope.set({ decay: 0.2 });
                drumSynth.current?.triggerAttackRelease("16n", time, 1);
            }
            
            // PHASE 3: HYPER DRUMS (Score > 45)
            // Add driving 16th notes to the hi-hats
            if (s > 45) {
                if (step % 2 !== 0 && step % 4 !== 2) {
                    drumSynth.current?.envelope.set({ decay: 0.03 });
                    drumSynth.current?.triggerAttackRelease("32n", time, 0.3);
                }
            }
        }

        // --- LAYER 3: CHORDS (Enters Score > 10) ---
        if (s > 10) {
            if (step === 0) {
                chordSynth.current?.triggerAttackRelease(harmony.chord, "2n", time);
            }
            if (s > 30 && step === 8) {
                chordSynth.current?.triggerAttackRelease(harmony.chord, "8n", time);
            }
        }

        // --- LAYER 4: LEAD MELODY (Enters Score > 8) ---
        if (s > 8) {
            // PHASE 1: MELODIC HOOK (Score 8 - 25)
            // A catchy syncopated rhythm to be less repetitive
            if (s <= 25) {
                 // Pattern: Hit on 0, 3, 6, 10, 12 (Dotted 8th feel)
                 if (step === 0 || step === 3 || step === 6 || step === 10 || step === 12) {
                     // Choose notes from the chord to form a melody
                     // 0: Root, 3: 3rd, 6: 5th, 10: Octave, 12: 5th down
                     let note;
                     const chord = harmony.chord;
                     if (step === 0) note = chord[0]; 
                     else if (step === 3) note = chord[1];
                     else if (step === 6) note = chord[2];
                     else if (step === 10) note = Tone.Frequency(chord[0]).transpose(12);
                     else note = chord[1];
                     
                     // Make it sing by transposing up an octave
                     const highNote = Tone.Frequency(note).transpose(12);
                     leadSynth.current?.triggerAttackRelease(highNote, "16n", time);
                 }
            } 
            // PHASE 2: TURBO ARPEGGIO (Score > 25)
            // High intensity constant run
            else {
                if (step % 2 === 0) {
                    const noteInterval = arpNotes[(tick % 8)];
                    let octaveOffset = 0;
                    
                    // PHASE 4: MANIC ARPEGGIO (Score > 60)
                    // Jump up an octave in the second half of the bar for frantic feel
                    if (s > 60 && step >= 8) {
                        octaveOffset = 12;
                    }
                    
                    const baseNote = Tone.Frequency(harmony.bass).toMidi();
                    const finalNote = Tone.Frequency(baseNote + noteInterval + 24 + octaveOffset, "midi").toNote(); 
                    
                    leadSynth.current?.triggerAttackRelease(finalNote, "16n", time);
                }
            }
        }
        
        // PHASE 5: SYSTEM INSTABILITY (Score > 90)
        // Detune the bass slightly to create tension
        if (s > 90) {
             const detuneAmount = Math.sin(time) * 20;
             bassSynth.current?.set({ detune: detuneAmount });
        }

        tick++;
    }, "16n");

    isInitialized.current = true;

    return () => {
        Tone.Transport.stop();
        Tone.Transport.cancel();
    };
  }, []);

  // Dynamic Intensity
  useEffect(() => {
      if (!isInitialized.current) return;
      
      // Tempo Ramp: 110 -> 220 (Extended range for infinite feel)
      const targetBpm = Math.min(110 + score * 2, 220);
      Tone.Transport.bpm.rampTo(targetBpm, 2);

      if (lowPass.current) {
          // Filter opens up higher (up to 15kHz)
          const targetFreq = Math.min(2000 + score * 300, 15000);
          lowPass.current.frequency.rampTo(targetFreq, 0.5);
      }
      
      if (bitCrusher.current) {
          const bits = Math.min(4 + Math.floor(score / 10), 8);
          bitCrusher.current.bits.value = bits; 
      }

  }, [score]);

  // Play/Pause State
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