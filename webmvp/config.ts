/**
 * Test-build configuration.
 *
 * Set `FEEDBACK_URL` to a form of your own (Google Forms, Typeform, anything
 * with a public link) and a "Send feedback" button appears on the home screen.
 * Leave it empty and the button stays hidden — a build in someone's hands must
 * never show a control that goes nowhere.
 */

export const FEEDBACK_URL = '';

/**
 * The play summary appended to that link as query parameters.
 *
 * The reason this exists: a form collects opinions, and opinions are the *less*
 * useful half. What decides whether this game is worth building further is
 * whether people come back — and that is a fact about behaviour, not a question
 * anyone can answer accurately about themselves. So every response carries the
 * tester's own retention data with it.
 *
 *   d  days since they first opened the build
 *   a  distinct days they actually played        ← a / d is the retention signal
 *   g  games finished
 *   w  games won
 *   s  current streak
 *
 * Google Forms ignores unknown parameters, so the link is safe as-is. To have
 * them captured, build a pre-filled link (Forms → ⋮ → "Get pre-filled link")
 * and map each `entry.NNNN` field to the matching key here.
 */
export interface PlaySummary {
  d: number;
  a: number;
  g: number;
  w: number;
  s: number;
}

export function feedbackLink(summary: PlaySummary): string {
  if (!FEEDBACK_URL) return '';
  const url = new URL(FEEDBACK_URL);
  for (const [key, value] of Object.entries(summary)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
