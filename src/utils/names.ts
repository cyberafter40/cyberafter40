import { createRng } from '@/engine/rng';

/**
 * Friendly default display names.
 *
 * A new player is anonymous but still lands on leaderboards, and "Player 8f3a2c"
 * is a worse first impression than "Quiet Falcon". Derived from the uid so the
 * name is stable across devices and reinstalls without a round trip.
 */
const ADJECTIVES = [
  'Quiet', 'Swift', 'Clever', 'Steady', 'Bright', 'Calm', 'Sharp', 'Curious',
  'Patient', 'Bold', 'Subtle', 'Keen', 'Lucid', 'Nimble', 'Silent', 'Warm',
];

const NOUNS = [
  'Falcon', 'Cipher', 'Lantern', 'Compass', 'Ember', 'Willow', 'Harbor', 'Quartz',
  'Aster', 'Meridian', 'Nomad', 'Prism', 'Beacon', 'Cobalt', 'Juniper', 'Vector',
];

export function generateDisplayName(seed: string): string {
  const rng = createRng(`name:${seed}`);
  return `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`;
}

export const DISPLAY_NAME_MAX = 20;
const DISPLAY_NAME_MIN = 2;

/** Strips control characters, collapses whitespace and trims to the max length. */
export function normaliseDisplayName(input: string): string {
  const printable = input
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  return printable.replace(/\s+/g, ' ').trim().slice(0, DISPLAY_NAME_MAX);
}

export function validateDisplayName(input: string): string | null {
  const name = normaliseDisplayName(input);
  if (name.length < DISPLAY_NAME_MIN) return 'Pick a name with at least 2 characters.';
  if (name.length > DISPLAY_NAME_MAX) return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  return null;
}
