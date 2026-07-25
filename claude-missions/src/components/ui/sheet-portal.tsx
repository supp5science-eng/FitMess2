"use client";

import { createPortal } from "react-dom";

/**
 * Renders a bottom-sheet/overlay at the end of `<body>` instead of where it sits
 * in the tree.
 *
 * Needed since 2026-07-25, when "Koraci" and "Voda" moved INSIDE the home
 * screen's horizontal pager: iOS Safari is unreliable about `position: fixed`
 * inside a scroll container -- a fixed overlay can end up positioned against the
 * container rather than the viewport, or clipped by its `overflow`. Escaping the
 * scrolling subtree removes the whole class of problem instead of fighting it
 * with z-index and stacking contexts.
 *
 * Callers keep owning their own open/close state and markup; this only changes
 * WHERE the markup lands. Testing-library's `screen` queries the whole document,
 * so existing sheet tests are unaffected.
 *
 * SSR-safe: returns the node unchanged when there is no `document`. Sheets are
 * only ever rendered while open (i.e. after hydration), so this branch is a
 * guard, not a code path with a visible effect.
 */
export function sheetPortal(node: React.ReactNode): React.ReactNode {
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
