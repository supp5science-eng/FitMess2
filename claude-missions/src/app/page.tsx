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
 * The page is a Server Component; the only interactive island is
 * `<InstallButton>` (client), which resolves the real install capability of
 * the visitor's browser. The hero chat animation is pure CSS.
 */

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const AgentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
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
            <a className="link-quiet" href="#kako">Kako radi</a>
            <Link className="link-quiet" href="/prijava">Uđi</Link>
            <a className="btn btn-primary btn-sm" href="#instaliraj">Instaliraj</a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><span className="dot" />Praćenje ishrane · na srpskom</span>
              <h1>Dijeta koja ne <span className="u">puca</span> kad ti pukne.</h1>
              <p className="lede">
                Pojeo si tortu na poslu? Bez frke. FitMess ti preračuna nedelju i pokaže da ništa nije propalo.{" "}
                <b>Nedelja je jedinica uspeha — ne dan.</b>
              </p>
              <div className="hero-actions">
                <InstallButton className="btn-primary btn-lg" />
                <Link className="btn btn-ghost btn-lg" href="/prijava">Uđi preko weba</Link>
              </div>
              <div className="trust">
                <span><CheckIcon />Besplatno</span>
                <span><CheckIcon />Na srpskom</span>
                <span><CheckIcon />Bez reklama</span>
              </div>
            </div>

            <div className="stage">
              <div className="phone">
                <div className="screen">
                  <div className="sc-top">
                    <div className="h">Danas</div>
                    <div className="d">pon, 18. jul</div>
                  </div>
                  <div className="ring-wrap">
                    <div className="ring">
                      <svg viewBox="0 0 200 200" width="186" height="186" aria-hidden="true">
                        <circle cx="100" cy="100" r="86" fill="none" stroke="#EDF2EF" strokeWidth="16" />
                        <circle cx="100" cy="100" r="86" fill="none" stroke="url(#lpRing)" strokeWidth="16" strokeLinecap="round" strokeDasharray="540.4" strokeDashoffset="205" transform="rotate(-90 100 100)" />
                        <defs>
                          <linearGradient id="lpRing" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#34C46A" />
                            <stop offset="1" stopColor="#16A34A" />
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
                      <div className="bar"><i style={{ width: "66%", background: "linear-gradient(90deg,#34C46A,#16A34A)" }} /></div>
                    </div>
                    <div className="macro">
                      <div className="mrow"><b>Ugljeni hidrati</b><span className="num">118 / 190 g</span></div>
                      <div className="bar"><i style={{ width: "62%", background: "#8CC5A2" }} /></div>
                    </div>
                    <div className="macro">
                      <div className="mrow"><b>Masti</b><span className="num">41 / 60 g</span></div>
                      <div className="bar"><i style={{ width: "68%", background: "#C9A24B" }} /></div>
                    </div>
                  </div>
                  <div className="meals">
                    <div className="meal"><div className="ic">🍳</div><div className="mt"><b>Kajgana + 2 kifle</b><span>Doručak · 320 g</span></div><div className="kc num">540</div></div>
                    <div className="meal"><div className="ic">🍗</div><div className="mt"><b>Piletina i pirinač</b><span>Ručak · 400 g</span></div><div className="kc num">620</div></div>
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
                  Smiri se, brate. Prebacio si ~380 kcal. Skinuo sam ti <b>po 130 narednih 3 dana</b> — nedelja ti je i dalje u minusu. Ništa nije propalo. 💪
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow"><span className="dot" />Poznato ti je?</span>
              <h2 style={{ marginTop: "16px" }}>Svaka dijeta puca na isti način.</h2>
              <p>
                Jedan loš obrok, pa ono „ionako sam sve upropastio“, pa odustaneš. Nije do tebe — do pristupa je.
                FitMess je napravljen tačno protiv toga.
              </p>
            </div>
            <div className="problem-card">
              <div className="flow">
                <span className="step old">Poneseš se dobro</span>
                <span className="arr">→</span>
                <span className="step bad">jedan skok</span>
                <span className="arr">→</span>
                <span className="step"><s>„upropastio sam“</s></span>
                <span className="arr">→</span>
                <span className="step bad">odustaneš</span>
              </div>
              <p className="verdict">
                Kod nas nema crvenih brojeva ni osude. Jedan dan te ne ruši — <b>bitna je cela nedelja.</b>
              </p>
            </div>
          </div>
        </section>

        {/* Weekly */}
        <section className="sec band-bg">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow"><span className="dot" />Glavna ideja</span>
              <h2 style={{ marginTop: "16px" }}>Nedelja je jedinica uspeha.</h2>
              <p>
                Umesto da svaki dan bude test koji možeš da padneš, gledaš celu nedelju. Jedan dan preko — na
                nivou nedelje je sitnica.
              </p>
            </div>
            <div className="week">
              <div className="weekbars" aria-hidden="true">
                <div className="day ok"><div className="col" style={{ height: "64%" }} /><div className="dl">Pon</div></div>
                <div className="day ok"><div className="col" style={{ height: "58%" }} /><div className="dl">Uto</div></div>
                <div className="day over"><div className="col" style={{ height: "96%" }} /><div className="dl">Sre</div></div>
                <div className="day ok"><div className="col" style={{ height: "52%" }} /><div className="dl">Čet</div></div>
                <div className="day ok"><div className="col" style={{ height: "60%" }} /><div className="dl">Pet</div></div>
                <div className="day ok"><div className="col" style={{ height: "55%" }} /><div className="dl">Sub</div></div>
                <div className="day ok"><div className="col" style={{ height: "48%" }} /><div className="dl">Ned</div></div>
              </div>
              <div className="week-note">
                <h3>Sreda je skočila? Pa šta.</h3>
                <p>
                  FitMess automatski razmaže višak na naredne dane — po malo, nikad drastično — i nastaviš dalje
                  kao da se ništa nije desilo. Bez gladovanja u znak kazne.
                </p>
                <div className="pill-row">
                  <span className="pill">6 dana u deficitu</span>
                  <span className="pill amber">1 dan preko</span>
                  <span className="pill">Nedelja: i dalje ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="sec" id="kako">
          <div className="wrap">
            <div className="sec-head center">
              <span className="eyebrow"><span className="dot" />Šta dobijaš</span>
              <h2 style={{ marginTop: "16px" }}>Sve što treba za cut — i ništa što smara.</h2>
            </div>
            <div className="feat-grid">
              <div className="feat hero-feat">
                <span className="tag">Glavna fora</span>
                <div className="fi"><AgentIcon /></div>
                <h3>Agent „Skrenuo sam“</h3>
                <p>
                  Javiš mu šta si pojeo — tekstom ili slikom. On proceni, preračuna nedelju i smiri te. Bez
                  osude, bez drame, priča kao drug a ne kao aplikacija.
                </p>
              </div>
              <div className="feat">
                <div className="fi">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M3 10h18M8 2v4M16 2v4" />
                    <path d="m9 16 2 2 4-4" />
                  </svg>
                </div>
                <h3>Nedeljni budžet</h3>
                <p>
                  Kalorije i proteini za celu nedelju, ne samo za danas. Vidiš gde si na nivou nedelje, pa te
                  jedan skok ne baca u očaj.
                </p>
              </div>
              <div className="feat">
                <div className="fi">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 21a8 8 0 1 0-8-8" />
                    <path d="M11 3v8l5 3" />
                    <path d="M18 17h4M20 15v4" />
                  </svg>
                </div>
                <h3>Srpska baza hrane</h3>
                <p>
                  Sarma, gibanica, burek, pasulj — plus Bambi, Štark, Imlek i proizvodi iz Lidla i Maksija. Prave
                  vrednosti, ne američke aproksimacije.
                </p>
              </div>
              <div className="feat">
                <div className="fi">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                    <path d="M7 12h10" />
                  </svg>
                </div>
                <h3>Skeniraj i slikaj</h3>
                <p>
                  Barkod, deklaracija ili slika tanjira — unos obroka za dva tapa. Prvi put skeniraš proizvod,
                  sledeći put ga svi već imaju u bazi.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Install */}
        <section className="sec band-bg" id="instaliraj">
          <div className="wrap install-grid">
            <div className="why">
              <h3>Zašto app, a ne samo sajt?</h3>
              <ul>
                <li><CheckIcon /><span><b>Ikonica na ekranu</b> — otvoriš je jednim tapom, kao pravu aplikaciju.</span></li>
                <li><CheckIcon /><span><b>Brže i preko celog ekrana</b> — bez pretraživača oko svega.</span></li>
                <li><CheckIcon /><span><b>Radi i bez neta</b> — pregled dana ti je tu i kad nema signala.</span></li>
                <li><CheckIcon /><span><b>Bez app store-a</b> — instalira se direkt sa sajta, za par sekundi.</span></li>
              </ul>
            </div>
            <div>
              <div className="sec-head">
                <span className="eyebrow"><span className="dot" />Traje 15 sekundi</span>
                <h2 style={{ marginTop: "16px" }}>Instaliraj u tri koraka.</h2>
              </div>
              <div className="steps">
                <div className="stp"><div className="n num">1</div><div className="st"><b>Klikni „Instaliraj FitMess“</b><p>Telefon te pita da dodaš app na početni ekran.</p></div></div>
                <div className="stp"><div className="n num">2</div><div className="st"><b>Potvrdi „Dodaj na početni ekran“</b><p>Na iPhone-u: tap na <b>Podeli</b> → <b>Dodaj na početni ekran</b>.</p></div></div>
                <div className="stp"><div className="n num">3</div><div className="st"><b>Otvori FitMess i uloguj se</b><p>Mejlom ili Google nalogom — i kreni da pratiš.</p></div></div>
              </div>
              <div className="hero-actions">
                <InstallButton className="btn-primary btn-lg" />
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final">
          <div className="wrap">
            <div className="final-card">
              <span className="eyebrow"><span className="dot" />Kreni danas</span>
              <h2>Probaj dijetu koja ti oprašta.</h2>
              <p>Bez gladovanja u znak kazne. Bez odustajanja posle jednog obroka. Samo nedelja koja se uvek vraća u plus.</p>
              <div className="hero-actions">
                <InstallButton className="btn-primary btn-lg" />
                <Link className="btn btn-ghost btn-lg" href="/prijava">Uđi preko weba</Link>
              </div>
              <div className="trust">
                <span><CheckIcon />Besplatno</span>
                <span><CheckIcon />Na srpskom</span>
                <span><CheckIcon />Bez reklama</span>
              </div>
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
            <a href="#kako">Kako radi</a>
            <Link href="/prijava">Prijava</Link>
            <a href="#instaliraj">Instaliraj</a>
          </nav>
          <div className="cc">© 2026 FitMess · Napravljeno za Srbiju 🇷🇸 · Nedelja je jedinica uspeha.</div>
        </div>
      </footer>
    </div>
  );
}
