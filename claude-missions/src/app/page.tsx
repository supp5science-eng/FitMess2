import type { CSSProperties } from "react";
import Link from "next/link";

import { InstallButton } from "@/components/landing/install-button";
import "./landing.css";

/**
 * The public marketing landing page at `/`.
 *
 * Its single job is to sell FitMess and drive PWA installs: most visitors
 * arrive here logged out, install the app to their home screen, then sign
 * in. `/` is a public route (`isPublicPath` in
 * `src/lib/auth/route-protection.ts`) and renders full-bleed — the app shell
 * (`src/components/shell/app-shell.tsx`) deliberately drops its mobile column
 * and bottom navigation for this route.
 *
 * Design: light, minimal, MacroFactor-inspired. Clean white canvas, a single
 * teal accent with black CTAs, and very little copy — a few strong lines
 * instead of long paragraphs. The page is a Server Component; the only
 * interactive island is `<InstallButton>` (client). The hero chat animation is
 * pure CSS.
 */

const AgentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
  </svg>
);

const WeekIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
    <path d="m9 16 2 2 4-4" />
  </svg>
);

const FoodIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 21a8 8 0 1 0-8-8" />
    <path d="M11 3v8l5 3" />
    <path d="M18 17h4M20 15v4" />
  </svg>
);

export default function LandingPage() {
  return (
    <div className="lp">
      {/* Header */}
      <header className="top">
        <div className="wrap top-inner">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/fitmess-icon.png" alt="FitMess logo" width={30} height={30} />
            <b>Fit<span className="g">Mess</span></b>
          </div>
          <div className="top-cta">
            <Link className="link-quiet" href="/prijava">Prijavi se</Link>
            <Link className="btn btn-primary btn-sm" href="/upitnik">Kreni</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title">
                <span className="ht-hi">Bez muke</span> isprati sve što pojedeš
              </h1>
              <p className="lede">
                Uslikaj tanjir — prepoznamo hranu i sračunamo kalorije. Najveća
                baza domaćih namirnica.
              </p>
              <p className="lede-sub"><b>90% tačnost skeniranja hrane</b> — bez ručnog kucanja.</p>
              <div className="hero-actions" id="instaliraj">
                <Link className="btn btn-primary btn-lg" href="/upitnik">Kreni</Link>
                <InstallButton className="btn-ghost btn-lg" />
              </div>
              <p className="hero-signin">
                Već imaš nalog? <Link href="/prijava">Prijavi se</Link>
              </p>
            </div>

            <div className="stage">
              <div className="phone demo" aria-hidden="true">
                <div className="screen">
                  {/* Screen 1 — camera scanning a plate of food */}
                  <div className="demo-screen ds-scan">
                    <div className="ds-cam">
                      <div className="ds-plate">🍽️</div>
                      <div className="ds-food ds-food-a">🍖</div>
                      <div className="ds-food ds-food-b">🥔</div>
                      <div className="ds-food ds-food-c">🥗</div>
                      <span className="ds-bracket tl" />
                      <span className="ds-bracket tr" />
                      <span className="ds-bracket bl" />
                      <span className="ds-bracket br" />
                      <div className="ds-scanline" />
                    </div>
                    <div className="ds-hint">
                      <span className="ds-rec" /> Skeniram tanjir…
                    </div>
                  </div>

                  {/* Screen 2 — food recognized, logged */}
                  <div className="demo-screen ds-detect">
                    <div className="ds-check">
                      <svg viewBox="0 0 52 52" aria-hidden="true">
                        <circle cx="26" cy="26" r="24" fill="none" />
                        <path d="M15 27l7 7 15-15" fill="none" />
                      </svg>
                    </div>
                    <div className="ds-detected">
                      <b>Pljeskavica u lepinji</b>
                      <span>1 komad · 620 kcal</span>
                    </div>
                    <div className="ds-added">Dodato u ručak ✓</div>
                  </div>

                  {/* Screen 3 — the Danas dashboard filling in */}
                  <div className="demo-screen ds-home">
                    <div className="sc-top">
                      <div className="h">Danas</div>
                      <div className="d">pon, 18. jul</div>
                    </div>
                    <div className="ring-wrap">
                      <div className="ring">
                        <svg viewBox="0 0 200 200" width="186" height="186" aria-hidden="true">
                          <circle cx="100" cy="100" r="86" fill="none" stroke="#EAF1EF" strokeWidth="16" />
                          <circle className="sc-ring-fill" cx="100" cy="100" r="86" fill="none" stroke="url(#lpRing)" strokeWidth="16" strokeLinecap="round" strokeDasharray="540.4" strokeDashoffset="205" transform="rotate(-90 100 100)" />
                          <defs>
                            <linearGradient id="lpRing" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0" stopColor="#2AE3BE" />
                              <stop offset="1" stopColor="#12B492" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="cx">
                          <div className="big num">1.240</div>
                          <div className="lab">kcal preostalo</div>
                        </div>
                      </div>
                    </div>
                    <div className="macros">
                      <div className="macro">
                        <div className="mrow"><b>Proteini</b><span className="num">92 / 140 g</span></div>
                        <div className="bar"><i style={{ "--tw": "66%", background: "linear-gradient(90deg,#2AE3BE,#12B492)" } as CSSProperties} /></div>
                      </div>
                      <div className="macro">
                        <div className="mrow"><b>Ugljeni hidrati</b><span className="num">118 / 190 g</span></div>
                        <div className="bar"><i style={{ "--tw": "62%", background: "#6FD9C4" } as CSSProperties} /></div>
                      </div>
                      <div className="macro">
                        <div className="mrow"><b>Masti</b><span className="num">41 / 60 g</span></div>
                        <div className="bar"><i style={{ "--tw": "68%", background: "#C9A24B" } as CSSProperties} /></div>
                      </div>
                    </div>
                    <div className="meals">
                      <div className="meal"><div className="ic">🥪</div><div className="mt"><b>Pljeskavica u lepinji</b><span>Ručak · 1 komad</span></div><div className="kc num">620</div></div>
                      <div className="meal"><div className="ic">🍳</div><div className="mt"><b>Kajgana + 2 kifle</b><span>Doručak · 320 g</span></div><div className="kc num">540</div></div>
                    </div>
                  </div>
                </div>
                <div className="fab">+</div>
              </div>

              <div className="chat-float">
                <div className="cf-head">
                  <div className="cf-ava"><AgentIcon /></div>
                  <b>Meda</b>
                  <em>online</em>
                </div>
                <div className="bubble b-user b-1">Uh, pojeo sam dve krofne 🍩</div>
                <div className="bubble b-agent b-2">
                  Smiri se, brate. Prebacio si ~380 kcal. Skinuo sam ti <b>po 130 narednih 3 dana</b> — nedelja ti je i dalje u minusu. 💪
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value trio */}
        <section className="values">
          <div className="wrap value-grid">
            <div className="val">
              <div className="vi"><WeekIcon /></div>
              <h3>Nedelja, ne dan</h3>
              <p>Jedan skok se razmaže na naredne dane. Nastaviš dalje kao da se ništa nije desilo.</p>
            </div>
            <div className="val accent">
              <div className="vi"><AgentIcon /></div>
              <h3>Agent koji te smiri</h3>
              <p>Javiš šta si pojeo — tekstom ili slikom. On preračuna nedelju i bez osude te vrati u plus.</p>
            </div>
            <div className="val">
              <div className="vi"><FoodIcon /></div>
              <h3>Srpska hrana</h3>
              <p>Sarma, burek, Bambi, Lidl, Maksi — prave vrednosti, ne američke aproksimacije.</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final">
          <div className="wrap">
            <div className="final-card">
              <h2>Probaj dijetu koja ti oprašta.</h2>
              <p>Bez gladovanja u znak kazne. Bez odustajanja posle jednog obroka.</p>
              <div className="hero-actions">
                <Link className="btn btn-primary btn-lg" href="/upitnik">Kreni besplatno</Link>
                <InstallButton className="btn-ghost btn-lg" />
              </div>
              <p className="hero-signin">
                Već imaš nalog? <Link href="/prijava">Prijavi se</Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot-wrap">
        <div className="wrap foot">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/fitmess-icon.png" alt="FitMess logo" width={26} height={26} />
            <b>Fit<span className="g">Mess</span></b>
          </div>
          <nav>
            <Link href="/prijava">Prijava</Link>
            <a href="#instaliraj">Instaliraj</a>
          </nav>
          <div className="cc">© 2026 FitMess · Napravljeno za Srbiju 🇷🇸</div>
        </div>
      </footer>
    </div>
  );
}
