/**
 * Veo -- generisanje videa na istom Gemini ključu koji aplikacija već koristi.
 *
 * Odvojen fajl od `gemini.ts`, a ne još dvesta linija u njemu, iz jednog
 * konkretnog razloga: video ne ide kroz `generateContent`. To je LONG-RUNNING
 * OPERACIJA -- pošalješ zahtev, dobiješ ime posla, pa pitaš "je li gotovo" dok
 * ne bude. `postToModel` u `gemini.ts` je zakucan na `:generateContent` i na
 * jedan odgovor, i teranje videa kroz njega bi značilo prepravljanje funkcije
 * kroz koju danas prolazi svaki živi tok u aplikaciji (obrok, glas, deklaracija).
 * Ovaj fajl ne dira nijedan od njih.
 *
 * ⚠️ TAJ ISTI TRIK SA KLJUČEM VAŽI I OVDE. Klasični AI Studio ključevi (`AIza…`)
 * putuju kao `?key=`; noviji (`AQ.…`) se tako odbijaju i primaju se samo kao
 * `x-goog-api-key` zaglavlje, a odbijanje je `400 API_KEY_INVALID` -- izgleda
 * TAČNO kao pokvaren ključ. To je već koštalo jednog popodneva u `gemini.ts`
 * (vidi `docs/klon.md`, zamka 1), pa je ovde ponovljeno namerno umesto da se
 * otkrije po drugi put.
 */

import { GeminiError, isQuotaError } from "@/lib/ai/gemini";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Podrazumevani video model.
 *
 * Kao i `GEMINI_IMAGE_MODEL`, `GEMINI_VIDEO_MODEL` postoji da se ime ISPRAVI
 * kad ga Google preimenuje, a ne da se spusti na slabiji model. Preview modeli
 * se preimenuju bez najave, i tada `predictLongRunning` vraća 404 koji izgleda
 * kao da video uopšte ne radi na ključu.
 *
 * Zato `listVideoModels()` ispod postoji: ne nagađaj ime, pitaj ključ.
 */
const VIDEO_MODEL = "veo-3.1-generate-preview";

/** Slanje zahteva je brzo -- posao se tek zakazuje. Dugo traje čekanje, a ono
 *  se ne dešava unutar jednog zahteva (vidi `startOrbitVideo`). */
const REQUEST_TIMEOUT_MS = 60_000;
/** Preuzimanje gotovog snimka. Nekoliko megabajta preko Google-ovog CDN-a. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  return key;
}

/**
 * Jedan poziv ka Google-u, sa ključem predatim na OBA načina.

 * Isti obrazac kao `postToModel` u `gemini.ts`: prvo `?key=` (nepromenjeno
 * ponašanje za svaki ključ koji već radi), pa ponovi sa zaglavljem SAMO ako je
 * odgovor bio baš "tvoj ključ je neispravan". Svaki drugi neuspeh se vraća kakav
 * jeste -- ponavljanje bi samo dvaput potrošilo kvotu.
 */
async function googleFetch(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  timeoutMs: number
): Promise<Response> {
  const key = apiKey();
  const url = `${API_ROOT}/${path.replace(/^\/+/, "")}`;

  async function send(useHeader: boolean): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(
        useHeader ? url : `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`,
        {
          method: init.method,
          headers: {
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(useHeader ? { "x-goog-api-key": key } : {}),
          },
          ...(init.body ? { body: JSON.stringify(init.body) } : {}),
          signal: controller.signal,
          cache: "no-store",
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  const first = await send(false);
  if (first.status !== 400) return first;

  const detail = await first
    .clone()
    .text()
    .catch(() => "");
  if (!detail.includes("API_KEY_INVALID")) return first;

  console.info("[veo] key rejected as ?key=, retrying as x-goog-api-key");
  return send(true);
}

async function expectOk(response: Response, what: string): Promise<unknown> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GeminiError(
      `Veo ${what} ${response.status}: ${detail.slice(0, 400)}`,
      response.status
    );
  }
  return response.json();
}

/* ------------------------------------------------------------------ */
/* Otkrivanje modela -- ne nagađaj ime, pitaj ključ                    */
/* ------------------------------------------------------------------ */

export type VideoModelRow = { name: string; methods: string[] };

/**
 * Koje video modele ovaj ključ stvarno vidi.
 *
 * Isti pristup koji `/admin/modeli` već koristi za slike, i iz istog razloga:
 * "video ne radi" ima tri sasvim različita uzroka -- ključ nema pristup video
 * modelima, model postoji pod drugim imenom, ili je zahtev pogrešan -- a sva
 * tri se javljaju kao neuspeh. Ovo razdvaja prvi dva od trećeg pre nego što se
 * potroši ijedan kredit.
 *
 * Video modeli se prepoznaju po `predictLongRunning` u podržanim metodama, a ne
 * po imenu: ime je ono što se menja.
 */
export async function listVideoModels(): Promise<VideoModelRow[]> {
  const json = (await expectOk(
    await googleFetch("models?pageSize=500", { method: "GET" }, REQUEST_TIMEOUT_MS),
    "models"
  )) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };

  return (json.models ?? [])
    .map((model) => ({
      name: (model.name ?? "?").replace(/^models\//, ""),
      methods: model.supportedGenerationMethods ?? [],
    }))
    .filter(
      (model) =>
        model.methods.some((method) => /predictLongRunning/i.test(method)) ||
        // Omni je video model ali se ne zove ni "veo" ni "video" i ne ide kroz
        // predictLongRunning -- bez njega u filteru lista bi tvrdila da ga na
        // ključu nema.
        /veo|video|omni/i.test(model.name)
    );
}

/* ------------------------------------------------------------------ */
/* Orbit                                                               */
/* ------------------------------------------------------------------ */

export type OrbitOptions = {
  /** Prvi frejm -- kadar po šablonu, base64 bez `data:` prefiksa. */
  slikaBase64: string;
  slikaMime: string;
  prompt: string;
  negativePrompt?: string;
  /** "3:4" za portret, "9:16" za figuru. Veo prima samo neke odnose; ako ovaj
   *  ne prođe, greška to kaže doslovno i bira se drugi. */
  aspectRatio: string;
  resolution?: "720p" | "1080p";
  model?: string;
};

/**
 * Zakazuje orbit i vraća IME POSLA -- ne čeka da se završi.
 *
 * ⚠️ ZAŠTO SE NE ČEKA U ISTOM ZAHTEVU. Veo ume da radi i po nekoliko minuta.
 * Serverless funkcija se preseca mnogo pre toga, a presečen zahtev izgleda
 * korisniku identično kao model koji ne radi -- ekran zauvek stoji na "pravimo",
 * bez ijednog reda u logu koji na to pokazuje. Zato: jedan kratak zahtev
 * zakaže posao, pregledač pita `orbitStatus` na svakih nekoliko sekundi, i
 * čekanje ne troši nijednu serverless sekundu.
 *
 * ⚠️ SLIKA IDE KAO `bytesBase64Encoded`. Ovo je druga stvar nego svuda drugde u
 * aplikaciji: `generateContent` prima slike kao `inline_data`, Veo ih tako NE
 * prima i tiho odbija zahtev. Nije isti oblik tela i ne sme se prepisati iz
 * `gemini.ts`.
 */
export async function startOrbitVideo(options: OrbitOptions): Promise<string> {
  const model = options.model || process.env.GEMINI_VIDEO_MODEL || VIDEO_MODEL;

  const json = (await expectOk(
    await googleFetch(
      `models/${model}:predictLongRunning`,
      {
        method: "POST",
        body: {
          instances: [
            {
              prompt: options.prompt,
              image: {
                bytesBase64Encoded: options.slikaBase64,
                mimeType: options.slikaMime,
              },
            },
          ],
          parameters: {
            aspectRatio: options.aspectRatio,
            resolution: options.resolution ?? "720p",
            ...(options.negativePrompt
              ? { negativePrompt: options.negativePrompt }
              : {}),
            // Nema govora, nema muzike, nema ambijenta. Zvuk se ovde ne koristi
            // ni za šta -- iz videa se seku slike -- a njegovo generisanje se
            // naplaćuje i produžava posao.
            generateAudio: false,
            // Bez ovoga model ume da odbije da nacrta odraslu osobu sa
            // priložene fotografije, što se javlja kao prazan rezultat.
            personGeneration: "allow_adult",
          },
        },
      },
      REQUEST_TIMEOUT_MS
    ),
    "predictLongRunning"
  )) as { name?: string };

  if (!json.name) {
    throw new GeminiError("Veo nije vratio ime posla (operation.name)");
  }
  return json.name;
}

export type OrbitStatus =
  | { gotovo: false }
  | { gotovo: true; videoUri: string }
  /** Posao je gotov, ali u odgovoru nije nađen snimak. Sirovi JSON ide nazad
   *  jer je oblik odgovora ono što se najčešće promeni između verzija modela --
   *  a bez njega je jedini trag "nešto nije uspelo". */
  | { gotovo: true; videoUri: null; sirovo: string };

/**
 * Pita da li je posao gotov. Jedan poziv, bez petlje -- petlja je u pregledaču.
 */
export async function orbitStatus(operacija: string): Promise<OrbitStatus> {
  const json = (await expectOk(
    await googleFetch(operacija, { method: "GET" }, REQUEST_TIMEOUT_MS),
    "operations"
  )) as {
    done?: boolean;
    error?: { message?: string };
    response?: unknown;
  };

  if (json.error?.message) {
    throw new GeminiError(`Veo posao je pao: ${json.error.message}`);
  }
  if (!json.done) return { gotovo: false };

  const uri = nadjiVideoUri(json.response);
  if (uri) return { gotovo: true, videoUri: uri };

  return {
    gotovo: true,
    videoUri: null,
    sirovo: JSON.stringify(json.response ?? json).slice(0, 2000),
  };
}

/**
 * Vadi adresu snimka iz odgovora, ne oslanjajući se na tačan oblik.
 *
 * Namerno pretražuje stablo umesto da čita
 * `response.generateVideoResponse.generatedSamples[0].video.uri`: taj put je
 * tačan danas, a preview modeli menjaju omotač između verzija. Traži se prvi
 * string koji liči na adresu snimka, na bilo kojoj dubini.
 */
function nadjiVideoUri(value: unknown, dubina = 0): string | null {
  if (dubina > 8 || value == null) return null;

  if (typeof value === "string") {
    return /^https?:\/\//.test(value) && /(video|\.mp4|files\/)/i.test(value)
      ? value
      : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = nadjiVideoUri(item, dubina + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = nadjiVideoUri(item, dubina + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Preuzima gotov snimak i vraća ga kao base64.
 *
 * Preuzima SERVER, ne pregledač, iz dva razloga: adresa traži isti API ključ
 * (koji nikad ne sme u pregledač), a snimak koji stigne sa našeg porekla može
 * da se seče u `<canvas>` bez CORS problema -- što je tačno ono što klupa za
 * testiranje radi sa frejmovima.
 */
export async function downloadVideo(
  uri: string
): Promise<{ base64: string; mimeType: string; bytes: number }> {
  const key = apiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(uri, {
      headers: { "x-goog-api-key": key },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new GeminiError(
        `Veo preuzimanje ${response.status}`,
        response.status
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      base64: buffer.toString("base64"),
      mimeType: response.headers.get("content-type") || "video/mp4",
      bytes: buffer.byteLength,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Srpska rečenica za pali video, po istoj podeli koju `cloneErrorSr` već pravi:
 * kvar koji je NAŠ mora da se razlikuje od "probaj sa drugim slikama", inače
 * čovek ide da slika dvadeset novih fotografija zbog zida koji je naš.
 */
export function veoErrorSr(err: unknown): string {
  if (isQuotaError(err)) {
    return "Trenutno je gužva kod nas. Probaj za koji minut.";
  }
  if (err instanceof GeminiError) {
    if (err.status === 404 || err.message.includes("API_KEY_INVALID")) {
      return "Video trenutno ne radi kod nas — nije do tvojih slika. Proveri /admin/okret koji video modeli postoje na ključu.";
    }
    if (err.status === 403) {
      return "Ključ nema pristup video modelima. Treba uključiti naplatu ili nov ključ.";
    }
  }
  return "Nismo uspeli da napravimo okret. Probaj ponovo.";
}
