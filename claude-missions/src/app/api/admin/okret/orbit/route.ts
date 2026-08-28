import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import {
  downloadVideo,
  orbitStatus,
  startOrbitVideo,
  veoErrorSr,
} from "@/lib/ai/veo";
import {
  buildOkretVideoPrompt,
  okretAspect,
  OKRET_KADROVI,
  okretNegativePrompt,
  type OkretKadar,
} from "@/lib/avatar/okret-prompt";

/**
 * `POST /api/admin/okret/orbit` -- drugi plaćeni korak: kadar -> obrt.
 *
 * DVA KORAKA, NE JEDAN, i to je jedina važna odluka u ovom fajlu.
 *
 * Veo ume da radi po nekoliko minuta. Jedan zahtev koji čeka da se posao
 * završi presekla bi serverless funkcija mnogo pre toga, a presečen zahtev
 * izgleda korisniku IDENTIČNO kao model koji ne radi: ekran zauvek stoji na
 * "pravimo", i nema reda u logu koji na to pokazuje. Zato:
 *
 *   korak "start"  -> zakaže posao, vrati njegovo ime, gotovo za sekundu
 *   korak "status" -> pita jednom "je li gotovo", vrati snimak kad jeste
 *
 * Petlja je u pregledaču. Čekanje ne troši nijednu serverless sekundu, i
 * osvežavanje stranice ne gubi posao koji je već plaćen -- ime posla je sve
 * što treba da mu se čovek vrati.
 *
 * ADMIN SAMO, i ne čuva ništa.
 */

export const maxDuration = 300;

type Telo = {
  korak?: "start" | "status";
  kadar?: string;
  slika?: string;
  mime?: string;
  prompt?: string;
  stepeni?: number;
  rezolucija?: "720p" | "1080p";
  model?: string;
  operacija?: string;
};

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error_sr: guard.error_sr },
      { status: guard.status }
    );
  }

  let telo: Telo;
  try {
    telo = (await request.json()) as Telo;
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: "Neispravan zahtev." },
      { status: 400 }
    );
  }

  /* ---------------------------------------------------------------- */
  /* status -- jedno pitanje, bez petlje                               */
  /* ---------------------------------------------------------------- */
  if (telo.korak === "status") {
    if (!telo.operacija) {
      return NextResponse.json(
        { ok: false, error_sr: "Nedostaje ime posla." },
        { status: 400 }
      );
    }

    try {
      const status = await orbitStatus(telo.operacija);
      if (!status.gotovo) {
        return NextResponse.json({ ok: true, gotovo: false });
      }
      if (status.videoUri === null) {
        // Posao je gotov ali snimka nema. Sirovi odgovor ide nazad jer je oblik
        // odgovora ono što se menja između verzija preview modela -- bez njega
        // je jedini trag "nešto nije uspelo".
        return NextResponse.json({
          ok: false,
          gotovo: true,
          error_sr:
            "Posao je završen, ali u odgovoru nema snimka. Sirovi odgovor je ispod.",
          sirovo: status.sirovo,
        });
      }

      // Preuzima SERVER: adresa traži isti API ključ, koji nikad ne sme u
      // pregledač. Uz to, snimak sa našeg porekla može da se seče u <canvas>
      // bez CORS problema -- što je tačno ono što klupa radi sa frejmovima.
      const video = await downloadVideo(status.videoUri);
      return NextResponse.json({
        ok: true,
        gotovo: true,
        video: video.base64,
        mime: video.mimeType,
        bajtova: video.bytes,
      });
    } catch (err) {
      console.error("[okret] status pao:", err);
      return NextResponse.json(
        {
          ok: false,
          error_sr: veoErrorSr(err),
          detalj: err instanceof Error ? err.message.slice(0, 600) : String(err),
        },
        { status: 502 }
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /* start -- zakazivanje                                              */
  /* ---------------------------------------------------------------- */
  const kadarRaw = String(telo.kadar ?? "portret");
  if (!OKRET_KADROVI.includes(kadarRaw as OkretKadar)) {
    return NextResponse.json(
      { ok: false, error_sr: `Nepoznat kadar: ${kadarRaw}` },
      { status: 400 }
    );
  }
  const kadar = kadarRaw as OkretKadar;

  if (!telo.slika) {
    return NextResponse.json(
      { ok: false, error_sr: "Nema kadra od kog bi orbit krenuo." },
      { status: 400 }
    );
  }

  const stepeni = Number.isFinite(telo.stepeni) ? Number(telo.stepeni) : 180;
  const prompt =
    String(telo.prompt ?? "").trim() || buildOkretVideoPrompt(kadar, stepeni);

  try {
    const operacija = await startOrbitVideo({
      slikaBase64: telo.slika,
      slikaMime: telo.mime || "image/png",
      prompt,
      negativePrompt: okretNegativePrompt(),
      aspectRatio: okretAspect(kadar),
      resolution: telo.rezolucija ?? "720p",
      model: telo.model,
    });

    return NextResponse.json({ ok: true, operacija, prompt });
  } catch (err) {
    console.error("[okret] start pao:", err);
    return NextResponse.json(
      {
        ok: false,
        error_sr: veoErrorSr(err),
        detalj: err instanceof Error ? err.message.slice(0, 600) : String(err),
      },
      { status: 502 }
    );
  }
}
