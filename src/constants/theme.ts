export const Colors = {
  light: {
    text: '#16142B',
    textSecondary: '#625F7A',
    background: '#F5F4FF',
    surface: '#FFFFFF',
    border: '#E4E2F3',
    muted: '#EDEBFA',
    primary: '#4F46E5',
    primarySoft: '#E0E7FF',
    onPrimary: '#FFFFFF',
    accent: '#9333EA',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    highlight: '#FDE68A',
  },
  dark: {
    text: '#F1F0FA',
    textSecondary: '#A4A1BC',
    background: '#0F0E17',
    surface: '#1B1A27',
    border: '#2D2B3D',
    muted: '#262436',
    primary: '#8B93FF',
    primarySoft: '#2A2A5A',
    onPrimary: '#0F0E17',
    accent: '#C084FC',
    success: '#4ADE80',
    successSoft: '#14321F',
    danger: '#F87171',
    dangerSoft: '#3B1717',
    warning: '#FBBF24',
    warningSoft: '#3A2A0A',
    highlight: '#854D0E',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

/** Each deck gets a stable color from this palette (readable on light and dark backgrounds). */
const DECK_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16'];
export const deckColor = (deckId: number) => DECK_COLORS[Math.abs(deckId) % DECK_COLORS.length];

/** `#RRGGBB` + alpha (0-1) -> `#RRGGBBAA`, for tinted backgrounds. */
export const withAlpha = (hex: string, alpha: number) =>
  hex + Math.round(alpha * 255).toString(16).padStart(2, '0');

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 12, lg: 20 } as const;
