import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  WALLET_OPTIONS,
  getWalletByKey,
  type WalletOption,
} from '@/constants/walletNames';
import { useTheme } from '@/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function parseBalanceToNumber(value: string): number {
  const raw = value.replace(/,/g, '').trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Fix 2: derive type from WalletOption — stays in sync automatically
export type WalletFormData = {
  walletKey: string;
  name: string;
  type: WalletOption['type'];
  openingBalance: number;
  iconKey: string;
};

type Props = {
  /** Wallet keys already added — these options will be hidden. */
  excludeKeys?: string[];
  submitLabel?: string;
  // Fix 4: cancelLabel prop so each consumer controls its own copy
  cancelLabel?: string;
  onSubmit: (data: WalletFormData) => void;
  onCancel?: () => void;
};

const OTHER_KEY = 'other';

// ─── Component ────────────────────────────────────────────────────────────────

export default function WalletPickerForm({
  excludeKeys = [],
  submitLabel = 'Add Wallet',
  cancelLabel = 'Cancel',
  onSubmit,
  onCancel,
}: Props) {
  const theme = useTheme();

  const [selectedWalletKey, setSelectedWalletKey] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [nameWasCustomized, setNameWasCustomized] = useState(false);

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
  const isSubmitEnabled = selectedWalletKey !== null;

  // Fix 1: preserve "Other" UX from 2.1.4
  const handleWalletSelect = (wallet: WalletOption) => {
    setSelectedWalletKey(wallet.key);

    if (!nameWasCustomized) {
      if (wallet.key === OTHER_KEY) {
        // Other: clear the name so placeholder guides the user
        setCustomName('');
      } else {
        // Known wallet: auto-fill (or replace previous auto-fill)
        setCustomName(wallet.name);
      }
    } else {
      // User has typed something — only overwrite if switching away from Other
      // back to a known wallet (restores the expected name)
      if (selectedWalletKey === OTHER_KEY && wallet.key !== OTHER_KEY) {
        setCustomName(wallet.name);
        setNameWasCustomized(false);
      }
    }
  };

  const handleNameChange = (text: string) => {
    setNameWasCustomized(true);
    setCustomName(text);
  };

  const handleBalanceChange = (text: string) => {
    const sanitized = sanitizeAmountInput(text);
    if (sanitized.length <= 12) setOpeningBalance(sanitized);
  };

  const handleBalanceFocus = () =>
    setOpeningBalance((prev) => prev.replace(/,/g, ''));

  const handleBalanceBlur = () => {
    if (!openingBalance.trim()) return;
    setOpeningBalance(formatAmountOnBlur(openingBalance));
  };

  const handleSubmit = () => {
    if (!selectedWalletKey) return;
    const wallet = getWalletByKey(selectedWalletKey);
    if (!wallet) return;

    onSubmit({
      walletKey: selectedWalletKey,
      name: customName.trim() || wallet.name,
      type: wallet.type,
      openingBalance: parseBalanceToNumber(openingBalance),
      iconKey: wallet.icon_key,
    });
  };

  // Fix 1: placeholder logic mirrors 2.1.4
  const namePlaceholder = isOtherSelected
    ? 'Enter wallet or bank name'
    : selectedWallet
    ? selectedWallet.name
    : 'Select a wallet type first';

  return (
    <View style={styles.root}>
      {/* ── Wallet type chips ── */}
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.label,
          fontFamily: theme.typography.fontFamily.medium,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.label,
          marginBottom: theme.spacing.sm,
        }}
      >
        Choose wallet type
      </Text>

      {availableOptions.length === 0 ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.bodySmall,
            fontFamily: theme.typography.fontFamily.regular,
            marginBottom: theme.spacing.lg,
          }}
        >
          You've added all available wallet types.
        </Text>
      ) : (
        <FlatList
          data={availableOptions}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          style={[styles.chipListContainer, { marginBottom: theme.spacing.xl }]}
          renderItem={({ item }) => {
            const isSelected = selectedWalletKey === item.key;
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.accentMain
                      : theme.colors.bgCard,
                    borderColor: isSelected
                      ? theme.colors.accentMain
                      : theme.colors.border,
                    borderRadius: theme.radius.full,
                  },
                ]}
                onPress={() => handleWalletSelect(item)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={item.name}
              >
                <Text
                  style={{
                    color: isSelected
                      ? theme.colors.textInverse
                      : theme.colors.textPrimary,
                    fontSize: theme.typography.fontSize.bodySmall,
                    fontFamily: isSelected
                      ? theme.typography.fontFamily.semibold
                      : theme.typography.fontFamily.regular,
                  }}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Wallet name ── */}
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.label,
          fontFamily: theme.typography.fontFamily.medium,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.label,
          marginBottom: theme.spacing.xs,
        }}
      >
        Wallet name
      </Text>

      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.small,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.regular,
          },
        ]}
        value={customName}
        onChangeText={handleNameChange}
        placeholder={namePlaceholder}
        placeholderTextColor={theme.colors.textSecondary}
        returnKeyType="next"
        onSubmitEditing={() => balanceInputRef.current?.focus()}
        accessibilityLabel="Wallet name"
      />

      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.caption,
          fontFamily: theme.typography.fontFamily.regular,
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.lg,
        }}
      >
        You can rename this anything you like.
      </Text>

      {/* ── Current balance ── */}
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.label,
          fontFamily: theme.typography.fontFamily.medium,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.label,
          marginBottom: theme.spacing.xs,
        }}
      >
        Current balance
      </Text>

      <View
        style={[
          styles.balanceRow,
          {
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.small,
          },
        ]}
      >
        <Text
          style={{
            color: theme.colors.accentMain,
            fontSize: theme.typography.fontSize.bodyLarge,
            fontFamily: theme.typography.fontFamily.semibold,
            paddingLeft: theme.spacing.base,
            paddingRight: theme.spacing.xs,
          }}
        >
          ₱
        </Text>

        <TextInput
          ref={balanceInputRef}
          style={[
            styles.balanceInput,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.bodyLarge,
              fontFamily: theme.typography.fontFamily.regular,
            },
          ]}
          value={openingBalance}
          onChangeText={handleBalanceChange}
          onFocus={handleBalanceFocus}
          onBlur={handleBalanceBlur}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={16}
          accessibilityLabel="Current balance"
        />
      </View>

      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.caption,
          fontFamily: theme.typography.fontFamily.regular,
          marginTop: theme.spacing.xs,
        }}
      >
        Enter how much is in this wallet right now.
      </Text>

      {/* ── Actions ── */}
      <View style={[styles.actions, { marginTop: theme.spacing.xl }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: isSubmitEnabled
                ? theme.colors.accentMain
                : theme.colors.border,
              borderRadius: theme.radius.medium,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isSubmitEnabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          accessibilityState={{ disabled: !isSubmitEnabled }}
        >
          <Text
            style={{
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.bodyLarge,
              fontFamily: theme.typography.fontFamily.semibold,
            }}
          >
            {submitLabel}
          </Text>
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            style={{ paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center', marginTop: theme.spacing.sm }}
            onPress={onCancel}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.label,
                fontFamily: theme.typography.fontFamily.regular,
              }}
            >
              {cancelLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chipList: {
  alignItems: 'center',
  paddingVertical: 2,
  gap: 8,
  },
  chipListContainer: {
    flexGrow: 0,
    height: 44,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
  },
  balanceInput: {
    flex: 1,
    height: '100%',
    paddingRight: 12,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  submitButton: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});