"use client";

import { useState } from "react";

import { AvatarFigure } from "@/components/avatar/avatar-figure";
import {
  BEARDS,
  DEFAULT_AVATAR,
  GLASSES,
  geom,
  HAIRS,
  HAIR_COLORS,
  PRESETS,
  SHIRTS,
  SKINS,
  stateLabel,
  type AvatarParams,
  type BeardId,
  type GlassesId,
  type HairId,
} from "@/lib/avatar/figure";

/**
 * Lab za avatar rig -- samo `/admin`, nije korisnički ekran.
 *
 * ⚠️ Slajderi ovde su ALAT, ne budući UI. U appu korisnik nikad ne vidi
 * "Masnoća 62%" -- telo vozi kilaža i trening, tiho. Slajderi postoje samo
 * da se ceo raspon prošeta za pet sekundi umesto za tri meseca.
 *
 * Ono što korisnik BIRA je sve ispod "Identitet".
 */
export function AvatarLab() {
  const [p, setP] = useState<AvatarParams>(DEFAULT_AVATAR);
  const [hairColor, setHairColor] = useState(0);

  const set = <K extends keyof AvatarParams>(k: K, v: AvatarParams[K]) =>
    setP((prev) => ({ ...prev, [k]: v }));

  const g = geom(p);

  return (
    <div className="flex flex-col gap-6 px-4 pb-16 pt-4">
      {/* --- figura --- */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative flex justify-center bg-muted/40 py-3">
          <div className="absolute left-3 top-3 font-mono text-[10px] leading-relaxed tabular-nums text-muted-foreground">
            <div>
              ramena <span className="text-foreground">{Math.round(g.w.shoulder * 2)}</span>
            </div>
            <div>
              grudi <span className="text-foreground">{Math.round(g.w.chest * 2)}</span>
            </div>
            <div>
              struk <span className="text-foreground">{Math.round(g.w.waist * 2)}</span>
            </div>
            <div>
              stomak <span className="text-foreground">{Math.round(g.w.belly * 2)}</span>
            </div>
          </div>
          <div className="absolute right-3 top-3 text-right font-mono text-[10px] uppercase tracking-wider text-primary">
            {stateLabel(p.fat, p.muscle)}
          </div>
          <AvatarFigure params={p} hairColor={hairColor} className="h-64 w-auto" />
        </div>

        <div className="flex flex-col gap-4 border-t border-border p-4">
          <Slider
            id="fat"
            label="Masnoća"
            hint="u appu je vodi kilaža"
            value={p.fat}
            onChange={(v) => set("fat", v)}
            format={(v) => `${Math.round(6 + v * 34)} % tm`}
          />
          <Slider
            id="mus"
            label="Mišićavost"
            hint="u appu je vodi trening kroz vreme"
            value={p.muscle}
            onChange={(v) => set("muscle", v)}
            format={(v) => `${Math.round(v * 100)} / 100`}
          />
          <Slider
            id="hei"
            label="Visina"
            hint="iz profila"
            value={p.height}
            onChange={(v) => set("height", v)}
            format={(v) => `${Math.round(158 + v * 36)} cm`}
          />
        </div>
      </section>

      {/* --- identitet --- */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Identitet</h2>
          <p className="text-xs text-muted-foreground">
            Ovo bira korisnik. App ga nikad ne menja sam.
          </p>
        </div>

        <Field label="Pol">
          <Chips
            items={[
              { id: "m", label: "Muško" },
              { id: "z", label: "Žensko" },
            ]}
            active={p.fem ? "z" : "m"}
            onPick={(id) => set("fem", id === "z")}
          />
        </Field>

        <Field label="Frizura">
          <Chips
            items={HAIRS}
            active={p.hair}
            onPick={(id) => set("hair", id as HairId)}
          />
        </Field>

        <Field label="Boja kose">
          <Swatches
            colors={HAIR_COLORS}
            active={hairColor}
            onPick={setHairColor}
          />
        </Field>

        <Field label="Brada">
          <Chips
            items={BEARDS}
            active={p.beard}
            onPick={(id) => set("beard", id as BeardId)}
          />
        </Field>

        <Field label="Naočare">
          <Chips
            items={GLASSES}
            active={p.glasses}
            onPick={(id) => set("glasses", id as GlassesId)}
          />
        </Field>

        <Field label="Ton kože">
          <Swatches
            colors={SKINS.map((s) => s.base)}
            active={p.skin}
            onPick={(i) => set("skin", i)}
          />
        </Field>

        <Field label="Majica">
          <Swatches
            colors={SHIRTS.map((s) => s.base)}
            active={p.shirt}
            onPick={(i) => set("shirt", i)}
          />
        </Field>
      </section>

      {/* --- raspon --- */}
      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Isti čovek, pet stanja
          </h2>
          <p className="text-xs text-muted-foreground">
            Lice se ne menja -- menjaju se samo brojevi. Pogledaj sa metar
            razdaljine: ako se prva i poslednja jasno razlikuju, mehanika radi.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {PRESETS.map((pr) => (
            <figure
              key={pr.label}
              className="flex flex-col items-center gap-1 bg-card px-0.5 py-2"
            >
              <AvatarFigure
                params={{ ...p, fat: pr.fat, muscle: pr.muscle }}
                hairColor={hairColor}
                className="h-auto w-full"
              />
              <figcaption className="text-center font-mono text-[8px] uppercase leading-tight text-muted-foreground">
                {pr.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Slider({
  id,
  label,
  hint,
  value,
  onChange,
  format,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={`sl-${id}`} className="text-sm font-medium text-foreground">
          {label}
          <span className="block text-[11px] font-normal text-muted-foreground">
            {hint}
          </span>
        </label>
        <output className="font-mono text-xs font-semibold tabular-nums text-primary">
          {format(value)}
        </output>
      </div>
      <input
        id={`sl-${id}`}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-8 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chips({
  items,
  active,
  onPick,
}: {
  items: readonly { id: string; label: string }[];
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          aria-pressed={it.id === active}
          onClick={() => onPick(it.id)}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            it.id === active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({
  colors,
  active,
  onPick,
}: {
  colors: readonly string[];
  active: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          aria-label={`Opcija ${i + 1}`}
          aria-pressed={i === active}
          onClick={() => onPick(i)}
          style={{ background: c }}
          className={`size-8 rounded-full border-2 transition-transform ${
            i === active ? "scale-110 border-primary" : "border-border"
          }`}
        />
      ))}
    </div>
  );
}
