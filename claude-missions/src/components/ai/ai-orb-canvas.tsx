"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { AiOrb } from "@/components/ai/ai-orb";

/**
 * The AI orb, for real this time (2026-08-25 v2): a WebGL fragment-shader
 * sphere in the plate's own inks — a Siri-like living swirl. Domain-warped
 * fbm noise IS the fluid, dark "venom" veins (ridged noise) carve through
 * the ultramarine, and sphere shading (a top-left key light, a soft melt
 * into the paper at the silhouette) keeps it reading as a ball sitting ON
 * the white page, not a flat texture.
 *
 * v3 (2026-08-26, glasovni razgovor): the orb is now Prizma's FACE. It takes
 * a `mode` and, while LISTENING, the live mic level (`getLevel`) — the swirl
 * swells and brightens on the user's own voice, THINKING tightens and speeds
 * the flow, SPEAKING pulses on a speech-like envelope with a ripple running
 * through the fluid. All of it rides three uniforms (energy / flow-clock /
 * speak) smoothed in JS, so states melt into each other instead of snapping.
 * The activity-scaled clock is integrated on the CPU (`flow += dt * rate`) —
 * multiplying `uTime` by a changing rate in the shader would make the whole
 * fluid jump, because the accumulated phase rescales with it.
 *
 * v4 (2026-08-26): it was a wheel, not a liquid. v2/v3 spun the whole field
 * about the centre, and a constant angular term is exactly what the eye
 * reads as a texture on a turning disc. That term is GONE. The ink now
 * boils in place: three chained domain warps, each drifting on its own
 * current, pushed through a hard contrast curve so the colour settles into
 * broad marbled pools threaded with hair-thin filaments. Two consequences
 * fall out of that curve and are handled in the shader, not papered over:
 * fbm's lowest octave wanders, which would swing the whole orb pale or
 * near-black, so the field is high-passed against that exact octave.
 *
 * v5 (2026-08-26): v4 burnt the ink out to paper white at the silhouette,
 * which looked right on the black-backed reference clip and disappeared on
 * our white page — the circle had no edge to start at. The burn is now the
 * TURN of a sphere instead of a ring: white only where the key light grazes
 * the shoulder, deep ink where it turns away, and a contour closing the
 * circle so the lit side has an edge too. The orb reads as a marble sitting
 * on the paper rather than a disc dissolving into it.
 *
 * three.js is already a dependency (the 3D klon), so this is one
 * orthographic plane + ShaderMaterial — no model, no lights, one draw call.
 *
 * Budget rules:
 * - `prefers-reduced-motion` → ONE frame is rendered (a beautiful still),
 *   then the loop never starts (voice states stay still too — that is the
 *   user's explicit wish).
 * - The loop stops while the tab is hidden and on unmount; DPR is capped
 *   at 2 so a 3× screen doesn't triple the pixel work.
 * - No WebGL at all (old WebView, blocked canvas) → falls back to the CSS
 *   `AiOrb`, which is also what the bottom nav uses at 20px.
 */

export type AiOrbMode = "idle" | "listening" | "thinking" | "speaking";

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  // The activity-scaled flow clock: equals uTime at rest, runs faster while
  // the orb listens/thinks/speaks. Integrated CPU-side to stay continuous.
  uniform float uFlow;
  // Live loudness 0..1 — the mic while listening, a speech envelope while
  // speaking, a quiet simmer while thinking.
  uniform float uEnergy;
  // 1 while speaking: gates the ripple that runs through the fluid.
  uniform float uSpeak;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Centered coords; 2.05 leaves the margin the silhouette melts into.
    vec2 p = (vUv - 0.5) * 2.05;
    // Voice swell: the sphere grows into its margin as energy rises.
    p /= 1.0 + 0.10 * uEnergy;
    // A slow breath, so even the outline is never frozen; energy deepens it.
    p *= 1.0 + (0.018 + 0.045 * uEnergy) * sin(uFlow * 0.7);
    float r = length(p);

    // THE FLUID. Three chained domain warps: each layer's fbm displaces the
    // sample point of the next, and every layer drifts on its own slow,
    // incommensurate current. That is what makes the ink BOIL and curl in
    // place — no angular term anywhere, because a constant spin reads as a
    // texture on a turning wheel, not as a liquid (see the header).
    float t = uFlow;
    vec2 q = p * 1.05;
    vec2 w1 = vec2(
      fbm(q + vec2(0.00, 0.30) * t),
      fbm(q + vec2(-0.26, 0.13) * t + 5.2)
    );
    vec2 w2 = vec2(
      fbm(q + 3.1 * w1 + vec2(0.14, -0.22) * t + 1.7),
      fbm(q + 3.1 * w1 + vec2(-0.17, -0.12) * t + 8.3)
    );
    vec2 fp = q + 4.2 * w2 + 0.09 * t;
    // High-pass. fbm's lowest octave is half its amplitude, so left alone it
    // walks the whole sphere bright or dark together and the contrast curve
    // below turns that into a washed-out or near-black orb. Subtracting most
    // of THAT EXACT octave — noise(fp) is the term fbm itself starts from —
    // then rescaling to 0..1 pins the average while keeping enough of the big
    // sweep for the ink to still pool in large pours.
    float f = (fbm(fp) - 0.42 * noise(fp)) / 0.549;
    // While speaking, a ripple runs outward through the ink in speech rhythm.
    f += uSpeak * (0.04 + 0.09 * uEnergy) * sin(r * 22.0 - uTime * 6.5);
    // Marbling, not smoke: the field is pushed through a hard contrast curve
    // so the ink settles into broad flat pools instead of an even haze, the
    // way poured colour actually behaves.
    f = smoothstep(0.30, 0.70, f);
    // Ridged noise, twice: fat dark "venom" veins, and hair-thin bright
    // filaments riding the same warp — the threads that read as marbling.
    float ridge = 1.0 - abs(2.0 * fbm(q * 1.9 + 2.6 * w2 + 0.12 * t) - 1.0);
    float veins = pow(ridge, 4.0);
    float filament = pow(ridge, 30.0);

    // The plate's inks. The floor is a deep but still SATURATED blue, never
    // near-black: the true darks are spent on the veins alone, so a dark
    // stretch of fluid reads as ink pooling, not as the orb switching off.
    vec3 deep = vec3(0.086, 0.078, 0.55);
    vec3 ultra = vec3(0.196, 0.184, 0.925);
    vec3 peri = vec3(0.47, 0.46, 1.0);
    vec3 pale = vec3(0.70, 0.88, 1.0);
    vec3 col = mix(deep, ultra, smoothstep(0.08, 0.44, f));
    col = mix(col, peri, smoothstep(0.62, 0.86, f));
    col = mix(col, pale, smoothstep(0.88, 1.00, f));
    col = mix(col, vec3(0.030, 0.027, 0.20), veins * 0.45);
    col = mix(col, vec3(0.84, 0.90, 1.0), filament * 0.35);

    // Sphere shading: key light upper-left, a specular breath on top of it.
    // Deliberately shallow — poured ink glows, it does not sit in shadow,
    // and a heavy terminator would eat the white shoulder on the dark side.
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 n = normalize(vec3(p, z + 0.32));
    float light = clamp(dot(n, normalize(vec3(-0.45, 0.55, 0.72))), 0.0, 1.0);
    col *= 0.88 + 0.28 * light;
    col += vec3(0.88, 0.93, 1.0) * pow(light, 6.0) * 0.28;
    // Loudness lights the ink from within.
    col *= 1.0 + 0.20 * uEnergy;

    // THE TURN OF THE SPHERE. A ball reads as round because the light does
    // NOT wrap it evenly: the shoulder facing the key light burns to paper
    // white, the shoulder turning away sinks into ink. An even ring of white
    // all the way round reads as a decal pasted onto a flat disc instead.
    float turn = smoothstep(0.66, 0.995, r);
    col = mix(col, vec3(1.0), turn * pow(light, 1.4) * 0.80);
    col = mix(col, vec3(0.106, 0.098, 0.55), turn * (1.0 - light) * 0.85);
    // ...and a contour closes the circle. The lit shoulder is white and so is
    // the page, so without this the orb has no edge to start at on that side
    // — which is the whole reason the ink is not allowed to burn out fully.
    float contour = smoothstep(0.88, 0.985, r);
    col = mix(col, vec3(0.22, 0.21, 0.72), contour * 0.8);

    // The silhouette is a clean circle now, so the fade is only wide enough
    // to keep it from stair-stepping. It pulls inward by exactly what the
    // voice swell pushed out, so a shouting user cannot inflate the sphere
    // past the canvas and leave a straight cut across it.
    float alpha = 1.0 - smoothstep(0.955 - 0.06 * uEnergy, 0.99 - 0.06 * uEnergy, r);
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Speech-shaped pseudo-envelope for the SPEAKING state: syllable flutter
 * under a slower phrase wave. `speechSynthesis` gives no audio tap, so the
 * mouth movement is composed, not measured — three incommensurate sines read
 * as talking, one alone reads as a metronome. */
function speechEnvelope(seconds: number): number {
  const syllables = Math.abs(Math.sin(seconds * 3.4));
  const phrase = 0.55 + 0.45 * Math.sin(seconds * 1.05);
  const flutter = 0.12 * Math.sin(seconds * 7.9);
  return Math.min(1, Math.max(0, 0.26 + 0.34 * syllables * phrase + flutter));
}

export function AiOrbCanvas({
  className,
  mode = "idle",
  getLevel,
}: {
  className?: string;
  /** What Prizma is doing right now — drives the swirl's temperament. */
  mode?: AiOrbMode;
  /** Live loudness 0..1 — the mic while LISTENING (`WavRecording.level`),
   * the TTS playback while SPEAKING (`TtsPlayback.level`; -1 means "no tap,
   * use the composed envelope"). Optional: without it, listening falls back
   * to a steady attentive glow and speaking to the envelope. */
  getLevel?: () => number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  // The render loop lives in a []-effect; the latest props reach it through
  // this ref so state changes never rebuild the renderer.
  const stateRef = useRef<{ mode: AiOrbMode; getLevel?: () => number }>({
    mode,
    getLevel,
  });
  useEffect(() => {
    stateRef.current.mode = mode;
    stateRef.current.getLevel = getLevel;
  }, [mode, getLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      // Deferred a tick so the fallback swap is its own render pass rather
      // than a synchronous setState inside the effect body.
      queueMicrotask(() => setWebglFailed(true));
      return;
    }
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uFlow: { value: 0 },
        uEnergy: { value: 0 },
        uSpeak: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    const reduce =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    let raf = 0;
    let running = false;
    const start = performance.now();

    // Smoothed animation state (see the header): energy snaps up with the
    // voice and releases slowly; activity/speak ease both ways; flow is the
    // integrated activity-scaled clock.
    let prevNow = start;
    let flow = 12; // matches the reduced-motion still frame's mid-swirl phase
    let energy = 0;
    let activity = 0;
    let speak = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setSize(
        Math.max(1, Math.round(rect.width * dpr)),
        Math.max(1, Math.round(rect.height * dpr)),
        false
      );
    }

    function renderFrame(now: number) {
      const dt = Math.min(Math.max((now - prevNow) / 1000, 0), 0.1);
      prevNow = now;
      const seconds = (now - start) / 1000;

      const current = stateRef.current;
      let targetEnergy = 0;
      let targetActivity = 0;
      let targetSpeak = 0;
      if (current.mode === "listening") {
        targetActivity = 0.45;
        targetEnergy = current.getLevel ? current.getLevel() : 0.3;
      } else if (current.mode === "thinking") {
        targetActivity = 1;
        targetEnergy = 0.22;
      } else if (current.mode === "speaking") {
        targetActivity = 0.7;
        targetSpeak = 1;
        // ElevenLabs playback reports the REAL loudness (>= 0); system TTS
        // has no audio tap and returns -1, so the composed envelope steps in.
        const live = current.getLevel ? current.getLevel() : -1;
        targetEnergy = live >= 0 ? live : speechEnvelope(seconds);
      }
      energy += (targetEnergy - energy) * (targetEnergy > energy ? 0.5 : 0.12);
      activity += (targetActivity - activity) * 0.08;
      speak += (targetSpeak - speak) * 0.15;
      flow += dt * (1 + 2.5 * activity);

      material.uniforms.uTime!.value = seconds;
      material.uniforms.uFlow!.value = flow;
      material.uniforms.uEnergy!.value = energy;
      material.uniforms.uSpeak!.value = speak;
      renderer.render(scene, camera);
    }
    // ~30fps cap: for a slow fluid the eye can't tell, and with the orb now
    // living in the bottom nav (visible on EVERY screen, always turning) the
    // halved GPU duty cycle is what keeps it battery-polite.
    let lastFrame = 0;
    function loop(now: number) {
      if (!running) return;
      if (now - lastFrame >= 33) {
        lastFrame = now;
        renderFrame(now);
      }
      raf = requestAnimationFrame(loop);
    }
    function startLoop() {
      if (running || reduce?.matches) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stopLoop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    function onVisibility() {
      if (document.hidden) stopLoop();
      else startLoop();
    }

    resize();
    // Reduced motion: one still frame mid-swirl, then silence.
    renderFrame(start + 12_000);
    prevNow = start;
    startLoop();

    const ro = new ResizeObserver(() => {
      resize();
      if (!running) renderFrame(performance.now());
    });
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    reduce?.addEventListener("change", onVisibility);

    return () => {
      stopLoop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduce?.removeEventListener("change", onVisibility);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return <AiOrb hero className={className} />;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="ai-orb-canvas"
      data-orb-mode={mode}
      className={className}
    />
  );
}
