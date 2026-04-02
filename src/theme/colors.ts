// src/theme/colors.ts

export const colors = {
  light: {
    brand: '#1B2B4B',
    brandSubtle: '#2D4270',

    accentMain: '#2A9D8F',
    accentSoft: '#4DB8AC',
    accentSubtle: '#E8F7F5',

    warningMain: '#E9A319',
    warningSoft: '#F5C462',
    warningSubtle: '#FEF3DC',

    dangerMain: '#E63946',
    dangerSoft: '#F08080',
    dangerSubtle: '#FDECEA',

    successMain: '#4CAF7D',
    successSoft: '#80C9A0',
    successSubtle: '#EBF7F0',

    bgPage: '#F7F8FA',
    bgCard: '#FFFFFF',
    bgInput: '#F3F4F6',

    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
    textDisabled: '#C4C9D4',
    textInverse: '#FFFFFF',

    border: '#E5E7EB',
    borderStrong: '#D1D5DB',

    tabBg: '#FFFFFF',
    tabActive: '#1B2B4B',
    tabInactive: '#9CA3AF',

    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  dark: {
    brand: '#1B2B4B',
    brandSubtle: '#243553',

    accentMain: '#2A9D8F',
    accentSoft: '#4DB8AC',
    accentSubtle: '#0D3330',

    warningMain: '#E9A319',
    warningSoft: '#F5C462',
    warningSubtle: '#3D2A00',

    dangerMain: '#E63946',
    dangerSoft: '#F08080',
    dangerSubtle: '#3D0A0D',

    successMain: '#4CAF7D',
    successSoft: '#80C9A0',
    successSubtle: '#0D2E1A',

    bgPage: '#121A2B',
    bgCard: '#1E2D45',
    bgInput: '#243553',

    textPrimary: '#F0F4FF',
    textSecondary: '#9CA3AF',
    textDisabled: '#4B5563',
    textInverse: '#1A1A2E',

    border: '#2D3B55',
    borderStrong: '#3D4F70',

    tabBg: '#1E2D45',
    tabActive: '#2A9D8F',
    tabInactive: '#6B7280',

    overlay: 'rgba(0, 0, 0, 0.7)',
  },
} as const;

export type ColorScheme = typeof colors.light;