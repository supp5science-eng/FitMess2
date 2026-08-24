// Client-side microphone recorder that yields a 16 kHz mono 16-bit WAV blob.
//
// Why WAV (and not the raw MediaRecorder output): browsers record to different
// containers -- Chrome/Android give webm/opus, iOS Safari gives mp4/aac -- and
// Gemini's inline audio input is only reliably happy with plain formats like
// WAV. So we record with MediaRecorder (broadest capture support), then decode
// the clip with the Web Audio API and re-encode a small mono 16 kHz WAV that
// Gemini accepts everywhere. 16 kHz mono is plenty for speech and keeps the
// upload tiny. Browser-only (getUserMedia / AudioContext); never import server-
// side.

export interface WavRecording {
  /** Stop capture and resolve the recorded speech as a mono 16 kHz WAV blob. */
  stop: () => Promise<Blob>;
  /** Abort without producing a blob (releases the mic). */
  cancel: () => void;
  /**
   * Current input loudness, 0..1, for drawing a live level meter.
   *
   * OPTIONAL on purpose: it needs a live `AudioContext` + `AnalyserNode` on the
   * capture stream, which is one more thing that can fail (an autoplay-policy
   * refusal, a browser without the API) on a path whose entire job is to not
   * get in the way. When it is missing the caller must still record perfectly
   * — it only loses the meter, so treat `undefined` as "no meter", never as an
   * error, and never let a failure here abort a recording.
   */
  level?: () => number;
}

const TARGET_SAMPLE_RATE = 16_000;

/**
 * Starts recording from the default microphone. Must be called from a user
 * gesture (a tap) so the permission prompt / AudioContext are allowed. Rejects
 * if mic access is denied or unavailable.
 */
export async function startWavRecording(): Promise<WavRecording> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("mic-unsupported");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const meter = attachMeter(stream);

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  const releaseMic = () => {
    meter?.close();
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        recorder.onstop = async () => {
          releaseMic();
          try {
            const raw = new Blob(chunks, {
              type: recorder.mimeType || "audio/webm",
            });
            resolve(await blobToWav(raw));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.ondataavailable = null;
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
      releaseMic();
    },
    level: meter?.level,
  };
}

/**
 * Taps the capture stream with an `AnalyserNode` so the UI can show how loud
 * the mic is hearing you.
 *
 * Reads the TIME-DOMAIN buffer and returns its RMS, not the frequency data: a
 * level meter is asking "how loud", and RMS over the waveform is that question
 * answered directly, without an FFT the answer would only have to be summed
 * back out of.
 *
 * Returns `null` if anything at all goes wrong — a browser with no
 * `AudioContext`, a context refused by an autoplay policy. The recording is
 * unaffected either way; this node only listens alongside `MediaRecorder`.
 */
function attachMeter(
  stream: MediaStream
): { level: () => number; close: () => void } | null {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    // Small window: the meter should track syllables, not settle into an
    // average of the whole sentence.
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    ctx.createMediaStreamSource(stream).connect(analyser);
    // Deliberately NOT connected to `ctx.destination` -- routing the mic to the
    // speakers is a feedback loop, and the analyser runs without an output.

    const samples = new Uint8Array(analyser.fftSize);
    let closed = false;

    return {
      level: () => {
        if (closed) return 0;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          // 128 is silence in the unsigned byte encoding.
          const centred = (sample - 128) / 128;
          sum += centred * centred;
        }
        // Speech RMS sits around 0.05-0.25, so the raw value would barely move
        // the meter. The x4 maps a normal speaking voice across most of the
        // range and the clamp keeps a shout from overflowing it.
        return Math.min(1, Math.sqrt(sum / samples.length) * 4);
      },
      close: () => {
        closed = true;
        void ctx.close();
      },
    };
  } catch {
    return null;
  }
}

/** Decode any recorded container and re-encode it as a mono 16 kHz WAV. */
async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) throw new Error("audio-decode-unsupported");

  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return new Blob([encodeWav(decoded, TARGET_SAMPLE_RATE)], {
      type: "audio/wav",
    });
  } finally {
    void ctx.close();
  }
}

/** Downmix to mono, linearly resample to `targetRate`, write a 16-bit WAV. */
function encodeWav(buffer: AudioBuffer, targetRate: number): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;

  // Mixdown to a single mono track.
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  // Linear-interpolation resample to the target rate.
  const ratio = buffer.sampleRate / targetRate;
  const outLength = Math.max(1, Math.floor(length / ratio));
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, length - 1);
    const frac = srcIndex - i0;
    const value = mono[i0] * (1 - frac) + mono[i1] * frac;
    const clamped = Math.max(-1, Math.min(1, value));
    samples[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const dataBytes = samples.length * 2;
  const out = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(out);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true); // byte rate (rate * blockAlign)
  view.setUint16(32, 2, true); // block align (channels * bytesPerSample)
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }
  return out;
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
