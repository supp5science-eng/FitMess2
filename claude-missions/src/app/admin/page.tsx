import Link from "next/link";

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
const ADMIN_SECTIONS = [
  {
    href: "/admin/hrana",
    label: "Hrana",
    description: "Odobravanje i uređivanje unosa hrane.",
  },
  {
    href: "/admin/korisnici",
    label: "Korisnici",
    description: "Pregled i upravljanje korisničkim nalozima.",
  },
  {
    href: "/admin/troskovi",
    label: "Troškovi",
    description: "Pregled troškova AI poziva.",
  },
] as const;

export default function AdminPage() {
  return (
    <main
      data-testid="admin-landing"
      className="flex flex-1 flex-col gap-6 px-6 py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Administracija
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
