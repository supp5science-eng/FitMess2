/**
 * THE version of FitMess — one number for the product, in one place.
 *
 * It used to live in four files that could quietly disagree, and did: on the
 * day App Store approved a binary calling itself `1.0`, `package.json` and the
 * Podešavanja screen both still said `0.1.0`. So the one place a user can
 * actually read a version showed a number no store, no build and no tag had
 * ever heard of. A second bump to 2.0.1 was then lost whole in a merge without
 * anything failing, which is the same weakness wearing a different hat.
 *
 * The three files that cannot import this constant — `package.json`, the
 * Android `versionName` and the iOS `MARKETING_VERSION` — are pinned to it by
 * `__tests__/app-version.test.ts`, which reads them off disk and fails when one
 * drifts. Bumping a version is therefore: change the line below, run the tests,
 * fix whatever they name.
 *
 * NOT the same thing as a build number. `versionCode` (Play) and
 * `CURRENT_PROJECT_VERSION` (App Store Connect) are rewritten by CI on every
 * build and are burned forever — see `codemagic.yaml`. This is the version a
 * human reads; those are counters a store uses to tell two uploads apart.
 */
export const APP_VERSION = "2.0.1";
