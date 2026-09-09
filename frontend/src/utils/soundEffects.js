/**
 * Sound effects utility for Athreya quick commerce.
 * Uses Web Audio API to synthesize instant, zero-latency, zero-dependency sound effects.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a sparkling, joyful celebratory coin / reward fanfare chime.
 * Synthesizes a golden ascending victory arpeggio:
 * C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz) -> E6 (1318Hz) with dual high-frequency coin sparkle.
 */
export function playCoinSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master gain for comfortable volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, now);
    masterGain.connect(ctx.destination);

    // Celebratory victory chord progression
    const notes = [
      { freq: 523.25, time: 0, dur: 0.35, gain: 0.5, type: "sine" },
      { freq: 659.25, time: 0.08, dur: 0.35, gain: 0.6, type: "sine" },
      { freq: 783.99, time: 0.16, dur: 0.4, gain: 0.7, type: "sine" },
      { freq: 1046.50, time: 0.24, dur: 0.55, gain: 0.85, type: "sine" },
      { freq: 1318.51, time: 0.32, dur: 0.7, gain: 0.9, type: "sine" },
      // High harmonic coin chime sparkles
      { freq: 2093.00, time: 0.35, dur: 0.5, gain: 0.3, type: "triangle" },
      { freq: 2637.02, time: 0.42, dur: 0.65, gain: 0.25, type: "triangle" },
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      noteGain.gain.setValueAtTime(0.001, now + note.time);
      noteGain.gain.exponentialRampToValueAtTime(note.gain, now + note.time + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.dur);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.dur);
    });
  } catch (err) {
    console.debug("Audio play skipped:", err);
  }
}

export default {
  playCoinSound,
};
