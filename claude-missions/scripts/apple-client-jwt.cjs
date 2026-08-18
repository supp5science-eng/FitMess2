#!/usr/bin/env node
/**
 * Generates the "client secret" Supabase asks for under
 * Authentication -> Providers -> Apple.
 *
 * Despite the name it is not a secret string Apple hands out. Sign in with
 * Apple has no long-lived shared secret: what the provider expects is a JWT
 * that WE sign, with the `.p8` private key downloaded once from
 * developer.apple.com -> Keys. Supabase then presents that JWT to Apple on
 * every token exchange.
 *
 * ## Why this script exists at all
 *
 * Apple caps the token's lifetime at six months (`exp` further out is
 * rejected outright). When it expires, Sign in with Apple stops working —
 * silently. There is no deploy that day, no error in our logs, and the button
 * still renders; taps just come back with the generic Serbian error from
 * `@/lib/auth/errors`. That is also the day the app stops satisfying App Store
 * guideline 4.8, which is what got FitMess rejected on 17.08.2026.
 *
 * So the script prints the expiry date to stderr, loudly, as its main job.
 * Signing a JWT is ten lines; knowing when it dies is the part that matters.
 *
 * ## Usage
 *
 *   node scripts/apple-client-jwt.cjs \
 *     --team-id   <TEAM_ID> \
 *     --key-id    <KEY_ID> \
 *     --client-id app.fitmess.web \
 *     --p8        /c/FitMess2/AuthKey_<KEY_ID>.p8
 *
 * The token goes to stdout alone, so it can be piped or copied without
 * dragging any of the human-facing text along with it.
 *
 * `--client-id` is the SERVICES ID (`app.fitmess.web`), never the bundle id
 * `app.fitmess`. They are deliberately different identifiers — Apple refuses
 * to register a Services ID that collides with an App ID — and this is the
 * web/OAuth flow, which is the one Supabase drives.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

/** Apple's hard ceiling: 15777000 seconds, a hair under six months. */
const MAX_LIFETIME_SECONDS = 15777000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    // Support both `--key value` and `--key=value`.
    if (key.includes("=")) {
      const [k, ...rest] = key.split("=");
      args[k] = rest.join("=");
    } else if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fail(message) {
  process.stderr.write(`\n  GREŠKA: ${message}\n\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

const teamId = args["team-id"];
const keyId = args["key-id"];
const clientId = args["client-id"] || "app.fitmess.web";
const p8Path = args.p8;

if (!teamId || !keyId || !p8Path) {
  fail(
    "nedostaje argument.\n\n" +
      "  node scripts/apple-client-jwt.cjs \\\n" +
      "    --team-id   <TEAM_ID> \\\n" +
      "    --key-id    <KEY_ID> \\\n" +
      "    --client-id app.fitmess.web \\\n" +
      "    --p8        putanja/do/AuthKey_<KEY_ID>.p8"
  );
}

const resolved = path.resolve(p8Path);
if (!fs.existsSync(resolved)) {
  fail(`ne postoji fajl: ${resolved}`);
}

const pem = fs.readFileSync(resolved, "utf8");
if (!pem.includes("BEGIN PRIVATE KEY")) {
  fail(
    `${path.basename(resolved)} ne liči na Apple .p8 ključ (nema "BEGIN PRIVATE KEY").`
  );
}

let privateKey;
try {
  privateKey = crypto.createPrivateKey(pem);
} catch (error) {
  fail(`ključ se ne može pročitati: ${error.message}`);
}

// Apple issues P-256 EC keys for every service. A key of any other type here
// means the wrong file was passed -- an App Store Connect API key and an APNs
// key are also called `AuthKey_*.p8` and are indistinguishable by name.
if (privateKey.asymmetricKeyType !== "ec") {
  fail(
    `očekivan EC ključ, a ovo je "${privateKey.asymmetricKeyType}". ` +
      "Proveri da nisi uzeo APNs ili App Store Connect ključ."
  );
}

const issuedAt = Math.floor(Date.now() / 1000);
const expiresAt = issuedAt + MAX_LIFETIME_SECONDS;

const header = { alg: "ES256", kid: keyId, typ: "JWT" };
const payload = {
  iss: teamId,
  iat: issuedAt,
  exp: expiresAt,
  aud: "https://appleid.apple.com",
  // The Services ID. Apple matches this against the `client_id` Supabase sends
  // on the token exchange; a mismatch fails as `invalid_client`, which surfaces
  // in the app as the same generic error as "provider not enabled".
  sub: clientId,
};

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
  JSON.stringify(payload)
)}`;

// ES256 signatures in a JWT are the raw r||s pair (64 bytes), NOT the DER
// wrapper Node produces by default. Without `ieee-p1363` Apple answers
// `invalid_client` and nothing anywhere says why.
const signature = crypto.sign("sha256", Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: "ieee-p1363",
});

const token = `${signingInput}.${base64url(signature)}`;

const expiryDate = new Date(expiresAt * 1000);
const reminderDate = new Date((expiresAt - 30 * 24 * 60 * 60) * 1000);
const format = (d) => d.toISOString().slice(0, 10);

process.stderr.write(
  [
    "",
    `  Services ID (Client ID):  ${clientId}`,
    `  Key ID:                   ${keyId}`,
    `  Team ID:                  ${teamId}`,
    "",
    `  ⏰ ISTIČE:                ${format(expiryDate)}`,
    `  📅 PODSETNIK U KALENDAR:  ${format(reminderDate)}`,
    "",
    "  Kad istekne, Sign in with Apple prestaje da radi bez ijedne greške u",
    "  logu — i app tog dana prestaje da ispunjava App Store guideline 4.8.",
    "  Postupak obnavljanja: docs/prijava-sa-apple.md, tačka 4.",
    "",
    "  Token je ispod (stdout), nalepi ga u Supabase kao Secret Key:",
    "",
  ].join("\n")
);

process.stdout.write(`${token}\n`);
