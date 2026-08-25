"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { AiOrb } from "@/components/ai/ai-orb";

/**
 * The AI orb, for real this time (2026-08-25 v2): a WebGL fragment-shader
 * sphere in the plate's own inks — a Siri-like living swirl. Domain-warped
 * fbm noise IS the fluid: two noise fields displace a third, dark "venom"
 * veins (ridged noise) carve through the ultramarine, and the whole field
 * spins continuously, faster near the core, so the sphere visibly ROTATES
 * rather than merely shimmering. Sphere shading (a top-left key light, a
 * pale rim, a soft melt into the paper at the silhouette) keeps it reading
 * as a glass ball sitting ON the white page, not a flat texture.
 *
 * three.js is already a dependency (the 3D klon), so this is one
 * orthographic plane + ShaderMaterial — no model, no lights, one draw call.
 *
 * Budget rules:
 * - `prefers-reduced-motion` → ONE frame is rendered (a beautiful still),
 *   then the loop never starts.
 * - The loop stops while the tab is hidden and on unmount; DPR is capped
 *   at 2 so a 3× screen doesn't triple the pixel work.
 * - No WebGL at all (old WebView, blocked canvas) → falls back to the CSS
 *   `AiOrb`, which is also what the bottom nav uses at 20px.
 */

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
    // Centered coords; 2.15 leaves a soft margin for the silhouette melt.
    vec2 p = (vUv - 0.5) * 2.15;
    // A slow breath, so even the outline is never frozen.
    p *= 1.0 + 0.018 * sin(uTime * 0.7);
    float r = length(p);

    // The ROTATION: a constant spin plus a swirl that tightens toward the
    // core and slowly reverses, so the fluid shears instead of rotating as
    // a solid disc.
    float ang = atan(p.y, p.x);
    float swirl = 1.7 * (1.0 - smoothstep(0.0, 1.1, r));
    ang += uTime * 0.22 + swirl * sin(uTime * 0.35 + 1.2);
    vec2 q = vec2(cos(ang), sin(ang)) * r;

    // Domain-warped fbm — the fluid itself.
    vec2 w = vec2(
      fbm(q * 2.4 + uTime * 0.11),
      fbm(q * 2.4 - uTime * 0.08 + 4.7)
    );
    float f = fbm(q * 3.0 + 2.2 * w - uTime * 0.05);
    // Ridged noise -> the dark "venom" veins threading through the ink.
    float veins = 1.0 - abs(2.0 * fbm(q * 4.2 + 3.0 * w + uTime * 0.06) - 1.0);
    veins = pow(veins, 3.0);

    // The plate's inks: deep ink -> ultramarine -> periwinkle -> pale cyan.
    vec3 deep = vec3(0.043, 0.039, 0.36);
    vec3 ultra = vec3(0.184, 0.173, 0.902);
    vec3 peri = vec3(0.42, 0.412, 1.0);
    vec3 cyan = vec3(0.58, 0.82, 0.94);
    vec3 col = mix(deep, ultra, smoothstep(0.12, 0.5, f));
    col = mix(col, peri, smoothstep(0.45, 0.74, f));
    col = mix(col, cyan, smoothstep(0.7, 0.95, f));
    col = mix(col, deep * 0.7, veins * 0.6);

    // Sphere shading: key light upper-left, a specular breath on top of it.
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 n = normalize(vec3(p, z + 0.32));
    float light = clamp(dot(n, normalize(vec3(-0.45, 0.55, 0.72))), 0.0, 1.0);
    col *= 0.7 + 0.52 * light;
    col += vec3(0.88, 0.93, 1.0) * pow(light, 6.0) * 0.32;
    // Pale rim, so the edge catches the page's light before melting.
    float rim = smoothstep(0.55, 1.0, r);
    col = mix(col, vec3(0.64, 0.82, 0.97), rim * 0.42);

    // Solid core, soft dissolve at the silhouette.
    float alpha = 1.0 - smoothstep(0.85, 1.06, r);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function AiOrbCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

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
      setWebglFailed(true);
      return;
    }
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: { uTime: { value: 0 } },
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
      material.uniforms.uTime!.value = (now - start) / 1000;
      renderer.render(scene, camera);
    }
    function loop(now: number) {
      if (!running) return;
      renderFrame(now);
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
      className={className}
    />
  );
}
