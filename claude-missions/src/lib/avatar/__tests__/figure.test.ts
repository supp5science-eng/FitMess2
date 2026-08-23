import { describe, expect, it } from "vitest";

import { detail, geom, type BodyParams } from "@/lib/avatar/figure";

const base: BodyParams = { fat: 0.5, muscle: 0.5, height: 0.5, fem: false };

describe("geom", () => {
  it("širi struk kako masnoća raste", () => {
    const mrsav = geom({ ...base, fat: 0 });
    const debeo = geom({ ...base, fat: 1 });
    expect(debeo.w.waist).toBeGreaterThan(mrsav.w.waist);
    expect(debeo.w.belly).toBeGreaterThan(mrsav.w.belly);
  });

  it("širi ramena kako mišićavost raste", () => {
    const bez = geom({ ...base, muscle: 0 });
    const jak = geom({ ...base, muscle: 1 });
    expect(jak.w.shoulder).toBeGreaterThan(bez.w.shoulder);
    expect(jak.limb.upperArm).toBeGreaterThan(bez.limb.upperArm);
  });

  it("na krajevima raspona daje suprotne siluete", () => {
    // Ovo je jedini razlog zašto feature postoji: „zapušten" mora da ima
    // stomak ISPRED grudi, a „trenirano" struk UŽI od grudi. Ako ova dva
    // ikad prestanu da važe, avatar više ne pokazuje napredak.
    const zapusten = geom({ ...base, fat: 1, muscle: 0 });
    const trenirano = geom({ ...base, fat: 0, muscle: 1 });
    expect(zapusten.w.belly).toBeGreaterThan(zapusten.w.chest);
    expect(trenirano.w.waist).toBeLessThan(trenirano.w.chest);
  });

  it("ženska proporcija: uža ramena, širi kukovi", () => {
    const m = geom({ ...base, fem: false });
    const z = geom({ ...base, fem: true });
    expect(z.w.shoulder).toBeLessThan(m.w.shoulder);
    expect(z.w.hip).toBeGreaterThan(m.w.hip);
  });
});

describe("detail", () => {
  it("definicija = mišići MINUS salo — trening se ne vidi ispod masnoće", () => {
    const jakISalo = detail(geom({ ...base, fat: 1, muscle: 1 }));
    const jakISuv = detail(geom({ ...base, fat: 0, muscle: 1 }));
    expect(jakISalo.abs).toBe(0);
    expect(jakISuv.abs).toBeGreaterThan(0.9);
  });

  it("stomak se pojavljuje tek na visokoj masnoći", () => {
    expect(detail(geom({ ...base, fat: 0.2 })).belly).toBe(0);
    expect(detail(geom({ ...base, fat: 1 })).belly).toBeGreaterThan(0.9);
  });
});
