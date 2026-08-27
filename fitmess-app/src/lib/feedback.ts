import * as Haptics from "expo-haptics";

/**
 * Touch feedback — the thing the WebView could never do properly.
 *
 * On the web this was a fight. Android got `navigator.vibrate()`, which is a
 * blunt buzz of the whole phone rather than the Taptic Engine's tap, and iOS
 * gave web pages no haptics at all — so the site resorted to rendering an
 * invisible `<input type="checkbox" switch>` and toggling it, because Safari
 * plays a haptic for that control and only for that control. A trick that
 * works by accident, on one control, in one browser, with a shelf life: Apple
 * has it slated to stop in iOS 26.5.
 *
 * Here it is one function call into the Taptic Engine, with no expiry date.
 *
 * The names below are INTENTIONS, not intensities. Call sites say what
 * happened — a tap landed, a value crossed a notch, a meal was saved — and
 * this file decides how strong that feels. Tuning the whole app's feel then
 * means editing one file, not hunting every `impactAsync` in the tree.
 */

/** Every haptic is best-effort: a phone with the Taptic Engine disabled, or a
 *  simulator, rejects the promise, and a missed buzz must never take a screen
 *  down with it. */
const safely = (run: () => Promise<void>) => {
  void run().catch(() => {});
};

export const feedback = {
  /** A normal button, a tab, a list row. The workhorse. */
  tap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** A press that commits something the user can see change — opening a sheet,
   *  picking a meal, sending a message to Jarvis. */
  press: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** A slider crossing a notch, a picker landing on a value. Deliberately the
   *  lightest thing here: it can fire many times per second while a finger
   *  moves, and anything stronger turns into a rattle. */
  tick: () => safely(() => Haptics.selectionAsync()),

  /** A meal logged, water added, a weigh-in saved. The one that should feel
   *  like the app caught something. */
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Reserved for things the user must notice and act on — a failed save, a
   *  lost session. NOT for going over a calorie target: that is not an error,
   *  and buzzing it that way would be the app telling the user off. */
  error: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),

  /** Something needs a second look but nothing broke. */
  warning: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
} as const;
