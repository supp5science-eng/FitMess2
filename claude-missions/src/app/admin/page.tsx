import Link from "next/link";

import { getT } from "@/lib/i18n/server";

/**
 * F033: the `/admin` landing page -- reachable only by an `is_admin=true`
 * profile (enforced by `src/app/admin/layout.tsx`'s `requireAdmin()` call,
 * AS-059). Links to the sub-areas future features build on top of this
 * gate: F034/F035 (hrana -- food import queue + editor), F036 (korisnici),
 * F075 (troškovi -- AI usage/cost dashboard). Those routes don't exist yet,
 * so these links 404 until their own feature ships -- the same "route may
 * 404 for now" precedent F005's bottom nav established for `/nedelja` and
 * `/agent`.
 */
export default async function AdminPage() {
  const { t } = await getT();

  const ADMIN_SECTIONS = [
    {
      href: "/admin/hrana",
      label: t("admin.hrana.title"),
      description: t("admin.section.hrana.desc"),
    },
    {
      href: "/admin/korisnici",
      label: t("admin.section.korisnici.label"),
      description: t("admin.section.korisnici.desc"),
    },
    {
      href: "/admin/troskovi",
      label: t("admin.section.troskovi.label"),
      description: t("admin.section.troskovi.desc"),
    },
    // Proba okreta -- klupa na kojoj se bira kadar i dotera sablon, pre nego
    // sto avatar ide na pocetni ekran. Bez i18n kljuca, kao i ostale probe.
    // Nasledjuje /admin/klon3d, koji je isto pitanje postavio za pravi 3D mesh
    // i odgovorio odrecno; ta stranica je obrisana sa mainom 28.08.
    {
      href: "/admin/okret",
      label: "Okret",
      description: "Slike → kadar → orbit → frejmovi koje vrtis prstom",
    },
    // Dijagnostika, ne feature -- isto bez i18n ključa. Postoji zato što se
    // "koje modele naš ključ vidi" inače ne može proveriti bez terminala ili
    // bez lepljenja tajne u adresnu liniju.
    {
      href: "/admin/modeli",
      label: "Modeli",
      description: "Šta naš Gemini ključ stvarno vidi",
    },
  ] as const;

  return (
    <main
      data-testid="admin-landing"
      className="flex flex-1 flex-col gap-6 px-6 py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t("admin.title")}
      </h1>
      <ul className="flex flex-col gap-3">
        {ADMIN_SECTIONS.map(({ href, label, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-md border border-border bg-background px-4 py-3 hover:bg-muted"
            >
              <span className="block text-sm font-medium text-foreground">
                {label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
