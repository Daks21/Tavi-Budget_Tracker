// src/screens/wallets/TransferScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WalletStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useWalletStore from '@/store/useWalletStore';
import { formatCurrency, parseAmountInput } from '@/utils/formatCurrency';
import db from '@/db';
import { transactions } from '@/db/schema';

type Props = NativeStackScreenProps<WalletStackParamList, 'Transfer'>;

// ─── Types ────────────────────────────────────────────────────────────────────

type Account = {
  id: number;
  name: string;
  type: string;
};

// ─── Wallet selector sheet ────────────────────────────────────────────────────

function WalletSelectorSheet({
  visible,
  options,
  selectedId,
  onSelect,
  onClose,
  theme,
}: {
  visible: boolean;
  options: Account[];
  selectedId: number | null;
  onSelect: (account: Account) => void;
  onClose: () => void;
  theme: Theme;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />

      <View
        style={[
          sheetStyles.sheet,
          {
            backgroundColor: theme.colors.bgPage,
            borderTopLeftRadius: theme.radius.large ?? 20,
            borderTopRightRadius: theme.radius.large ?? 20,
          },
        ]}
      >
        {/* Handle */}
        <View style={sheetStyles.handleRow}>
          <View
            style={[sheetStyles.handle, { backgroundColor: theme.colors.border }]}
          />
        </View>

        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.bodyLarge,
            fontFamily: theme.typography.fontFamily.semibold,
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          Select wallet
        </Text>

        {options.length === 0 ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.body,
                fontFamily: theme.typography.fontFamily.regular,
              }}
            >
              No other wallets available.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {options.map((account, index) => {
              const isSelected = account.id === selectedId;
              const isLast = index === options.length - 1;
              return (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => {
                    onSelect(account);
                    onClose();
                  }}
                  activeOpacity={0.7}
                  style={[
                    sheetStyles.optionRow,
                    {
                      borderBottomColor: theme.colors.border,
                      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                      paddingHorizontal: 20,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={account.name}
                >
                  <View style={sheetStyles.optionLeft}>
                    <Text
                      style={{
                        color: theme.colors.textPrimary,
                        fontSize: theme.typography.fontSize.body,
                        fontFamily: isSelected
                          ? theme.typography.fontFamily.semibold
                          : theme.typography.fontFamily.regular,
                      }}
                    >
                      {account.name}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.textSecondary,
                        fontSize: theme.typography.fontSize.caption,
                        fontFamily: theme.typography.fontFamily.regular,
                        marginTop: 2,
                        textTransform: 'capitalize',
                      }}
                    >
                      {account.type}
                    </Text>
                  </View>

                  {isSelected && (
                    <Text
                      style={{
                        color: theme.colors.accentMain,
                        fontSize: theme.typography.fontSize.body,
                        fontFamily: theme.typography.fontFamily.semibold,
                      }}
                    >
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  optionLeft: {
    flex: 1,
  },
});

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldLabel({ label, theme }: { label: string; theme: Theme }) {
  return (
    <Text
      style={{
        color: theme.colors.textSecondary,
        fontSize: theme.typography.fontSize.label,
        fontFamily: theme.typography.fontFamily.medium,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.label,
        marginBottom: 6,
      }}
    >
      {label}
    </Text>
  );
}

// ─── Wallet selector button ───────────────────────────────────────────────────

function WalletSelectorButton({
  selected,
  placeholder,
  onPress,
  theme,
}: {
  selected: Account | null;
  placeholder: string;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <TouchableOpacity
      style={[
        selectorStyles.root,
        {
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.small,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={selected ? selected.name : placeholder}
    >
      <Text
        style={{
          color: selected ? theme.colors.textPrimary : theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.body,
          fontFamily: selected
            ? theme.typography.fontFamily.medium
            : theme.typography.fontFamily.regular,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {selected ? selected.name : placeholder}
      </Text>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.body,
        }}
      >
        ›
      </Text>
    </TouchableOpacity>
  );
}

const selectorStyles = StyleSheet.create({
  root: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

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

function buildReferenceId(): string {
  return `TRF-${Date.now()}`;
}

function todayISO(): string {
  return new Date().toISOString();
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TransferScreen({ navigation, route }: Props) {
  const theme = useTheme();

  const allAccounts = useWalletStore((s) => s.accounts) as Account[];
  const reloadAccounts = useWalletStore((s) => s.reloadAccounts);

  const [fromAccount, setFromAccount] = useState<Account | null>(null);
  const [toAccount, setToAccount] = useState<Account | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [fromSheetOpen, setFromSheetOpen] = useState(false);
  const [toSheetOpen, setToSheetOpen] = useState(false);

  const prefilledFromId = route.params?.fromAccountId;

  // To-options exclude whatever is currently selected as From
  const toOptions = useMemo(
    () => allAccounts.filter((a) => a.id !== fromAccount?.id),
    [allAccounts, fromAccount],
  );

  // From-options exclude whatever is currently selected as To
  const fromOptions = useMemo(
    () => allAccounts.filter((a) => a.id !== toAccount?.id),
    [allAccounts, toAccount],
  );

  const loadAccounts = useWalletStore((s) => s.loadAccounts);

  useEffect(() => {
    if (allAccounts.length === 0) {
      loadAccounts();
    }
  }, [allAccounts.length, loadAccounts]);

  useEffect(() => {
  if (!prefilledFromId) return;

  const match = allAccounts.find((a) => a.id === prefilledFromId);
  if (match) {
    setFromAccount(match);
  }
  }, [prefilledFromId, allAccounts]);

  const parsedAmount = parseAmountInput(amountStr);
  const isSubmitEnabled =
    fromAccount !== null &&
    toAccount !== null &&
    fromAccount.id !== toAccount.id &&
    parsedAmount > 0 &&
    !submitting;

  // ── Handle from selection — clear To if it matches ──────────────────────────
  const handleFromSelect = useCallback(
    (account: Account) => {
      setFromAccount(account);
      if (toAccount?.id === account.id) {
        setToAccount(null);
      }
    },
    [toAccount],
  );

  // ── Handle to selection — clear From if it matches ──────────────────────────
  const handleToSelect = useCallback(
    (account: Account) => {
      setToAccount(account);
      if (fromAccount?.id === account.id) {
        setFromAccount(null);
      }
    },
    [fromAccount],
  );

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleTransferPress = useCallback(() => {
    if (!isSubmitEnabled || !fromAccount || !toAccount) return;

    const formatted = formatCurrency(parsedAmount);

    Alert.alert(
      'Confirm transfer',
      `Transfer ${formatted} from ${fromAccount.name} to ${toAccount.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: executeTransfer },
      ],
    );
  }, [isSubmitEnabled, fromAccount, toAccount, parsedAmount]);

  const executeTransfer = useCallback(async () => {
    if (!fromAccount || !toAccount || submitting) return;
    setSubmitting(true);

    const referenceId = buildReferenceId();
    const now = todayISO();
    const noteText = note.trim() || null;

    try {
      await db.transaction(async (tx) => {
        // Record 1 — Debit: money leaving source
        await tx.insert(transactions).values({
          type: 'transfer',
          account_id: fromAccount.id,
          destination_account_id: null,
          amount: parsedAmount,
          description: `Transfer to ${toAccount.name}`,
          notes: noteText,
          reference_id: referenceId,
          entry_mode: 'realtime',
          date: now,
          created_at: now,
          updated_at: now,
        });

        // Record 2 — Credit: money arriving in destination
        await tx.insert(transactions).values({
          type: 'transfer',
          account_id: toAccount.id,
          destination_account_id: fromAccount.id,
          amount: parsedAmount,
          description: `Transfer from ${fromAccount.name}`,
          notes: noteText,
          reference_id: referenceId,
          entry_mode: 'realtime',
          date: now,
          created_at: now,
          updated_at: now,
        });
      });

      await reloadAccounts();

      const formatted = formatCurrency(parsedAmount);

      Alert.alert(
        'Done',
        `${formatted} moved to ${toAccount.name}.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('WalletList'),
          },
        ],
      );
    } catch (error) {
      console.error('[Transfer] transaction failed:', error);
      Alert.alert('Something went wrong', 'Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setSubmitting(false);
    }
  }, [
    fromAccount,
    toAccount,
    parsedAmount,
    note,
    submitting,
    navigation,
    reloadAccounts,
  ]);

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView
          style={[styles.root, { backgroundColor: theme.colors.bgPage }]}
          edges={['bottom']}
        >
          <StatusBar style="auto" />

          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: theme.spacing.base },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── From ── */}
            <View style={{ marginBottom: theme.spacing.lg }}>
              <FieldLabel label="From" theme={theme} />
              <WalletSelectorButton
                selected={fromAccount}
                placeholder="Select source wallet"
                onPress={() => setFromSheetOpen(true)}
                theme={theme}
              />
            </View>

            {/* ── To ── */}
            <View style={{ marginBottom: theme.spacing.lg }}>
              <FieldLabel label="To" theme={theme} />
              <WalletSelectorButton
                selected={toAccount}
                placeholder="Select destination wallet"
                onPress={() => setToSheetOpen(true)}
                theme={theme}
              />
              {fromAccount && toAccount && fromAccount.id === toAccount.id && (
                <Text
                  style={{
                    color: theme.colors.dangerMain,
                    fontSize: theme.typography.fontSize.caption,
                    fontFamily: theme.typography.fontFamily.regular,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  From and To wallets must be different.
                </Text>
              )}
            </View>

            {/* ── Amount ── */}
            <View style={{ marginBottom: theme.spacing.lg }}>
              <FieldLabel label="Amount" theme={theme} />
              <View
                style={[
                  styles.amountRow,
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
                  style={[
                    styles.amountInput,
                    {
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.bodyLarge,
                      fontFamily: theme.typography.fontFamily.regular,
                    },
                  ]}
                  value={amountStr}
                  onChangeText={(text) => {
                    const sanitized = sanitizeAmountInput(text);
                    if (sanitized.length <= 12) setAmountStr(sanitized);
                  }}
                  onFocus={() =>
                    setAmountStr((prev) => prev.replace(/,/g, ''))
                  }
                  onBlur={() => {
                    if (!amountStr.trim()) return;
                    setAmountStr(formatAmountOnBlur(amountStr));
                  }}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  maxLength={16}
                  accessibilityLabel="Transfer amount"
                />
              </View>
            </View>

            {/* ── Note ── */}
            <View style={{ marginBottom: theme.spacing.xl }}>
              <FieldLabel label="Note (optional)" theme={theme} />
              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: theme.colors.bgCard,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.small,
                    color: theme.colors.textPrimary,
                    fontSize: theme.typography.fontSize.body,
                    fontFamily: theme.typography.fontFamily.regular,
                  },
                ]}
                value={note}
                onChangeText={setNote}
                placeholder="What's this transfer for?"
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="done"
                maxLength={120}
                accessibilityLabel="Transfer note"
              />
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>

          {/* ── Bottom bar ── */}
          <View
            style={[
              styles.bottomArea,
              {
                paddingHorizontal: theme.spacing.base,
                paddingBottom: theme.spacing.base,
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.bgPage,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.transferBtn,
                {
                  backgroundColor: isSubmitEnabled
                    ? theme.colors.accentMain
                    : theme.colors.border,
                  borderRadius: theme.radius.medium,
                },
              ]}
              onPress={handleTransferPress}
              disabled={!isSubmitEnabled}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Transfer"
              accessibilityState={{ disabled: !isSubmitEnabled }}
            >
              <Text
                style={{
                  color: theme.colors.textInverse,
                  fontSize: theme.typography.fontSize.bodyLarge,
                  fontFamily: theme.typography.fontFamily.semibold,
                }}
              >
                {submitting ? 'Transferring…' : 'Transfer'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ── Wallet selector sheets (rendered outside scroll) ── */}
      <WalletSelectorSheet
        visible={fromSheetOpen}
        options={fromOptions}
        selectedId={fromAccount?.id ?? null}
        onSelect={handleFromSelect}
        onClose={() => setFromSheetOpen(false)}
        theme={theme}
      />

      <WalletSelectorSheet
        visible={toSheetOpen}
        options={toOptions}
        selectedId={toAccount?.id ?? null}
        onSelect={handleToSelect}
        onClose={() => setToSheetOpen(false)}
        theme={theme}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: 24 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
  },
  amountInput: {
    flex: 1,
    height: '100%',
    paddingRight: 12,
  },
  noteInput: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  bottomArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    alignItems: 'center',
  },
  transferBtn: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});