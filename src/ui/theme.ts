import { Platform } from 'react-native';

/**
 * MindCode design tokens.
 *
 * The brief asks for minimal, premium, modern and calm — Wordle's restraint
 * with Duolingo's warmth. Concretely that means:
 *
 *  - Two neutral surfaces and exactly one accent. Colour is reserved for
 *    feedback (a guess result) and progress (XP, streak), never decoration.
 *  - Generous vertical rhythm on an 8pt grid, so a screen with three elements
 *    still looks composed.
 *  - Large, confident numerals. The code slots are the hero of the app and
 *    should read from arm's length.
 *  - Nothing pulses, bounces or nags. The daily ritual should feel like a
 *    crossword, not a slot machine.
 */

export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  neutralPill: string;
  warning: string;
  overlay: string;
}

const dark: Palette = {
  bg: '#0E1116',
  surface: '#161A21',
  surfaceRaised: '#1E232C',
  border: '#272D38',
  borderStrong: '#39414F',
  text: '#F3F5F8',
  textMuted: '#9AA4B2',
  textFaint: '#6B7484',
  accent: '#7C6BFF',
  accentSoft: 'rgba(124, 107, 255, 0.16)',
  accentText: '#FFFFFF',
  positive: '#3DDC97',
  positiveSoft: 'rgba(61, 220, 151, 0.15)',
  negative: '#FF8080',
  negativeSoft: 'rgba(255, 128, 128, 0.15)',
  neutralPill: 'rgba(154, 164, 178, 0.14)',
  warning: '#FFC46B',
  overlay: 'rgba(5, 7, 10, 0.72)',
};

const light: Palette = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#E8EAEE',
  borderStrong: '#D3D7DE',
  text: '#12141A',
  textMuted: '#5F6875',
  textFaint: '#98A0AD',
  accent: '#5B4BE0',
  accentSoft: 'rgba(91, 75, 224, 0.10)',
  accentText: '#FFFFFF',
  positive: '#0FA968',
  positiveSoft: 'rgba(15, 169, 104, 0.12)',
  negative: '#DC4B50',
  negativeSoft: 'rgba(220, 75, 80, 0.10)',
  neutralPill: 'rgba(95, 104, 117, 0.10)',
  warning: '#D98613',
  overlay: 'rgba(18, 20, 26, 0.45)',
};

export const palettes = { dark, light } as const;
export type ColorScheme = keyof typeof palettes;

/** 8pt grid. `xs` exists for icon/text gaps only. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

const numericFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  display: { fontSize: 44, lineHeight: 50, fontWeight: '700' as const, letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  /** Tabular figures keep guess history columns from dancing. */
  mono: { fontFamily: numericFont, fontSize: 18, fontWeight: '600' as const },
} as const;

export const motion = {
  /** Feedback should land in a single glance, not a performance. */
  fast: 140,
  base: 220,
  slow: 380,
  celebrate: 620,
} as const;

export function elevation(scheme: ColorScheme, level: 1 | 2 = 1) {
  if (scheme === 'dark') {
    // Shadows read as mud on near-black; a lifted surface colour does the work.
    return { shadowOpacity: 0, elevation: 0 };
  }
  return Platform.select({
    ios: {
      shadowColor: '#0B1020',
      shadowOpacity: level === 1 ? 0.06 : 0.1,
      shadowRadius: level === 1 ? 12 : 22,
      shadowOffset: { width: 0, height: level === 1 ? 4 : 10 },
    },
    android: { elevation: level === 1 ? 2 : 6 },
    default: {},
  }) as object;
}

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  motion: typeof motion;
  elevation: (level?: 1 | 2) => object;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: palettes[scheme],
    spacing,
    radius,
    typography,
    motion,
    elevation: (level: 1 | 2 = 1) => elevation(scheme, level),
  };
}

/** Avatar set — deterministic gradients, no image assets to ship or moderate. */
export const AVATARS: { id: number; from: string; to: string; glyph: string }[] = [
  { id: 0, from: '#7C6BFF', to: '#4E9BFF', glyph: '◆' },
  { id: 1, from: '#3DDC97', to: '#12B7A0', glyph: '●' },
  { id: 2, from: '#FFB86B', to: '#FF7A7A', glyph: '▲' },
  { id: 3, from: '#FF7AC6', to: '#A66BFF', glyph: '■' },
  { id: 4, from: '#63D0FF', to: '#5B4BE0', glyph: '★' },
  { id: 5, from: '#FFD76B', to: '#FF9F43', glyph: '✦' },
];

export function avatarFor(avatarId: number) {
  return AVATARS[Math.abs(avatarId) % AVATARS.length] as (typeof AVATARS)[number];
}
