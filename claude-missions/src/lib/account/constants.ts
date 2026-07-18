/**
 * F019 / AS-015, AS-016: shared, framework-free constant for the
 * type-to-confirm phrase used by both the client dialog
 * (`src/components/profil/delete-account-dialog.tsx`) and the server route
 * (`src/app/api/account/delete/route.ts`).
 *
 * Deliberately its own tiny module rather than exported straight from
 * `route.ts`: `route.ts` imports server-only modules (`next/server`,
 * `createAdminClient`, `deleteAccount`) that must never end up in the
 * client bundle (`tech-decisions.md` -- "Secrets server-only; never in
 * client bundle") -- importing anything from it into a `"use client"`
 * component would pull that whole server-only graph along with it.
 */
export const DELETE_CONFIRMATION_PHRASE = "OBRIŠI";
