export const Colors = {
  light: {
    text: '#14161B',
    textSecondary: '#5F6570',
    background: '#F5F6F8',
    surface: '#FFFFFF',
    border: '#E2E4E9',
    muted: '#ECEEF2',
    primary: '#4F46E5',
    onPrimary: '#FFFFFF',
    success: '#15803D',
    danger: '#DC2626',
    highlight: '#FDE68A',
  },
  dark: {
    text: '#F1F2F4',
    textSecondary: '#A0A6B0',
    background: '#0E0F12',
    surface: '#1A1C21',
    border: '#2B2E35',
    muted: '#24272D',
    primary: '#8B93FF',
    onPrimary: '#0E0F12',
    success: '#4ADE80',
    danger: '#F87171',
    highlight: '#854D0E',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 12, lg: 20 } as const;
