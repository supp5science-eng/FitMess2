"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The klon in three dimensions -- the thing the whole avatar idea rests on:
 * a figure you turn with your finger, like picking a character in a game.
 *
 * Under `/admin` on purpose. This is a LOOK, not a feature: the model it shows
 * is one klon built from one person's photos on 24.08.2026, hosted where the
 * generator left it. Nothing here is per-user yet, and nothing is stored.
 *
 * Everything is dynamically imported inside the effect. `three` is ~600KB and
 * this page must not put a byte of it in any shared chunk -- Početna is the
 * hottest screen in the app and has been made fast the hard way.
 */
export function Klon3DView({ models }: { models: { label: string; url: string }[] }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<string>("Učitavam...");
  const [spinning, setSpinning] = useState(true);
  const spinningRef = useRef(true);

  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      const { OrbitControls } = await import(
        "three/examples/jsm/controls/OrbitControls.js"
      );
      if (disposed) return;

      const width = mount.clientWidth;
      const height = mount.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 2.2));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2);
      keyLight.position.set(2, 3, 4);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0xaaccff, 1.1);
      rimLight.position.set(-3, 2, -3);
      scene.add(rimLight);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      // Panning with one finger on a phone fights the page scroll and leaves
      // the figure somewhere off-screen with no way back.
      controls.enablePan = false;

      let figure: import("three").Object3D | null = null;

      new GLTFLoader().load(
        models[current].url,
        (gltf) => {
          if (disposed) return;
          figure = gltf.scene;
          const box = new THREE.Box3().setFromObject(figure);
          const size = box.getSize(new THREE.Vector3());
          figure.position.sub(box.getCenter(new THREE.Vector3()));
          camera.position.set(0, 0, Math.max(size.x, size.y, size.z) * 2.3);
          controls.target.set(0, 0, 0);
          controls.update();
          scene.add(figure);
          setStatus("");
        },
        (event) => {
          if (event.total) {
            setStatus(`Učitavam... ${Math.round((event.loaded / event.total) * 100)}%`);
          }
        },
        () => setStatus("Model nije uspeo da se učita.")
      );

      let frame = 0;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (figure && spinningRef.current) figure.rotation.y += 0.005;
        controls.update();
        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", onResize);
        controls.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [current, models]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={mountRef}
        className="h-[70vh] w-full touch-none rounded-2xl bg-muted"
      />
      {status ? (
        <p className="text-center text-sm text-muted-foreground">{status}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {models.map((model, index) => (
          <button
            key={model.url}
            type="button"
            onClick={() => setCurrent(index)}
            className={`min-h-11 rounded-xl px-4 text-sm ${
              index === current
                ? "bg-foreground text-background"
                : "bg-muted text-foreground"
            }`}
          >
            {model.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSpinning((value) => !value)}
          className="min-h-11 rounded-xl bg-muted px-4 text-sm text-foreground"
        >
          {spinning ? "Zaustavi" : "Okreći"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Prevuci prstom da ga okreneš. Štipni da zumiraš.
      </p>
    </div>
  );
}
