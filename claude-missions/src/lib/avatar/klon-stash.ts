/**
 * Where a klon lives between "drawn" and "has an account".
 *
 * The klon screen runs BEFORE registration (landing -> "Kreni" -> `/klon` ->
 * `/upitnik`), and the server deliberately stores nothing for a visitor with no
 * user id. So the drawing has to survive the trip through the questionnaire and
 * sign-up somewhere on the visitor's own device -- the same problem
 * `@/lib/onboarding/storage` already solves for the questionnaire answers, with
 * one difference that rules out the same answer.
 *
 * IT IS NOT `localStorage`. That store holds strings, so a PNG would go in as
 * base64 -- a third larger than the bytes -- against a quota that is about 5MB
 * for EVERYTHING the origin keeps, questionnaire answers included. A klon is
 * around a megabyte. It would usually fit, and "usually" is the problem: over
 * quota, `setItem` throws, and the failure lands on a visitor who just waited
 * two minutes. IndexedDB stores the Blob as bytes, against a quota measured in
 * hundreds of megabytes.
 *
 * Every function here is browser-only and NEVER throws: a blocked or missing
 * database (private mode, a locked-down browser) means the visitor draws their
 * klon again after signing up, never a broken screen.
 */

const DB_NAME = "fitmess";
const STORE = "klon";
/** One record, one key -- there is only ever one pending klon. */
const KEY = "pending";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Another tab holding an old version open would otherwise hang this
    // promise forever, and with it the screen that awaited it.
    request.onblocked = () => resolve(null);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, mode);
          const request = work(tx.objectStore(STORE));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
        } catch {
          resolve(null);
        }
      })
  );
}

/** Keep the drawn klon until the visitor has an account to attach it to. */
export function stashKlon(blob: Blob): Promise<void> {
  return run("readwrite", (store) => store.put(blob, KEY)).then(() => undefined);
}

/** The pending klon, or `null` if there is none (or the store is unavailable). */
export function readStashedKlon(): Promise<Blob | null> {
  return run<Blob>("readonly", (store) => store.get(KEY));
}

/**
 * Drop it. Called once the klon is safely on the account -- and ONLY then: a
 * stash cleared before the upload lands leaves the user with no klon and no way
 * back to the one they waited for.
 */
export function clearStashedKlon(): Promise<void> {
  return run("readwrite", (store) => store.delete(KEY)).then(() => undefined);
}
