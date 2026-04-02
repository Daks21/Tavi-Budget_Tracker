// src/theme/typography.ts

export const typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },

  fontSize: {
    display: 28,
    heading1: 22,
    heading2: 18,
    bodyLarge: 16,
    body: 14,
    bodySmall: 13,
    caption: 12,
    label: 11,
  },

  lineHeight: {
    display: 36,
    heading1: 30,
    heading2: 26,
    bodyLarge: 24,
    body: 22,
    bodySmall: 20,
    caption: 18,
    label: 16,
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  letterSpacing: {
    label: 0.8,
    normal: 0,
  },
} as const;