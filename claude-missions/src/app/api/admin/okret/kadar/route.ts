import { NextResponse } from "next/server";

import {
  cloneErrorSr,
  generateAvatarClone,
  generateReferencePortrait,
  type InlineImage,
} from "@/lib/ai/gemini";
import { requireAdminApi } from "@/lib/auth/admin";
import {
  buildOkretKadarPrompt,
  okretAspect,
  OKRET_KADROVI,
  proveriBrojSlika,
  type OkretKadar,
} from "@/lib/avatar/okret-prompt";

/**
 * `POST /api/admin/okret/kadar` -- napravi PRVI KADAR (frontalno, 0°).
 *
 * Prvi od dva plaćena koraka, i namerno odvojen od drugog. Kadar je jeftin i
 * gotov za pola minuta; orbit je skup i traje minutima. Deljenje znači da se
 * šablon dotera na jeftinom koraku, pa se tek onda plati skupi -- umesto da
 * svaka prepravka jedne rečenice u promptu košta i ceo video.
 *
 * ADMIN SAMO. `requireAdminApi()` je jedina brava; ovo je klupa za probu, ne
 * korisnički tok, i ne sme da postane javan način da neko troši naš ključ.
 *
 * NE ČUVA NIŠTA. Ni slike, ni kadar, ni red u bazi. Isto obećanje koje
 * `/api/klon` već daje: izvorne fotografije idu inline u zahtev i propadaju čim
 * odgovor stigne.
 */

/** Kadar je jedan poziv ka image modelu (~30s), plus portret pre njega (~30s).
 *  Podrazumevani serverless limit ume da bude kraći od toga. */
export const maxDuration = 300;

/** Po slici, posle smanjivanja u pregledaču. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Sve zajedno. */
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error_sr: guard.error_sr },
      { status: guard.status }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: "Slanje nije uspelo. Probaj ponovo." },
      { status: 400 }
    );
  }

  const kadarRaw = String(formData.get("kadar") ?? "portret");
  if (!OKRET_KADROVI.includes(kadarRaw as OkretKadar)) {
    return NextResponse.json(
      { ok: false, error_sr: `Nepoznat kadar: ${kadarRaw}` },
      { status: 400 }
    );
  }
  const kadar = kadarRaw as OkretKadar;

  const files = formData
    .getAll("slike")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const broj = proveriBrojSlika(files.length);
  if (!broj.ok) {
    return NextResponse.json(
      { ok: false, error_sr: broj.error_sr },
      { status: 400 }
    );
  }

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { ok: false, error_sr: "Jedna slika je prevelika." },
        { status: 400 }
      );
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { ok: false, error_sr: "Slike su zajedno prevelike. Probaj sa manje." },
      { status: 400 }
    );
  }

  const photos: InlineImage[] = await Promise.all(
    files.map(async (file) => ({
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mimeType: file.type || "image/jpeg",
    }))
  );

  /**
   * Prompt se sme prepisati iz klupe -- ali SAMO ovde.
   *
   * Cela poenta `okret-prompt.ts` je da je šablon jedna konstanta u kodu, ista
   * za svakog korisnika. Ovo polje ne ruši to pravilo nego ga služi: iteracija
   * nad tekstom bez deploya je jedini način da se konstanta dotera za pola sata
   * umesto za pola nedelje. Kad tekst legne, prepisuje se U KONSTANTU, i
   * korisnički tok (koji ovo polje nema) ga odatle čita.
   */
  const prepisan = String(formData.get("prompt") ?? "").trim();

  // Referentni portret je SKELA: pojačava vernost lica, ali njegov pad ne sme
  // da obori kadar. Isto ponašanje kao `generateKlon` -- zabeleži i nastavi.
  let portret: InlineImage | null = null;
  const trazenPortret = String(formData.get("portret") ?? "1") !== "0";
  if (trazenPortret) {
    try {
      portret = await generateReferencePortrait(photos);
    } catch (err) {
      console.warn("[okret] referentni portret pao, crtam bez njega:", err);
    }
  }

  const prompt =
    prepisan || buildOkretKadarPrompt(kadar, photos.length, portret !== null);

  try {
    const slika = await generateAvatarClone(
      portret ? [...photos, portret] : photos,
      prompt,
      {
        aspectRatio: okretAspect(kadar),
        // Niže nego kod crteža. Ovde se ne traži slika sa životom u njoj nego
        // verna fotografija lica koje već postoji, a svaki stepen slobode je
        // stepen u kom nos odluta.
        temperature: 0.4,
      }
    );

    return NextResponse.json({
      ok: true,
      slika: slika.base64,
      mime: slika.mimeType,
      // Nazad ide i tekst koji je STVARNO poslat -- da se u klupi vidi šta je
      // proizvelo ovu sliku, umesto da se pretpostavlja.
      prompt,
      portret: portret !== null,
    });
  } catch (err) {
    console.error("[okret] kadar pao:", err);
    return NextResponse.json(
      {
        ok: false,
        error_sr: cloneErrorSr(err),
        detalj: err instanceof Error ? err.message.slice(0, 500) : String(err),
      },
      { status: 502 }
    );
  }
}
