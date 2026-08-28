"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { downscaleImage } from "@/lib/image/downscale";
import {
  buildOkretKadarPrompt,
  buildOkretVideoPrompt,
  MAX_OKRET_SLIKA,
  MIN_OKRET_SLIKA,
  okretVremenaFrejmova,
  proveriBrojSlika,
} from "@/lib/avatar/okret-prompt";

/**
 * Klupa za testiranje okreta.
 *
 * Postoji da bi se jedno pitanje odgovorilo GLEDANJEM umesto raspravom: da li
 * avatar koji se okreće izgleda dovoljno dobro da ide na početni ekran. Sve u
 * njoj je podređeno tome da se taj krug -- promeni tekst, pusti, pogledaj --
 * zatvori za minut, bez deploya.
 *
 * Tri stvari koje nisu ukras nego razlog zbog kog klupa postoji:
 *
 * 1. KORACI SU ODVOJENI I NAPLAĆUJU SE ODVOJENO. Kadar je jeftin, orbit je
 *    skup. Šablon se dotera na kadru, pa se tek onda plati video.
 * 2. PROMPT SE MENJA OVDE. Konstanta u `okret-prompt.ts` ostaje izvor istine za
 *    korisnički tok, ali doterivanje teksta kroz deploy traje danima.
 * 3. FREJMOVI SE SEKU U PREGLEDAČU. Video stiže sa našeg porekla, pa `<canvas>`
 *    sme da ga čita. Nikakav ffmpeg, nikakva nova zavisnost, i tačno onaj
 *    osećaj prevlačenja koji će imati i nativna aplikacija.
 */

const MAX_DIM = 768;
const KVALITET = 0.85;
/** Koliko frejmova se seče. Ne utiče na cenu -- video je već plaćen. */
const PODRAZUMEVANO_FREJMOVA = 19;

type Slika = { id: string; file: File; url: string };

type Faza =
  | { vrsta: "mirno" }
  | { vrsta: "kadar" }
  | { vrsta: "orbit"; od: number }
  | { vrsta: "secem" };

export function OkretBench({ videoModeli }: { videoModeli: string[] }) {
  const [slike, setSlike] = useState<Slika[]>([]);
  const [saPortretom, setSaPortretom] = useState(true);

  const [promptKadra, setPromptKadra] = useState("");
  const [promptVidea, setPromptVidea] = useState("");
  const [stepeni, setStepeni] = useState(180);
  const [rezolucija, setRezolucija] = useState<"720p" | "1080p">("720p");
  const [model, setModel] = useState("");
  const [brojFrejmova, setBrojFrejmova] = useState(PODRAZUMEVANO_FREJMOVA);

  const [faza, setFaza] = useState<Faza>({ vrsta: "mirno" });
  const [greska, setGreska] = useState<string | null>(null);
  const [detalj, setDetalj] = useState<string | null>(null);

  const [slikaKadra, setSlikaKadra] = useState<{ b64: string; mime: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frejmovi, setFrejmovi] = useState<string[]>([]);

  const radi = faza.vrsta !== "mirno";

  /* ---------------------------------------------------------------- */
  /* Slike                                                             */
  /* ---------------------------------------------------------------- */

  function dodaj(list: FileList | null) {
    if (!list) return;
    const nove = Array.from(list)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, MAX_OKRET_SLIKA - slike.length)
      .map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
      }));
    setSlike((prev) => [...prev, ...nove]);
  }

  function izbaci(id: string) {
    setSlike((prev) => {
      const pogodjena = prev.find((item) => item.id === id);
      if (pogodjena) URL.revokeObjectURL(pogodjena.url);
      return prev.filter((item) => item.id !== id);
    });
  }

  // Objekt-URL-ovi su jedina stvar u ovoj komponenti koja curi ako se zaboravi.
  useEffect(() => {
    return () => {
      slike.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /* Korak 1 -- kadar                                                  */
  /* ---------------------------------------------------------------- */

  async function napraviKadar() {
    const broj = proveriBrojSlika(slike.length);
    if (!broj.ok) {
      setGreska(broj.error_sr);
      return;
    }

    setGreska(null);
    setDetalj(null);
    setFaza({ vrsta: "kadar" });
    // Novi kadar poništava sve što je iz starog izvedeno -- inače se lako gleda
    // orbit napravljen od prethodne slike i misli da je od ove.
    setVideoUrl(null);
    setFrejmovi([]);

    try {
      const form = new FormData();
      form.set("portret", saPortretom ? "1" : "0");
      if (promptKadra.trim()) form.set("prompt", promptKadra.trim());
      for (const item of slike) {
        const mala = await downscaleImage(item.file, MAX_DIM, KVALITET);
        form.append("slike", mala, item.file.name.replace(/\.\w+$/, ".jpg"));
      }

      const res = await fetch("/api/admin/okret/kadar", {
        method: "POST",
        body: form,
      });
      const json = await res.json();

      if (!json.ok) {
        setGreska(json.error_sr ?? "Nije uspelo.");
        setDetalj(json.detalj ?? null);
        return;
      }
      setSlikaKadra({ b64: json.slika, mime: json.mime });
      // Tekst koji je STVARNO poslat se vraća u polje: sledeći pokušaj kreće od
      // onoga što je proizvelo ovu sliku, a ne od prazne konstante.
      setPromptKadra(json.prompt ?? "");
    } catch (err) {
      setGreska("Zahtev je pao.");
      setDetalj(String(err).slice(0, 400));
    } finally {
      setFaza({ vrsta: "mirno" });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Korak 2 -- orbit (zakaži, pa pitaj)                               */
  /* ---------------------------------------------------------------- */

  async function napraviOrbit() {
    if (!slikaKadra) return;

    setGreska(null);
    setDetalj(null);
    setFrejmovi([]);
    setVideoUrl(null);
    const pocetak = Date.now();
    setFaza({ vrsta: "orbit", od: pocetak });

    try {
      const start = await fetch("/api/admin/okret/orbit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korak: "start",
          slika: slikaKadra.b64,
          mime: slikaKadra.mime,
          prompt: promptVidea.trim() || undefined,
          stepeni,
          rezolucija,
          model: model || undefined,
        }),
      });
      const pokrenut = await start.json();
      if (!pokrenut.ok) {
        setGreska(pokrenut.error_sr ?? "Orbit nije pokrenut.");
        setDetalj(pokrenut.detalj ?? null);
        setFaza({ vrsta: "mirno" });
        return;
      }
      setPromptVidea(pokrenut.prompt ?? "");

      // Petlja je OVDE, a ne na serveru: Veo ume da radi minutima, a serverless
      // funkcija bi se presekla i to bi izgledalo kao da model ne radi.
      for (let pokusaj = 0; pokusaj < 60; pokusaj += 1) {
        await new Promise((r) => setTimeout(r, 6000));

        const res = await fetch("/api/admin/okret/orbit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ korak: "status", operacija: pokrenut.operacija }),
        });
        const json = await res.json();

        if (!json.ok) {
          setGreska(json.error_sr ?? "Orbit je pao.");
          setDetalj(json.sirovo ?? json.detalj ?? null);
          setFaza({ vrsta: "mirno" });
          return;
        }
        if (!json.gotovo) continue;

        const blob = base64UBlob(json.video, json.mime ?? "video/mp4");
        setVideoUrl(URL.createObjectURL(blob));
        setFaza({ vrsta: "mirno" });
        return;
      }

      setGreska("Orbit se nije završio ni posle šest minuta.");
      setFaza({ vrsta: "mirno" });
    } catch (err) {
      setGreska("Zahtev je pao.");
      setDetalj(String(err).slice(0, 400));
      setFaza({ vrsta: "mirno" });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Korak 3 -- sečenje frejmova, u pregledaču i besplatno              */
  /* ---------------------------------------------------------------- */

  const iseci = useCallback(async () => {
    if (!videoUrl) return;
    setFaza({ vrsta: "secem" });
    setGreska(null);

    try {
      const isečeni = await isecivFrejmove(videoUrl, brojFrejmova);
      setFrejmovi(isečeni);
    } catch (err) {
      setGreska("Sečenje frejmova nije uspelo.");
      setDetalj(String(err).slice(0, 400));
    } finally {
      setFaza({ vrsta: "mirno" });
    }
  }, [videoUrl, brojFrejmova]);

  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-8">
      {/* ── Dijagnostika ključa ─────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-muted/40 p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Video modeli na ključu
        </h2>
        {videoModeli.length === 0 ? (
          <p className="mt-1 text-sm text-destructive">
            Nijedan. Video neće raditi dok ključ ne dobije pristup — nov ključ iz
            Google AI Studio, ili uključena naplata za Veo.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Ostavi prazno za podrazumevani, ili izaberi drugi.
            </p>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">(podrazumevani)</option>
              {videoModeli.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </>
        )}
      </section>

      {/* ── Slike ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          1. Slike ({slike.length}/{MAX_OKRET_SLIKA})
        </h2>
        <p className="text-xs text-muted-foreground">
          Traži se {MIN_OKRET_SLIKA}–{MAX_OKRET_SLIKA}. Ne čuvaju se nigde — idu u
          zahtev i propadaju.
        </p>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:bg-muted">
          Dodaj slike
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              dodaj(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {slike.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {slike.map((item) => (
              <li key={item.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => izbaci(item.id)}
                  className="absolute right-1 top-1 rounded-full bg-background/90 px-1.5 text-xs text-foreground"
                  aria-label="Izbaci sliku"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Kadar ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">2. Kadar</h2>
        <p className="text-xs text-muted-foreground">
          Glava i ramena, bešavna svetlo siva pozadina. Odlučeno 28.08. — nema
          varijanti.
        </p>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={saPortretom}
            onChange={(e) => setSaPortretom(e.target.checked)}
          />
          Prvo napravi referentni portret (vernije lice, duplo duže)
        </label>

        <Sablon
          naslov="Šablon za kadar"
          vrednost={promptKadra}
          naVrednost={setPromptKadra}
          podrazumevano={() =>
            buildOkretKadarPrompt(slike.length || 12, saPortretom)
          }
        />

        <button
          type="button"
          onClick={napraviKadar}
          disabled={radi || slike.length < MIN_OKRET_SLIKA}
          className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {faza.vrsta === "kadar" ? "Pravim kadar…" : "Napravi kadar"}
        </button>

        {slikaKadra && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:${slikaKadra.mime};base64,${slikaKadra.b64}`}
            alt="Kadar"
            className="w-full rounded-xl border border-border"
          />
        )}
      </section>

      {/* ── Orbit ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">3. Orbit</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-foreground">
            Luk (stepeni)
            <input
              type="number"
              min={60}
              max={360}
              step={10}
              value={stepeni}
              onChange={(e) => setStepeni(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-foreground">
            Rezolucija
            <select
              value={rezolucija}
              onChange={(e) => setRezolucija(e.target.value as "720p" | "1080p")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          180° je profil do profila, kao referenca. Preko toga model mora da
          izmisli potiljak — i izmisliće drugu frizuru.
        </p>

        <Sablon
          naslov="Šablon za orbit"
          vrednost={promptVidea}
          naVrednost={setPromptVidea}
          podrazumevano={() => buildOkretVideoPrompt(stepeni)}
        />

        <button
          type="button"
          onClick={napraviOrbit}
          disabled={radi || !slikaKadra}
          className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {faza.vrsta === "orbit" ? "Pravim orbit…" : "Napravi orbit"}
        </button>

        {faza.vrsta === "orbit" && <Sat od={faza.od} />}

        {videoUrl && (
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full rounded-xl border border-border"
          />
        )}
      </section>

      {/* ── Frejmovi ────────────────────────────────────────────── */}
      {videoUrl && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            4. Frejmovi
          </h2>
          <label className="text-sm text-foreground">
            Koliko kadrova
            <input
              type="number"
              min={5}
              max={60}
              value={brojFrejmova}
              onChange={(e) => setBrojFrejmova(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Seče se iz već plaćenog videa — broj kadrova ne utiče na cenu.
          </p>
          <button
            type="button"
            onClick={iseci}
            disabled={radi}
            className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground disabled:opacity-40"
          >
            {faza.vrsta === "secem" ? "Sečem…" : "Iseci frejmove"}
          </button>

          {frejmovi.length > 0 && <Okret frejmovi={frejmovi} />}
        </section>
      )}

      {/* ── Greške ──────────────────────────────────────────────── */}
      {greska && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{greska}</p>
          {detalj && (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
              {detalj}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Okret -- ono zbog čega cela klupa postoji                           */
/* ------------------------------------------------------------------ */

/**
 * Prevlačiš prstom, lik se okreće.
 *
 * Ovo je jedina komponenta ovde koja mora da bude TAČNA, jer je ona odgovor na
 * pitanje "da li ovo izgleda dobro". Sve ostalo je oprema oko nje.
 *
 * Svi frejmovi se drže u DOM-u i samo se prikazuje jedan (`hidden` na
 * ostalima), umesto da se menja `src` jedne slike. Menjanje `src`-a bi na
 * svakom pokretu tražilo dekodovanje slike -- i to se vidi kao trzaj tačno u
 * trenutku kad se prst pomera. Ovako su svi kadrovi već dekodovani.
 */
function Okret({ frejmovi }: { frejmovi: string[] }) {
  const [indeks, setIndeks] = useState(0);
  const stanje = useRef<{ x: number; od: number } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  function pomeri(x: number) {
    if (!stanje.current || !box.current) return;
    const sirina = box.current.clientWidth || 1;
    // Cela širina komponente = ceo luk. Prevučeš s kraja na kraj, obiđeš čoveka.
    const pomak = ((x - stanje.current.x) / sirina) * frejmovi.length;
    const novi = Math.round(stanje.current.od + pomak);
    setIndeks(Math.max(0, Math.min(frejmovi.length - 1, novi)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={box}
        className="relative touch-none select-none overflow-hidden rounded-xl border border-border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          stanje.current = { x: e.clientX, od: indeks };
        }}
        onPointerMove={(e) => {
          if (stanje.current) pomeri(e.clientX);
        }}
        onPointerUp={() => {
          stanje.current = null;
        }}
        onPointerCancel={() => {
          stanje.current = null;
        }}
      >
        {frejmovi.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            className={`w-full ${i === indeks ? "block" : "hidden"}`}
          />
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={frejmovi.length - 1}
        value={indeks}
        onChange={(e) => setIndeks(Number(e.target.value))}
        className="w-full"
        aria-label="Ugao"
      />
      <p className="text-center text-xs text-muted-foreground">
        Prevuci prstom preko slike. Kadar {indeks + 1} od {frejmovi.length}.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sitnice                                                             */
/* ------------------------------------------------------------------ */

/** Šablon: pokaži šta se šalje, i pusti da se prepiše. */
function Sablon({
  naslov,
  vrednost,
  naVrednost,
  podrazumevano,
}: {
  naslov: string;
  vrednost: string;
  naVrednost: (value: string) => void;
  podrazumevano: () => string;
}) {
  const [otvoren, setOtvoren] = useState(false);

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOtvoren((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground"
      >
        <span>
          {naslov}
          {vrednost.trim() ? " (prepisan)" : " (iz koda)"}
        </span>
        <span aria-hidden="true">{otvoren ? "−" : "+"}</span>
      </button>

      {otvoren && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <textarea
            value={vrednost}
            onChange={(e) => naVrednost(e.target.value)}
            placeholder={podrazumevano()}
            rows={10}
            className="w-full rounded-lg border border-border bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => naVrednost(podrazumevano())}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground"
            >
              Prepiši iz koda
            </button>
            <button
              type="button"
              onClick={() => naVrednost("")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              Vrati na kod
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Prazno polje znači &bdquo;koristi konstantu iz{" "}
            <code>okret-prompt.ts</code>&ldquo;. Kad tekst legne, prepiše se u tu
            konstantu.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Koliko traje. Bez ovoga se ne zna da li posao radi ili je zamro.
 *
 * Broji se od `od` naviše umesto da se pamti `Date.now()` -- render mora da
 * bude čist, a i prvi kadar je onda tačno 0:00 umesto onoga što sat zatekne.
 */
function Sat({ od }: { od: number }) {
  const [sek, setSek] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSek(Math.floor((Date.now() - od) / 1000)), 1000);
    return () => clearInterval(id);
  }, [od]);
  return (
    <p className="text-xs text-muted-foreground">
      Traje {Math.floor(sek / 60)}:{String(sek % 60).padStart(2, "0")} — obično
      jedan do tri minuta.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Pomoćne                                                             */
/* ------------------------------------------------------------------ */

function base64UBlob(base64: string, mime: string): Blob {
  const binarno = atob(base64);
  const bajtovi = new Uint8Array(binarno.length);
  for (let i = 0; i < binarno.length; i += 1) bajtovi[i] = binarno.charCodeAt(i);
  return new Blob([bajtovi], { type: mime });
}

/**
 * Seče video na frejmove, u pregledaču.
 *
 * ⚠️ PREMOTAVANJE JE ASINHRONO I NEMA POVRATNU VREDNOST. `currentTime = t` samo
 * traži premotavanje; slika u tom trenutku još nije ta. Crtanje odmah posle
 * dodele daje prethodni kadar -- i to izgleda kao da model pravi duplikate.
 * Zato se čeka `seeked`, jedan po jedan.
 */
async function isecivFrejmove(url: string, broj: number): Promise<string[]> {
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Video se ne otvara"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nema canvas konteksta");

  const vremena = okretVremenaFrejmova(video.duration, broj);
  const frejmovi: string[] = [];

  for (const t of vremena) {
    await new Promise<void>((resolve, reject) => {
      const gotovo = () => {
        video.removeEventListener("seeked", gotovo);
        resolve();
      };
      video.addEventListener("seeked", gotovo);
      video.onerror = () => reject(new Error("Premotavanje je palo"));
      video.currentTime = Math.min(t, Math.max(0, video.duration - 0.01));
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frejmovi.push(canvas.toDataURL("image/webp", 0.9));
  }

  return frejmovi;
}
