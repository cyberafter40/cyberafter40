import * as Haptics from 'expo-haptics';

/**
 * Haptics wrapper.
 *
 * Every call is a no-op when the player has haptics disabled, and failures are
 * swallowed — a device without a taptic engine must not throw mid-game.
 */
let enabled = true;

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

function safely(run: () => Promise<unknown>): void {
  if (!enabled) return;
  void run().catch(() => undefined);
}

/** Keypad taps — light and quiet. */
export const tapFeedback = () =>
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Submitting a guess. */
export const submitFeedback = () =>
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

export const successFeedback = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const warningFeedback = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

export const errorFeedback = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
