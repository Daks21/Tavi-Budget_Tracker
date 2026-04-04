// src/components/common/AmountInput.tsx

import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme, type Theme } from '@/theme';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — theme-independent, safe at module level
// ─────────────────────────────────────────────────────────────────────────────

// Larger than theme.typography.fontSize.display (28) for a proper
// calculator-style amount display
const AMOUNT_FONT_SIZE = 40;

const KEY_HEIGHT     = 56;   // comfortable tap target
const MAX_INT_DIGITS = 10;   // max digits before the decimal point
const MAX_DEC_DIGITS = 2;    // max digits after the decimal point

const KEYPAD_ROWS: readonly string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
] as const;

// Static style for the TouchableOpacity that fills each key — defined once at
// module load so it is not re-created on every render of KeyButton.
const KEY_TOUCHABLE: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
}

interface KeyButtonProps {
  label: string;
  onPress: () => void;
  keyStyle: StyleProp<ViewStyle>;
  labelStyle: StyleProp<TextStyle>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — resolve display symbol for currency code
// ─────────────────────────────────────────────────────────────────────────────

function currencySymbol(currency: string): string {
  return currency === 'PHP' ? '₱' : currency;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // ── Outer container ────────────────────────────────────────────────────
    container: {
      gap: theme.spacing.xl,
    },

    // ── Amount display ─────────────────────────────────────────────────────
    displayRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.lg,
    },
    // ₱ symbol sits to the left, pinned to the baseline of the amount text
    symbolText: {
      fontSize: theme.typography.fontSize.heading1,
      lineHeight: theme.typography.lineHeight.heading1,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing.xs,
      // nudge up so it aligns closer to the cap-height of the larger amount
      marginBottom: 4,
    },
    amountBase: {
      fontSize: AMOUNT_FONT_SIZE,
      lineHeight: AMOUNT_FONT_SIZE + 8,
      fontFamily: theme.typography.fontFamily.bold,
    },
    amountEmpty: {
      color: theme.colors.textDisabled,
    },
    amountFilled: {
      color: theme.colors.textPrimary,
    },

    // ── Keypad wrapper ─────────────────────────────────────────────────────
    keypad: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
    },
    keyRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },

    // ── Individual key ─────────────────────────────────────────────────────
    key: {
      flex: 1,
      height: KEY_HEIGHT,
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.medium,
      ...theme.shadows.card,
    },

    // ── Key labels ─────────────────────────────────────────────────────────
    digitLabel: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    backspaceLabel: {
      // dangerSoft (#F08080) — exists in both light and dark palettes
      fontSize: theme.typography.fontSize.bodyLarge,
      lineHeight: theme.typography.lineHeight.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.dangerSoft,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// KEY BUTTON — isolated component so each key owns its own press animation
// ─────────────────────────────────────────────────────────────────────────────

function KeyButton({ label, onPress, keyStyle, labelStyle }: KeyButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View
      style={[keyStyle, { transform: [{ scale: scaleAnim }] }]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={KEY_TOUCHABLE}
      >
        <Text style={labelStyle}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AmountInput({
  value,
  onChange,
  currency = 'PHP',
}: AmountInputProps) {
  const theme  = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const symbol  = currencySymbol(currency);
  // Display '0' when value is empty so the field is never blank
  const display = value === '' ? '0' : value;
  const isEmpty = value === '' || value === '0';

  // ── Key handler ────────────────────────────────────────────────────────────
  const handleKey = useCallback(
    (key: string) => {
      // Normalise: treat empty string the same as '0'
      const current = value === '' ? '0' : value;

      // ── Backspace ──────────────────────────────────────────────────────
      if (key === '⌫') {
        onChange(current.length <= 1 ? '0' : current.slice(0, -1));
        return;
      }

      // ── Decimal ────────────────────────────────────────────────────────
      if (key === '.') {
        if (current.includes('.')) return; // only one decimal allowed
        onChange(current + '.');
        return;
      }

      // ── Digit ──────────────────────────────────────────────────────────
      const dotIndex = current.indexOf('.');

      if (dotIndex !== -1) {
        // Already have a decimal point — enforce MAX_DEC_DIGITS
        const decPart = current.slice(dotIndex + 1);
        if (decPart.length >= MAX_DEC_DIGITS) return;
        onChange(current + key);
        return;
      }

      // No decimal yet — enforce leading-zero and MAX_INT_DIGITS rules
      if (current === '0') {
        // Replace the placeholder zero unless the digit is also 0 (no '00')
        onChange(key === '0' ? '0' : key);
        return;
      }

      if (current.length >= MAX_INT_DIGITS) return;
      onChange(current + key);
    },
    [value, onChange],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Amount display ── */}
      <View style={styles.displayRow}>
        <Text style={styles.symbolText}>{symbol}</Text>
        <Text
          style={[
            styles.amountBase,
            isEmpty ? styles.amountEmpty : styles.amountFilled,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {display}
        </Text>
      </View>

      {/* ── Keypad ── */}
      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyRow}>
            {row.map((key) => (
              <KeyButton
                key={key}
                label={key}
                onPress={() => handleKey(key)}
                keyStyle={styles.key}
                labelStyle={
                  key === '⌫' ? styles.backspaceLabel : styles.digitLabel
                }
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
