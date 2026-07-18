import Link from "next/link";

/**
 * F033 / AS-059: the Serbian "access denied" page -- where `requireAdmin()`
 * (`src/lib/auth/admin.ts`) sends an authenticated but non-admin visitor who
 * hits `/admin/*`. Deliberately a real, friendly page (never a raw 404/500)
 * and deliberately NOT nested under `/admin` itself, so it can never be
 * caught by `src/app/admin/layout.tsx`'s own `requireAdmin()` call and
 * redirect-loop back into itself.
 *
 * Reachable only by an already-authenticated (and, per `src/middleware.ts`'s
 * default-deny matrix, already onboarded) visitor -- an anonymous request
 * never reaches this page at all, since `requireAdmin()` sends anonymous
 * visitors to `/prijava` instead, and `src/middleware.ts` would already have
 * redirected an anonymous request to `/prijava` before this page's code
 * ever ran.
 */
export default function NemasPristupPage() {
  return (
    <main
      data-testid="nemas-pristup-page"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <h1 className="text-lg font-semibold text-foreground">Nemaš pristup</h1>
      <p data-testid="nemas-pristup-body" className="text-sm text-muted-foreground">
        Nemaš dozvolu da vidiš ovu stranicu.
      </p>
      <Link
        href="/danas"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Nazad na Danas
      </Link>
    </main>
  );
}
