import type { CSSProperties } from "react";
import {
  ChartColumnBig,
  Home,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";

/**
 * The landing page's hero "motion graphic": a fully code-drawn, infinitely
 * looping demo of the app's signature journey, playing inside the phone frame
 * where the old hero video used to be:
 *
 *   početna (/danas) → tap "+" → kamera → slika obroka → "Analiziram obrok…"
 *   → AI procena (naziv/gramaža/kcal/makroi) → "Dodaj u dan" → početna,
 *   gde se ring i makro barovi animirano popune i nova kartica uklizi.
 *
 * Everything mirrors the real product 1:1 — same copy (from
 * `dodaj/obrok/obrok-flow.tsx`), same dark-theme palette, ring geometry
 * (`components/home/ring.tsx`), macro bars, meal cards and floating nav — but
 * is deliberately a static re-DRAWING, not a reuse of the live components:
 * those need props/state/handlers, while this must be a zero-JS,
 * pure-CSS-choreographed poster that Safari can play forever for free.
 *
 * All choreography lives in `app/landing-demo.css` on one master timeline
 * (`--lpd-t`, ~15s). This file is only markup. Scene visibility, taps,
 * shutter flash, scan line, count-ups — all CSS keyframes. Under
 * `prefers-reduced-motion` the landing kills every animation and this
 * degrades to a static poster of the home screen (scene 1 is the only one
 * visible without animation — by design).
 *
 * The meal photo is currently `<MealPhoto />`, a stylized SVG plate
 * (piletina + pirinač + brokoli) used as a stand-in until the real
 * photograph lands in `public/landing/obrok.jpg` — swap happens in ONE
 * place (inside `MealPhoto`).
 *
 * Decorative through and through → the whole thing is `aria-hidden` (the
 * page's heading + CTA carry the meaning), matching how the old hero video
 * was treated.
 */

// ---------------------------------------------------------------------------
// Demo numbers — one source of truth for both home scenes. Consumed view
// (a real app toggle state): everything counts UP when the meal lands.
// ---------------------------------------------------------------------------
// Target 2200 kcal; the scanned meal adds 520 kcal / P 42 g / UH 55 g / M 12 g.
// Ring: pathLength=100 → dashoffset = 100 − fill%. 1250/2200 → 43.2;
// 1770/2200 → 19.5 (the CSS keyframes animate between these two).
const RING_OFFSET_BEFORE = 43.2;

// Brand ring gradient — same stops as `components/home/ring.tsx`.
const RING_STOPS = ["#3ee6bf", "#17d1a8", "#2a9fd1"] as const;

/** iOS-style status bar (9:41, signal/wifi/battery), shared over every scene. */
function StatusBar() {
  return (
    <div className="lpd-status">
      <span className="lpd-status-time">9:41</span>
      <span className="lpd-status-icons">
        {/* signal */}
        <svg viewBox="0 0 16 10" className="lpd-status-svg">
          <rect x="0" y="6" width="2.6" height="4" rx="0.8" fill="currentColor" />
          <rect x="4.2" y="4" width="2.6" height="6" rx="0.8" fill="currentColor" />
          <rect x="8.4" y="2" width="2.6" height="8" rx="0.8" fill="currentColor" />
          <rect x="12.6" y="0" width="2.6" height="10" rx="0.8" fill="currentColor" opacity="0.4" />
        </svg>
        {/* wifi */}
        <svg viewBox="0 0 14 10" className="lpd-status-svg">
          <path
            d="M7 9.4 4.6 7a3.4 3.4 0 0 1 4.8 0Zm-4-4.1L1.6 3.9a7.6 7.6 0 0 1 10.8 0L11 5.3a5.6 5.6 0 0 0-8 0Z"
            fill="currentColor"
          />
        </svg>
        {/* battery */}
        <svg viewBox="0 0 22 10" className="lpd-status-svg lpd-status-batt">
          <rect x="0.5" y="0.5" width="18" height="9" rx="2.6" fill="none" stroke="currentColor" opacity="0.5" />
          <rect x="2" y="2" width="13" height="6" rx="1.4" fill="currentColor" />
          <path d="M20 3.2v3.6a2 2 0 0 0 0-3.6Z" fill="currentColor" opacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

/**
 * The meal "photograph". Placeholder: a stylized top-down SVG plate matching
 * what the AI "recognizes" (piletina + pirinač + brokoli) on a dark table.
 *
 * SWAP POINT: when the real photo lands, replace this component's body with
 *   <img src="/landing/obrok.jpg" alt="" className={className} />
 * and every scene (camera, analysis, meal card) picks it up automatically.
 */
function MealPhoto({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 260"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="lpd-table" cx="50%" cy="42%" r="80%">
          <stop offset="0%" stopColor="#2b211a" />
          <stop offset="70%" stopColor="#1c1512" />
          <stop offset="100%" stopColor="#120e0c" />
        </radialGradient>
        <radialGradient id="lpd-plate" cx="42%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#f2f0ea" />
          <stop offset="78%" stopColor="#e4e1d8" />
          <stop offset="100%" stopColor="#cfcbbf" />
        </radialGradient>
        <linearGradient id="lpd-chick" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0a95c" />
          <stop offset="100%" stopColor="#a86227" />
        </linearGradient>
      </defs>

      {/* table + plate */}
      <rect width="200" height="260" fill="url(#lpd-table)" />
      <ellipse cx="100" cy="134" rx="86" ry="84" fill="#0d0a08" opacity="0.55" />
      <ellipse cx="100" cy="130" rx="84" ry="82" fill="url(#lpd-plate)" />
      <ellipse cx="100" cy="130" rx="66" ry="64" fill="#efede6" />

      {/* pirinač — creamy mound with grain flecks */}
      <path
        d="M55 118c-8 14-2 34 14 40 18 7 40 4 50-8 9-11 6-28-6-36-16-11-49-9-58 4Z"
        fill="#f5efdc"
      />
      <g fill="#e6ddc0">
        <circle cx="70" cy="128" r="1.7" />
        <circle cx="82" cy="120" r="1.7" />
        <circle cx="95" cy="132" r="1.7" />
        <circle cx="78" cy="142" r="1.7" />
        <circle cx="102" cy="118" r="1.7" />
        <circle cx="90" cy="147" r="1.7" />
        <circle cx="64" cy="140" r="1.7" />
      </g>

      {/* piletina — grilled slices */}
      <g>
        <rect x="98" y="78" width="52" height="22" rx="10" fill="url(#lpd-chick)" transform="rotate(18 124 89)" />
        <rect x="104" y="96" width="56" height="23" rx="10" fill="url(#lpd-chick)" transform="rotate(12 132 107)" />
        <rect x="108" y="116" width="52" height="22" rx="10" fill="url(#lpd-chick)" transform="rotate(6 134 127)" />
        {/* grill marks */}
        <g stroke="#7c431a" strokeWidth="2.4" strokeLinecap="round" opacity="0.65">
          <path d="M112 84.5 140 94" />
          <path d="M114 103 146 111" />
          <path d="M116 122 148 128" />
        </g>
      </g>

      {/* brokoli — florets */}
      <g>
        <circle cx="78" cy="172" r="12" fill="#3f9d5f" />
        <circle cx="96" cy="180" r="10" fill="#57b26f" />
        <circle cx="64" cy="184" r="9" fill="#2f8a4e" />
        <g fill="#2c7f47" opacity="0.7">
          <circle cx="74" cy="168" r="3" />
          <circle cx="83" cy="175" r="3" />
          <circle cx="94" cy="177" r="2.6" />
          <circle cx="99" cy="184" r="2.6" />
          <circle cx="62" cy="181" r="2.4" />
          <circle cx="68" cy="188" r="2.4" />
        </g>
      </g>

      {/* čeri paradajz */}
      <circle cx="128" cy="168" r="9" fill="#d94f3f" />
      <circle cx="126" cy="166" r="4" fill="#e87563" />
      <circle cx="146" cy="156" r="7.5" fill="#d94f3f" />
      <circle cx="144.5" cy="154.5" r="3.2" fill="#e87563" />

      {/* soft rim light so it reads "photo", not "flat icon" */}
      <ellipse cx="100" cy="130" rx="84" ry="82" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.12" />
    </svg>
  );
}

/** One date-strip cell: weekday over a mini progress ring with the day inside. */
function MiniDay({
  wd,
  day,
  offset,
  today = false,
  future = false,
}: {
  wd: string;
  day: number;
  /** dashoffset (100 − fill%); ignored for future days (track only). */
  offset: number;
  today?: boolean;
  future?: boolean;
}) {
  return (
    <span className={`lpd-day${future ? " lpd-day-future" : ""}`}>
      <span className={`lpd-day-wd${today ? " lpd-day-wd-today" : ""}`}>{wd}</span>
      <span className="lpd-day-ring">
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3.5" className="lpd-ring-track" />
          {!future ? (
            <circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="url(#lpd-ring-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={offset}
              transform="rotate(-90 20 20)"
            />
          ) : null}
        </svg>
        <span className="lpd-day-num">{day}</span>
      </span>
    </span>
  );
}

/**
 * A number that crossfades old → new on the master timeline (home scene 2).
 * Both values share one grid cell so the layout never shifts.
 */
function Swap({ from, to }: { from: string; to: string }) {
  return (
    <span className="lpd-swap">
      <span className="lpd-swap-old">{from}</span>
      <span className="lpd-swap-new">{to}</span>
    </span>
  );
}

/** One macro column — label / slim colored bar / "value / target g". */
function MacroCol({
  label,
  color,
  w0,
  w1,
  from,
  to,
  target,
  end,
}: {
  label: string;
  color: string;
  /** bar fill % before / after the meal */
  w0: number;
  w1: number;
  from: number;
  to: number;
  target: number;
  end: boolean;
}) {
  return (
    <span className="lpd-macro">
      <span className="lpd-macro-label">{label}</span>
      <span className="lpd-macro-track" style={{ background: `color-mix(in oklab, ${color} 22%, transparent)` }}>
        <span
          className={`lpd-macro-fill${end ? " lpd-macro-fill-anim" : ""}`}
          style={
            {
              background: color,
              width: `${w0}%`,
              "--w0": `${w0}%`,
              "--w1": `${w1}%`,
            } as CSSProperties
          }
        />
      </span>
      <span className="lpd-macro-vals">
        {end ? <Swap from={String(from)} to={String(to)} /> : from} / {target} g
      </span>
    </span>
  );
}

/**
 * The `/danas` home screen, drawn to match `components/home/*`. Rendered
 * twice: `end=false` (scene 1, before the meal) and `end=true` (scene 5,
 * where ring/bars/numbers animate to the post-meal state and the new photo
 * meal card slides in).
 */
function HomeScene({ end }: { end: boolean }) {
  return (
    <section className={`lpd-sc ${end ? "lpd-sc-home2" : "lpd-sc-home1"}`}>
      {/* header: pear + wordmark (Archivo Black, "Mess" in the sedef gradient) */}
      <div className="lpd-home-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/fitmess-icon.png" alt="" className="lpd-pear" />
        <span className="lpd-wordmark">
          Fit<span className="lpd-wordmark-mess">Mess</span>
        </span>
      </div>

      {/* date strip — mini day rings, today (čet) in the teal chip */}
      <div className="lpd-strip">
        <MiniDay wd="pon" day={20} offset={10} />
        <MiniDay wd="uto" day={21} offset={30} />
        <MiniDay wd="sre" day={22} offset={0} />
        <MiniDay wd="čet" day={23} offset={RING_OFFSET_BEFORE} today />
        <MiniDay wd="pet" day={24} offset={100} future />
      </div>

      <span className="lpd-h2">Dnevni unos</span>

      {/* the calorie ring, flanked by Cilj / Preostalo */}
      <div className="lpd-ring-row">
        <span className="lpd-side">
          <span className="lpd-side-num">2200</span>
          <span className="lpd-side-label">Cilj</span>
        </span>

        <span className="lpd-ring">
          <svg viewBox="0 0 200 200">
            {!end ? (
              <defs>
                <linearGradient id="lpd-ring-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={RING_STOPS[0]} />
                  <stop offset="55%" stopColor={RING_STOPS[1]} />
                  <stop offset="100%" stopColor={RING_STOPS[2]} />
                </linearGradient>
              </defs>
            ) : null}
            <circle cx="100" cy="100" r="82" fill="none" strokeWidth="18" className="lpd-ring-track" />
            <circle
              cx="100"
              cy="100"
              r="82"
              fill="none"
              stroke="url(#lpd-ring-grad)"
              strokeWidth="18"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={RING_OFFSET_BEFORE}
              transform="rotate(-90 100 100)"
              className={end ? "lpd-ring-arc-anim" : undefined}
            />
          </svg>
          <span className="lpd-ring-center">
            <span className="lpd-ring-big">
              {end ? <Swap from="1250" to="1770" /> : "1250"}
            </span>
            <span className="lpd-ring-label">Potrošeno</span>
          </span>
        </span>

        <span className="lpd-side">
          <span className="lpd-side-num">
            {end ? <Swap from="950" to="430" /> : "950"}
          </span>
          <span className="lpd-side-label">Preostalo</span>
        </span>
      </div>

      {/* macro bars — Proteini / Masti / UH (consumed view: fill UP) */}
      <div className="lpd-macros">
        <MacroCol label="Proteini" color="#f9745f" w0={47} w1={73} from={78} to={120} target={165} end={end} />
        <MacroCol label="Masti" color="#f2c14e" w0={54} w1={71} from={38} to={50} target={70} end={end} />
        <MacroCol label="UH" color="#45c78d" w0={56} w1={78} from={140} to={195} target={250} end={end} />
      </div>

      {/* today's meals */}
      <span className="lpd-h2 lpd-meals-h">Obroci danas</span>
      <div className="lpd-meals">
        {end ? (
          /* the freshly scanned meal — photo card, slides in on the timeline */
          <div className="lpd-card lpd-card-new">
            <MealPhoto className="lpd-card-photo" />
            <div className="lpd-card-row">
              <span className="lpd-card-names">
                <span className="lpd-card-name">Piletina sa pirinčem</span>
                <span className="lpd-card-portion">450 g</span>
              </span>
              <span className="lpd-card-kcal">520 kcal</span>
            </div>
            <div className="lpd-card-macros">
              <span><b className="lpd-mp">42 g</b> Proteini</span>
              <span><b className="lpd-mc">55 g</b> UH</span>
              <span><b className="lpd-mf">12 g</b> Masti</span>
            </div>
          </div>
        ) : null}
        <div className="lpd-card">
          <div className="lpd-card-row">
            <span className="lpd-card-names">
              <span className="lpd-card-name">Omlet sa sirom</span>
              <span className="lpd-card-portion">180 g</span>
            </span>
            <span className="lpd-card-kcal">420 kcal</span>
          </div>
        </div>
      </div>

      {/* floating bottom nav: frosted pill + the teal "+" */}
      <div className="lpd-nav">
        <span className="lpd-nav-pill">
          <span className="lpd-nav-item lpd-nav-active">
            <Home className="lpd-nav-icon" />
            <span>Početna</span>
          </span>
          <span className="lpd-nav-item">
            <ChartColumnBig className="lpd-nav-icon" />
            <span>Analitika</span>
          </span>
          <span className="lpd-nav-item">
            <Settings className="lpd-nav-icon" />
            <span>Profil</span>
          </span>
        </span>
        <span className={`lpd-plus${end ? "" : " lpd-plus-tap"}`}>
          <Plus className="lpd-plus-icon" />
          {!end ? <span className="lpd-plus-ripple" /> : null}
        </span>
      </div>
    </section>
  );
}

/** Scene 2 — the camera viewfinder over the meal, shutter fires. */
function CameraScene() {
  return (
    <section className="lpd-sc lpd-sc-cam">
      <MealPhoto className="lpd-cam-photo" />
      <span className="lpd-cam-shade" />

      <div className="lpd-cam-head">
        <span className="lpd-cam-title">Slikaj obrok</span>
        <span className="lpd-cam-cancel">Otkaži</span>
      </div>
      {/* the real capture screen's own promise, as the viewfinder hint */}
      <span className="lpd-cam-hint">
        <Sparkles className="lpd-cam-hint-icon" />
        AI će proceniti kalorije i makronutrijente
      </span>

      <span className="lpd-brackets" />

      <span className="lpd-shutter" />
      <span className="lpd-flash" />
    </section>
  );
}

/** Scene 3 — "Analiziram obrok…": the photo under a teal scan line. */
function AnalyzeScene() {
  return (
    <section className="lpd-sc lpd-sc-scan">
      <div className="lpd-scan-card">
        <MealPhoto className="lpd-scan-photo" />
        <span className="lpd-scan-line" />
      </div>
      <span className="lpd-spinner" />
      <span className="lpd-scan-text">Analiziram obrok…</span>
    </section>
  );
}

/** Scene 4 — the AI estimate, exactly like the confirm phase of the flow. */
function ResultScene() {
  return (
    <section className="lpd-sc lpd-sc-res">
      <div className="lpd-res-head">
        <span className="lpd-res-title">Slikaj obrok</span>
        <span className="lpd-cam-cancel">Otkaži</span>
      </div>

      <span className="lpd-res-row lpd-res-r1 lpd-res-conf">
        <Sparkles className="lpd-res-conf-icon" />
        Visoka sigurnost
      </span>

      <span className="lpd-res-row lpd-res-r2 lpd-res-chips">
        <span className="lpd-chip">piletina</span>
        <span className="lpd-chip">pirinač</span>
        <span className="lpd-chip">brokoli</span>
      </span>

      <span className="lpd-res-row lpd-res-r3 lpd-field">
        <span className="lpd-field-label">Naziv</span>
        <span className="lpd-field-box">Piletina sa pirinčem</span>
      </span>

      <span className="lpd-res-row lpd-res-r4 lpd-field">
        <span className="lpd-field-label">Gramaža (g)</span>
        <span className="lpd-field-box">450</span>
      </span>

      <span className="lpd-res-row lpd-res-r5 lpd-res-grid">
        <span className="lpd-field-box lpd-stat">
          <span className="lpd-stat-label">Kalorije</span>
          <span className="lpd-stat-num">520</span>
        </span>
        <span className="lpd-field-box lpd-stat">
          <span className="lpd-stat-label">Protein (g)</span>
          <span className="lpd-stat-num lpd-mp">42</span>
        </span>
        <span className="lpd-field-box lpd-stat">
          <span className="lpd-stat-label">Ugljeni hidrati (g)</span>
          <span className="lpd-stat-num lpd-mc">55</span>
        </span>
        <span className="lpd-field-box lpd-stat">
          <span className="lpd-stat-label">Masti (g)</span>
          <span className="lpd-stat-num lpd-mf">12</span>
        </span>
      </span>

      <span className="lpd-res-row lpd-res-r6 lpd-res-cta">Dodaj u dan</span>
      <span className="lpd-res-row lpd-res-r6 lpd-res-note">
        AI procena je približna — proveri i doteraj po potrebi.
      </span>
    </section>
  );
}

export function HeroDemo() {
  return (
    <div className="lpd" aria-hidden="true">
      <HomeScene end={false} />
      <CameraScene />
      <AnalyzeScene />
      <ResultScene />
      <HomeScene end />
      <StatusBar />
    </div>
  );
}
