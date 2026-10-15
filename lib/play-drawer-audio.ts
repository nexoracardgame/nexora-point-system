let context: AudioContext | null = null;

export function playDrawerSound() {
  try {
    if (localStorage.getItem("triad-battle-muted") === "1") return;
    context ||= new AudioContext();
    void context.resume();
    const now = context.currentTime;
    const buffer = context.createBuffer(1, context.sampleRate * .38, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = (Math.random() * 2 - 1);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + .25);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.055, now + .07);
    gain.gain.exponentialRampToValueAtTime(.001, now + .38);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
    source.stop(now + .4);
    const tone = context.createOscillator();
    const toneGain = context.createGain();
    tone.frequency.setValueAtTime(740, now + .15);
    tone.frequency.exponentialRampToValueAtTime(1110, now + .32);
    toneGain.gain.setValueAtTime(.012, now + .15);
    toneGain.gain.exponentialRampToValueAtTime(.001, now + .45);
    tone.connect(toneGain).connect(context.destination);
    tone.start(now + .15);
    tone.stop(now + .45);
  } catch { /* Audio must never block opening PLAY. */ }
}
