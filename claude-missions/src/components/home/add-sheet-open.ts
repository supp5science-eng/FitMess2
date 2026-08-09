/**
 * A way for the home screen to open the "+" menu (`add-sheet.tsx`) from
 * somewhere other than the "+" button itself.
 *
 * Why it is a subscription rather than React state: `AddSheet` owns both its
 * trigger and its open state, and it is rendered by the app shell's floating
 * nav bar -- a different branch of the tree from the page content underneath
 * it. There is no common ancestor to hang the state on short of making the
 * whole shell stateful and threading a prop through every page, which is a lot
 * of moving parts for one boolean.
 *
 * Kept deliberately tiny: one caller asks, whoever is mounted answers. If
 * nothing is mounted (a full-bleed route with no nav bar), the call is a no-op
 * rather than an error -- opening a menu that isn't on screen is not a failure
 * worth crashing a page over.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Open the "+" menu, exactly as tapping the "+" button does. */
export function openAddSheet(): void {
  // Copied before iterating: a listener that unsubscribes while responding
  // would otherwise mutate the set mid-loop.
  for (const listener of [...listeners]) listener();
}

export function subscribeToAddSheetRequests(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
