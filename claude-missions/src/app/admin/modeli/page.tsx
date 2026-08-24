import type { Metadata } from "next";

/**
 * `/admin/modeli` -- which models does our key actually see?
 *
 * Written because the ordinary way to answer that question was unavailable to
 * the person who needed it: pasting `?key=…` into a browser exposes the secret
 * (and fails outright for key formats that only travel as a header), and the
 * `curl`/node route needs a terminal and a checkout. This page asks the same
 * question from the SERVER, where the key already lives, and prints the answer.
 *
 * Lives under `/admin/*`, so `src/app/admin/layout.tsx` already locks it to
 * `profiles.is_admin === true` -- it needs no gate of its own.
 *
 * It NEVER renders the key, not even partially. The whole point is to answer
 * the question without the secret leaving the server.
 */
export const metadata: Metadata = {
  title: "Modeli",
};

// Always fresh: the answer changes when the key or the plan changes, and a
// cached "no image models" would be worse than useless.
export const dynamic = "force-dynamic";

type ModelRow = { name: string; methods: string[] };

type Probe =
  | { ok: true; models: ModelRow[] }
  | { ok: false; status: number | null; detail: string };

/**
 * Asks Google for the model list, trying BOTH ways of presenting the key.
 *
 * Classic AI Studio keys (`AIza…`) travel as the `?key=` query parameter, which
 * is what `@/lib/ai/gemini` uses. Newer credentials are rejected that way and
 * are only accepted as an `x-goog-api-key` header -- which produces exactly the
 * `API_KEY_INVALID` a browser paste returns for a key that is otherwise fine.
 * Trying both is what turns "invalid" into an actual diagnosis: if the header
 * works and the query does not, the key is good and `gemini.ts` is asking the
 * wrong way.
 */
async function probe(): Promise<{ query: Probe; header: Probe }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const missing: Probe = {
      ok: false,
      status: null,
      detail: "GEMINI_API_KEY nije postavljen na ovom okruženju.",
    };
    return { query: missing, header: missing };
  }

  const base = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200";

  async function ask(url: string, headers: HeadersInit): Promise<Probe> {
    try {
      const response = await fetch(url, { headers, cache: "no-store" });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return { ok: false, status: response.status, detail: detail.slice(0, 400) };
      }
      const json = (await response.json()) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
      };
      return {
        ok: true,
        models: (json.models ?? []).map((model) => ({
          name: model.name ?? "?",
          methods: model.supportedGenerationMethods ?? [],
        })),
      };
    } catch (err) {
      return { ok: false, status: null, detail: String(err).slice(0, 400) };
    }
  }

  const [query, header] = await Promise.all([
    ask(`${base}&key=${encodeURIComponent(key)}`, {}),
    ask(base, { "x-goog-api-key": key }),
  ]);

  return { query, header };
}

function Result({ title, probe: result }: { title: string; probe: Probe }) {
  // Image models first and called out: that is the one this page exists for.
  const images = result.ok
    ? result.models.filter((model) => /image/i.test(model.name))
    : [];

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>

      {!result.ok ? (
        <div className="mt-2 rounded-xl bg-muted p-3">
          <p className="text-sm text-destructive">
            Ne radi{result.status ? ` — HTTP ${result.status}` : ""}.
          </p>
          <pre className="mt-2 overflow-x-auto text-[11px] whitespace-pre-wrap text-muted-foreground">
            {result.detail || "(bez detalja)"}
          </pre>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-foreground">
            Radi — {result.models.length} modela ukupno,{" "}
            <strong>{images.length}</strong> za slike.
          </p>
          {images.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {images.map((model) => (
                <li
                  key={model.name}
                  className="rounded-lg bg-muted px-3 py-2 text-xs text-foreground"
                >
                  <code>{model.name.replace(/^models\//, "")}</code>
                  <span className="ml-2 text-muted-foreground">
                    {model.methods.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Nijedan model za slike na ovom ključu — klon neće moći da se
              nacrta dok se to ne reši.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default async function ModeliPage() {
  const { query, header } = await probe();

  return (
    <main data-testid="admin-modeli" className="flex flex-1 flex-col px-4 pb-10">
      <h1 className="pt-6 text-2xl font-semibold tracking-tight text-foreground">
        Modeli
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Šta naš ključ stvarno vidi. Ključ ne napušta server i ne prikazuje se
        ovde.
      </p>

      <Result title="Ključ kao ?key= (ovako ga kod šalje)" probe={query} />
      <Result title="Ključ kao x-goog-api-key zaglavlje" probe={header} />

      <p className="mt-8 text-xs text-muted-foreground">
        Ako drugi radi a prvi ne, ključ je ispravan a `src/lib/ai/gemini.ts` ga
        šalje na pogrešan način — to je izmena u kodu, ne nov ključ.
      </p>
    </main>
  );
}
