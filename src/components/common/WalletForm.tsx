import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  WALLET_OPTIONS,
  getWalletByKey,
  type WalletOption,
} from '@/constants/walletNames';
import { useTheme } from '@/theme';
import { parseAmountInput } from '@/utils/formatCurrency';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeAmountInput(value: string): string {
  const stripped = value.replace(/[^0-9.]/g, '');
  const parts = stripped.split('.');
  if (parts.length <= 1) return stripped;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

function formatAmountOnBlur(value: string): string {
  const raw = value.replace(/,/g, '').trim();
  if (!raw) return '';
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return '';
  return parsed.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalletCategory = 'personal' | 'business' | 'lending_fund';

export type WalletFormData = {
  walletKey: string;
  name: string;
  type: WalletOption['type'];
  category: WalletCategory;
  openingBalance: number;
  iconKey: string;
};

export type WalletFormInitialValues = {
  walletKey: string;
  name: string;
  category: WalletCategory;
  openingBalance: number;
};

type Props = {
  initialValues?: WalletFormInitialValues;
  showCategoryPicker?: boolean;
  excludeKeys?: string[];
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onSubmit: (data: WalletFormData) => void;
  onCancel?: () => void;
};

const CATEGORIES: { key: WalletCategory; label: string }[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'business', label: 'Business' },
  { key: 'lending_fund', label: 'Lending Fund' },
];

const OTHER_KEY = 'other';
const OTHER_NAME_PLACEHOLDER = 'Enter wallet or bank name';

// ─── Component ────────────────────────────────────────────────────────────────

export default function WalletForm({
  initialValues,
  showCategoryPicker = false,
  excludeKeys = [],
  submitLabel = 'Add Wallet',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  onSubmit,
  onCancel,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isEditMode = initialValues != null;

  const [selectedWalletKey, setSelectedWalletKey] = useState<string | null>(
    initialValues?.walletKey ?? null,
  );
  const [customName, setCustomName] = useState(initialValues?.name ?? '');
  const [nameWasCustomized, setNameWasCustomized] = useState(isEditMode);
  const [openingBalance, setOpeningBalance] = useState(() => {
    if (initialValues?.openingBalance == null) return '';
    return initialValues.openingBalance.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });
  const [selectedCategory, setSelectedCategory] = useState<WalletCategory>(
    initialValues?.category ?? 'personal',
  );

  const [nameError, setNameError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);

  const balanceInputRef = useRef<TextInput>(null);

  const availableOptions = useMemo(
    () => WALLET_OPTIONS.filter((w) => !excludeKeys.includes(w.key)),
    [excludeKeys],
  );

  const selectedWallet = useMemo(
    () => (selectedWalletKey ? getWalletByKey(selectedWalletKey) : undefined),
    [selectedWalletKey],
  );

  const isOtherSelected = selectedWalletKey === OTHER_KEY;
  const isSubmitEnabled = selectedWalletKey !== null && !isSubmitting;

  const namePlaceholder = isOtherSelected
    ? OTHER_NAME_PLACEHOLDER
    : selectedWallet
      ? selectedWallet.name
      : 'Select a wallet type first';

  const handleWalletSelect = (wallet: WalletOption) => {
    const wasOther = selectedWalletKey === OTHER_KEY;

    setSelectedWalletKey(wallet.key);
    setTypeError(null);

    if (!nameWasCustomized || wasOther) {
      if (wallet.key === OTHER_KEY) {
        setCustomName('');
        setNameWasCustomized(false);
      } else {
        setCustomName(wallet.name);
        setNameWasCustomized(false);
      }
    }
  };

  const handleNameChange = (text: string) => {
    setCustomName(text);
    setNameWasCustomized(true);
    if (nameError) setNameError(null);
  };

  const handleBalanceChange = (text: string) => {
    const sanitized = sanitizeAmountInput(text);
    if (sanitized.length <= 12) {
      setOpeningBalance(sanitized);
    }
  };

  const handleBalanceFocus = () => {
    const raw = openingBalance.replace(/,/g, '');
    setOpeningBalance(raw === '0.00' || raw === '' ? '' : raw);
  };

  const handleBalanceBlur = () => {
    if (!openingBalance.trim()) return;
    setOpeningBalance(formatAmountOnBlur(openingBalance));
  };

  const handleSubmit = () => {
    let valid = true;

    if (!selectedWalletKey) {
      setTypeError('Please select a wallet type.');
      valid = false;
    }

    const trimmedName = customName.trim();
    if (!trimmedName) {
      setNameError('Wallet name is required.');
      valid = false;
    }

    if (!valid) return;

    const wallet = getWalletByKey(selectedWalletKey!);
    if (!wallet) return;

    onSubmit({
      walletKey: selectedWalletKey!,
      name: trimmedName,
      type: wallet.type,
      category: selectedCategory,
      openingBalance: parseAmountInput(openingBalance),
      iconKey: wallet.icon_key,
    });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Choose wallet type</Text>

        {availableOptions.length === 0 ? (
          <Text style={styles.helperText}>
            You&apos;ve added all available wallet types.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {availableOptions.map((option) => {
              const isSelected = selectedWalletKey === option.key;

              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [
                    styles.chip,
                    isSelected && styles.chipSelected,
                    pressed && !isSelected && styles.chipPressed,
                  ]}
                  onPress={() => handleWalletSelect(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.name}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      isSelected && styles.chipLabelSelected,
                    ]}
                  >
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {typeError && <Text style={styles.errorText}>{typeError}</Text>}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Wallet name</Text>
        <TextInput
          style={[styles.textInput, nameError ? styles.textInputError : null]}
          value={customName}
          onChangeText={handleNameChange}
          placeholder={namePlaceholder}
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="next"
          maxLength={40}
          onSubmitEditing={() => balanceInputRef.current?.focus()}
          accessibilityLabel="Wallet name"
        />
        {nameError && <Text style={styles.errorText}>{nameError}</Text>}
        <Text style={styles.helperText}>
          You can rename this anything you like.
        </Text>
      </View>

      {showCategoryPicker && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;

              return (
                <Pressable
                  key={cat.key}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                    pressed && !isSelected && styles.chipPressed,
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={cat.label}
                >
                  <Text
                    style={[
                      styles.categoryChipLabel,
                      isSelected && styles.categoryChipLabelSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          {isEditMode ? 'Current balance' : 'Opening balance'}
        </Text>

        <View style={styles.balanceRow}>
          <Text style={styles.currencyPrefix}>₱</Text>
          <TextInput
            ref={balanceInputRef}
            style={styles.balanceInput}
            value={openingBalance}
            onChangeText={handleBalanceChange}
            onFocus={handleBalanceFocus}
            onBlur={handleBalanceBlur}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="decimal-pad"
            returnKeyType="done"
            maxLength={16}
            accessibilityLabel={isEditMode ? 'Current balance' : 'Opening balance'}
          />
        </View>

        <Text style={styles.helperText}>
          {isEditMode
            ? 'Update the current balance for this wallet.'
            : 'Enter how much is in this wallet right now. Tavi uses this as your starting point.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !isSubmitEnabled && styles.submitButtonDisabled,
            pressed && isSubmitEnabled && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={!isSubmitEnabled}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          accessibilityState={{ disabled: !isSubmitEnabled }}
        >
          <Text style={styles.submitLabel}>{submitLabel}</Text>
        </Pressable>

        {onCancel && (
          <Pressable
            style={styles.cancelButton}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

type Theme = ReturnType<typeof useTheme>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },
    scrollContent: {
      padding: theme.spacing.base,
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.xxxl,
    },
    fieldGroup: {
      gap: theme.spacing.xs,
    },
    fieldLabel: {
      fontSize: theme.typography.fontSize.label,
      lineHeight: theme.typography.lineHeight.label,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.label,
    },
    helperText: {
      fontSize: theme.typography.fontSize.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    errorText: {
      fontSize: theme.typography.fontSize.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.dangerMain,
      marginTop: theme.spacing.xs,
    },
    chipsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 0,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.full,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgCard,
    },
    chipSelected: {
      backgroundColor: theme.colors.accentMain,
      borderColor: theme.colors.accentMain,
    },
    chipPressed: {
      opacity: 0.7,
    },
    chipLabel: {
      fontSize: theme.typography.fontSize.bodySmall,
      lineHeight: theme.typography.lineHeight.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textPrimary,
    },
    chipLabelSelected: {
      color: theme.colors.textInverse,
    },
    textInput: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.small,
      paddingHorizontal: theme.spacing.base,
      backgroundColor: theme.colors.bgCard,
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textPrimary,
    },
    textInputError: {
      borderColor: theme.colors.dangerMain,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.small,
      backgroundColor: theme.colors.bgCard,
      paddingHorizontal: theme.spacing.base,
      gap: theme.spacing.xs,
    },
    currencyPrefix: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    balanceInput: {
      flex: 1,
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textPrimary,
      padding: 0,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    categoryChip: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgCard,
    },
    categoryChipSelected: {
      backgroundColor: theme.colors.accentSubtle,
      borderColor: theme.colors.accentMain,
      borderWidth: 2,
    },
    categoryChipLabel: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textPrimary,
    },
    categoryChipLabelSelected: {
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.accentMain,
    },
    actions: {
      marginTop: theme.spacing.xl,
    },
    submitButton: {
      height: 52,
      backgroundColor: theme.colors.accentMain,
      borderRadius: theme.radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.45,
    },
    submitButtonPressed: {
      opacity: 0.85,
    },
    submitLabel: {
      fontSize: theme.typography.fontSize.bodyLarge,
      lineHeight: theme.typography.lineHeight.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textInverse,
    },
    cancelButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignSelf: 'center',
      marginTop: theme.spacing.sm,
    },
    cancelLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.label,
      lineHeight: theme.typography.lineHeight.label,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
}