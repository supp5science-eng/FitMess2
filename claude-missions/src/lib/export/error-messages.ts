/**
 * Serbian failure text for the data-export routes, shared by the page (which
 * still handles the old `?greska=` navigation) and by the download button
 * (which reads the same reason off a redirected `fetch` response).
 */
export const EXPORT_ERROR_SR: Record<string, string> = {
  sesija: "Sesija je istekla. Prijavi se ponovo pa pokušaj opet.",
  pdf: "Nismo uspeli da napravimo PDF. Pokušaj ponovo, a ako se ponovi, preuzmi .json ispod.",
  mreza: "Nema veze sa internetom. Proveri konekciju i pokušaj ponovo.",
  "1": "Nismo uspeli da pripremimo tvoj fajl. Proveri konekciju i pokušaj ponovo.",
};

/** Maps a `?greska=` reason to its message; anything unknown falls back to the
 * generic one, so a new reason code can never render as a bare slug. */
export function exportErrorText(reason: string | null | undefined): string {
  if (!reason) return EXPORT_ERROR_SR["1"];
  return EXPORT_ERROR_SR[reason] ?? EXPORT_ERROR_SR["1"];
}
