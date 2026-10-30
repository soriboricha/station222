// Talks to the speech container (speech/server.py): Whisper for the player's voice, Kokoro for NPC replies.
const SPEECH = "/speech";
const STT_RATE = 16000;
const MAX_TTS_CHARS = 400;
export const MAX_RECORD_MS = 30000;

// Whisper wants 16 kHz mono WAV; the browser records webm/ogg/mp4 at the mic's own rate.
async function toWav16k(blob) {
  const ctx = new AudioContext();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close();
  }
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * STT_RATE), STT_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, STT_RATE, true);
  view.setUint32(28, STT_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return { wav: new Blob([view], { type: "audio/wav" }), seconds: decoded.duration };
}

// Drop *stage directions*, then cut to the service's limit at a sentence end where possible.
function speakable(text) {
  let clean = text.replace(/\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length > MAX_TTS_CHARS) {
    const cut = clean.slice(0, MAX_TTS_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    clean = end > 80 ? cut.slice(0, end + 1) : cut;
  }
  return clean;
}

export class Voice {
  constructor() {
    this.available = false;
    this.stream = null;
    this.recorder = null;
    this.audio = null;
    this.speakId = 0;
  }

  async checkHealth() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return false;
    try {
      const res = await fetch(`${SPEECH}/health`);
      this.available = res.ok && (await res.json()).ready === true;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  async startRecording() {
    this.stream ??= await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const chunks = [];
    const recorder = new MediaRecorder(this.stream);
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    this.stopped = new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    });
    recorder.start();
    this.recorder = recorder;
  }

  // Resolves to the transcribed text, or "" when nothing usable was said.
  async stopAndTranscribe() {
    if (!this.recorder) return "";
    this.recorder.stop();
    this.recorder = null;
    const blob = await this.stopped;
    if (!blob.size) return "";
    const { wav, seconds } = await toWav16k(blob);
    if (seconds < 0.3) return "";
    const res = await fetch(`${SPEECH}/stt`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
    if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
    return (await res.json()).text.trim();
  }

  // Lets the browser drop its "microphone in use" indicator between conversations.
  releaseMic() {
    if (this.recorder) this.recorder.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  async speak(text, voice) {
    this.stopSpeaking();
    const id = this.speakId;
    const clean = speakable(text);
    if (!clean) return;
    const res = await fetch(`${SPEECH}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, voice }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    // The player may have spoken again, or left, while this was synthesizing.
    if (id !== this.speakId) return URL.revokeObjectURL(url);
    this.audio = new Audio(url);
    this.audio.onended = () => URL.revokeObjectURL(url);
    await this.audio.play();
  }

  stopSpeaking() {
    this.speakId++;
    this.audio?.pause();
    this.audio = null;
  }
}
