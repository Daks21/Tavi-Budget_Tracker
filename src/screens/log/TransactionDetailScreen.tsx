// src/screens/log/TransactionDetailScreen.tsx

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { eq } from 'drizzle-orm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { LogStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useTransactionStore from '@/store/useTransactionStore';
import useWalletStore from '@/store/useWalletStore';
import { formatCurrency, parseAmountInput } from '@/utils/formatCurrency';
import AccountPicker from '@/components/common/AccountPicker';
import CategoryPicker from '@/components/common/CategoryPicker';
import AmountInput from '@/components/common/AmountInput';
import db from '@/db';
import { transactions, categories, accounts } from '@/db/schema';
import type { Transaction } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<LogStackParamList, 'TransactionDetail'>;

// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function amountColor(type: string, c: Theme['colors']): string {
  switch (type) {
    case 'expense':
    case 'adjustment':
      return c.dangerMain;
    case 'income':
      return c.successMain;
    case 'transfer':
      return c.accentMain;
    default:
      return c.textPrimary;
  }
}

function typeBadge(
  type: string,
  entryMode: string,
  c: Theme['colors'],
): { bg: string; fg: string; label: string } {
  if (entryMode === 'batch') {
    return { bg: c.warningSubtle, fg: c.warningMain, label: 'Batch' };
  }
  switch (type) {
    case 'expense':
      return { bg: c.dangerSubtle, fg: c.dangerMain, label: 'Expense' };
    case 'income':
      return { bg: c.successSubtle, fg: c.successMain, label: 'Income' };
    case 'transfer':
      return { bg: c.accentSubtle, fg: c.accentMain, label: 'Transfer' };
    default:
      return { bg: c.border, fg: c.textSecondary, label: type };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  const { colors: c, spacing: s, radius: r, typography: t, shadows } = theme;
  return StyleSheet.create({
    // ── Screen ─────────────────────────────────────────────────────────────
    safeArea: {
      flex: 1,
      backgroundColor: c.bgPage,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: s.base,
      paddingTop: s.lg,
      paddingBottom: s.huge,
    },
    // ── Loading ────────────────────────────────────────────────────────────
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.regular,
      color: c.textSecondary,
    },
    // ── Amount hero ────────────────────────────────────────────────────────
    heroCard: {
      backgroundColor: c.bgCard,
      borderRadius: r.large,
      padding: s.xl,
      alignItems: 'center',
      marginBottom: s.md,
      ...shadows.card,
    },
    amountText: {
      fontSize: 36,
      fontFamily: t.fontFamily.bold,
      lineHeight: 44,
      marginBottom: s.sm,
    },
    badgePill: {
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
      borderRadius: r.full,
    },
    badgeLabel: {
      fontSize: t.fontSize.caption,
      fontFamily: t.fontFamily.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // ── Detail card ────────────────────────────────────────────────────────
    detailCard: {
      backgroundColor: c.bgCard,
      borderRadius: r.large,
      paddingVertical: s.xs,
      marginBottom: s.md,
      ...shadows.card,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: s.base,
      paddingVertical: s.md,
    },
    detailRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    detailLabel: {
      width: 110,
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.medium,
      color: c.textSecondary,
      lineHeight: t.lineHeight.body,
    },
    detailValue: {
      flex: 1,
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.regular,
      color: c.textPrimary,
      lineHeight: t.lineHeight.body,
    },
    detailValueMuted: {
      color: c.textDisabled,
    },
    // ── Warning banner ─────────────────────────────────────────────────────
    warningBanner: {
      backgroundColor: c.warningSubtle,
      borderRadius: r.medium,
      borderLeftWidth: 3,
      borderLeftColor: c.warningMain,
      padding: s.md,
      marginBottom: s.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    warningIcon: {
      marginRight: s.sm,
      marginTop: 1,
    },
    warningText: {
      flex: 1,
      fontSize: t.fontSize.bodySmall,
      fontFamily: t.fontFamily.regular,
      color: c.textPrimary,
      lineHeight: t.lineHeight.bodySmall,
    },
    // ── Transfer read-only notice ──────────────────────────────────────────
    transferNotice: {
      backgroundColor: c.accentSubtle,
      borderRadius: r.medium,
      borderLeftWidth: 3,
      borderLeftColor: c.accentMain,
      padding: s.md,
      marginBottom: s.md,
    },
    transferNoticeTitle: {
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.semibold,
      color: c.accentMain,
      marginBottom: s.xs,
    },
    transferNoticeBody: {
      fontSize: t.fontSize.bodySmall,
      fontFamily: t.fontFamily.regular,
      color: c.textSecondary,
      lineHeight: t.lineHeight.bodySmall,
    },
    // ── Delete button ──────────────────────────────────────────────────────
    deleteButton: {
      alignItems: 'center',
      paddingVertical: s.md,
      marginTop: s.sm,
    },
    deleteButtonText: {
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.semibold,
      color: c.dangerMain,
    },
    // ── Edit form ──────────────────────────────────────────────────────────
    amountEditCard: {
      backgroundColor: c.bgCard,
      borderRadius: r.large,
      marginBottom: s.md,
      overflow: 'hidden',
      ...shadows.card,
    },
    amountEditDisplay: {
      alignItems: 'center',
      paddingTop: s.lg,
      paddingBottom: s.md,
    },
    amountEditText: {
      fontSize: 36,
      fontFamily: t.fontFamily.bold,
      lineHeight: 44,
    },
    editCard: {
      backgroundColor: c.bgCard,
      borderRadius: r.large,
      marginBottom: s.md,
      overflow: 'hidden',
      ...shadows.card,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.base,
      paddingVertical: s.md,
    },
    fieldRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    fieldLabel: {
      width: 110,
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.medium,
      color: c.textSecondary,
    },
    fieldValue: {
      flex: 1,
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.regular,
      color: c.textPrimary,
    },
    fieldValuePlaceholder: {
      color: c.textSecondary,
    },
    fieldInput: {
      flex: 1,
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.regular,
      color: c.textPrimary,
      padding: 0,
    },
    saveButton: {
      backgroundColor: c.accentMain,
      borderRadius: r.medium,
      paddingVertical: s.md,
      alignItems: 'center',
      marginBottom: s.md,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: t.fontSize.bodyLarge,
      fontFamily: t.fontFamily.semibold,
      color: c.textInverse,
    },
    // ── Date picker sheet ──────────────────────────────────────────────────
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
    },
    dateSheet: {
      backgroundColor: c.bgCard,
      borderTopLeftRadius: r.large,
      borderTopRightRadius: r.large,
      padding: s.base,
      paddingBottom: s.xl,
      ...shadows.modal,
    },
    dateSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.base,
    },
    dateSheetTitle: {
      fontSize: t.fontSize.heading2,
      fontFamily: t.fontFamily.semibold,
      color: c.textPrimary,
    },
    dateNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.md,
    },
    dateNavBtn: {
      padding: s.sm,
    },
    dateNavLabel: {
      fontSize: t.fontSize.bodyLarge,
      fontFamily: t.fontFamily.semibold,
      color: c.textPrimary,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: s.xs,
    },
    weekDayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: s.xs,
    },
    weekDayText: {
      fontSize: t.fontSize.caption,
      fontFamily: t.fontFamily.medium,
      color: c.textSecondary,
    },
    dayGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: `${100 / 7}%` as `${number}%`,
      alignItems: 'center',
      paddingVertical: s.xs,
    },
    dayCellInner: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellSelected: {
      backgroundColor: c.accentMain,
    },
    dayCellText: {
      fontSize: t.fontSize.body,
      fontFamily: t.fontFamily.regular,
      color: c.textPrimary,
    },
    dayCellTextSelected: {
      color: c.textInverse,
      fontFamily: t.fontFamily.semibold,
    },
    dayCellTextToday: {
      color: c.accentMain,
      fontFamily: t.fontFamily.semibold,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE PICKER MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}

function DatePickerModal({
  visible,
  value,
  onSelect,
  onClose,
  styles,
  theme,
}: DatePickerModalProps) {
  const today = todayDateStr();
  const initial = value || today;
  const [y0, m0] = initial.split('-').map(Number);

  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState(m0); // 1-12

  useEffect(() => {
    if (visible && value) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m);
    }
  }, [visible, value]);

  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = Array<null>(firstDow).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.dateSheet}>
          {/* Header */}
          <View style={styles.dateSheetHeader}>
            <Text style={styles.dateSheetTitle}>Select Date</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={styles.dateNavRow}>
            <TouchableOpacity style={styles.dateNavBtn} onPress={prevMonth}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.dateNavLabel}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </Text>
            <TouchableOpacity style={styles.dateNavBtn} onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map(d => (
              <View key={d} style={styles.weekDayCell}>
                <Text style={styles.weekDayText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.dayGrid}>
            {cells.map((day, idx) => {
              if (!day) {
                return <View key={`e-${idx}`} style={styles.dayCell} />;
              }
              const ds = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = ds === value;
              const isToday = ds === today;
              return (
                <TouchableOpacity
                  key={ds}
                  style={styles.dayCell}
                  onPress={() => { onSelect(ds); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dayCellInner, isSelected && styles.dayCellSelected]}>
                    <Text style={[
                      styles.dayCellText,
                      isSelected && styles.dayCellTextSelected,
                      !isSelected && isToday && styles.dayCellTextToday,
                    ]}>
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function TransactionDetailScreen({ route, navigation }: Props) {
  const { transactionId } = route.params;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { updateTransaction, softDeleteTransaction } = useTransactionStore();
  const { accounts: walletAccounts, reloadAccounts } = useWalletStore();

  // ── Display data ───────────────────────────────────────────────────────────
  const [tx, setTx] = useState<Transaction | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string>('—');
  const [destAccountName, setDestAccountName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Edit form ──────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // ── Picker visibility ──────────────────────────────────────────────────────
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Derived account name for edit form ────────────────────────────────────
  const editAccountName = useMemo(
    () => walletAccounts.find(a => a.id === editAccountId)?.name ?? null,
    [walletAccounts, editAccountId],
  );

  // ─── Load transaction from DB ─────────────────────────────────────────────
  const loadTransaction = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transactionId));
      const row = rows[0];
      if (!row) { navigation.navigate('TransactionHistory'); return; }
      setTx(row);

      // category
      if (row.category_id != null) {
        const cats = await db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(eq(categories.id, row.category_id));
        setCategoryName(cats[0]?.name ?? null);
      } else {
        setCategoryName(null);
      }

      // account
      const accts = await db
        .select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, row.account_id));
      setAccountName(accts[0]?.name ?? '—');

      // destination account (transfer)
      if (row.destination_account_id != null) {
        const dest = await db
          .select({ id: accounts.id, name: accounts.name })
          .from(accounts)
          .where(eq(accounts.id, row.destination_account_id));
        setDestAccountName(dest[0]?.name ?? null);
      } else {
        setDestAccountName(null);
      }
    } catch (err) {
      console.error('[TransactionDetail] load error', err);
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, navigation]);

  useEffect(() => { loadTransaction(); }, [loadTransaction]);

  // ─── Enter / exit edit mode ───────────────────────────────────────────────
  const enterEditMode = useCallback(() => {
    if (!tx) return;
    setEditAmount(String(tx.amount));
    setEditCategoryId(tx.category_id ?? null);
    setEditCategoryName(categoryName);
    setEditAccountId(tx.account_id);
    setEditDate(tx.date);
    setEditDescription(tx.description ?? '');
    setEditNotes(tx.notes ?? '');
    setEditMode(true);
  }, [tx, categoryName]);

  const cancelEdit = useCallback(() => setEditMode(false), []);

  // ─── Header buttons ───────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (isLoading) {
      navigation.setOptions({ headerRight: undefined, title: 'Transaction', });
      return;
    }
    const label = editMode ? 'Cancel' : 'Edit';
    const onPress = editMode ? cancelEdit : enterEditMode;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{
            color: theme.colors.textInverse,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.medium,
          }}>
            {label}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isLoading, editMode, enterEditMode, cancelEdit, theme]);

  // ─── Save edits ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!tx) return;
    const amount = parseAmountInput(editAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (!editAccountId) {
      Alert.alert('Missing Wallet', 'Please select a wallet.');
      return;
    }
    setIsSaving(true);
    try {
      await updateTransaction(tx.id, {
        amount,
        category_id: editCategoryId,
        account_id: editAccountId,
        date: editDate,
        description: editDescription.trim() || null,
        notes: editNotes.trim() || null,
      });
      await reloadAccounts();
      await loadTransaction();
      setEditMode(false);
    } catch (err) {
      console.error('[TransactionDetail] save error', err);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [tx, editAmount, editCategoryId, editAccountId, editDate, editDescription, editNotes, updateTransaction, reloadAccounts, loadTransaction]);

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Transaction',
      'Delete this transaction? This will update your account balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!tx) return;
            try {
              await softDeleteTransaction(tx.id);
              await reloadAccounts();
              navigation.navigate('TransactionHistory');
            } catch (err) {
              console.error('[TransactionDetail] delete error', err);
              Alert.alert('Error', 'Failed to delete transaction.');
            }
          },
        },
      ],
    );
  }, [tx, softDeleteTransaction, reloadAccounts, navigation]);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tx) return null;

  // ─── Edit mode ────────────────────────────────────────────────────────────
  if (editMode) {
    if (tx.type === 'transfer') {
      return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.transferNotice}>
              <Text style={styles.transferNoticeTitle}>Transfer — Read Only</Text>
              <Text style={styles.transferNoticeBody}>
                Editing transfer transactions is not supported to preserve account balance
                integrity. To correct a transfer, delete it and re-enter the correct details.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const editAmountNum = parseAmountInput(editAmount);
    const editAmountColor = amountColor(tx.type, theme.colors);

    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount input */}
            <View style={styles.amountEditCard}>
              <View style={styles.amountEditDisplay}>
                <Text style={[styles.amountEditText, { color: editAmountColor }]}>
                  {editAmountNum > 0 ? formatCurrency(editAmountNum) : '₱0.00'}
                </Text>
              </View>
              <AmountInput value={editAmount} onChange={setEditAmount} />
            </View>

            {/* Form fields */}
            <View style={styles.editCard}>
              {/* Category */}
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => setShowCategoryPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.fieldLabel}>Category</Text>
                <Text
                  style={[
                    styles.fieldValue,
                    !editCategoryName && styles.fieldValuePlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {editCategoryName ?? 'Select category'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {/* Wallet */}
              <TouchableOpacity
                style={[styles.fieldRow, styles.fieldRowBorder]}
                onPress={() => setShowAccountPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.fieldLabel}>Wallet</Text>
                <Text
                  style={[
                    styles.fieldValue,
                    !editAccountName && styles.fieldValuePlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {editAccountName ?? 'Select wallet'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {/* Date */}
              <TouchableOpacity
                style={[styles.fieldRow, styles.fieldRowBorder]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.fieldLabel}>Date</Text>
                <Text style={styles.fieldValue}>{formatDateDisplay(editDate)}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {/* Description */}
              <View style={[styles.fieldRow, styles.fieldRowBorder]}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Add description"
                  placeholderTextColor={theme.colors.textSecondary}
                  maxLength={100}
                  returnKeyType="done"
                />
              </View>

              {/* Notes */}
              <View style={[styles.fieldRow, styles.fieldRowBorder]}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Add notes"
                  placeholderTextColor={theme.colors.textSecondary}
                  maxLength={255}
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        <CategoryPicker
          visible={showCategoryPicker}
          type={tx.type === 'income' ? 'income' : 'expense'}
          selectedCategoryId={editCategoryId}
          onSelect={(cat) => {
            setEditCategoryId(cat.id);
            setEditCategoryName(cat.name);
          }}
          onClose={() => setShowCategoryPicker(false)}
        />
        <AccountPicker
          visible={showAccountPicker}
          selectedAccountId={editAccountId}
          onSelect={(acc) => setEditAccountId(acc.id)}
          onClose={() => setShowAccountPicker(false)}
        />
        <DatePickerModal
          visible={showDatePicker}
          value={editDate}
          onSelect={setEditDate}
          onClose={() => setShowDatePicker(false)}
          styles={styles}
          theme={theme}
        />
      </SafeAreaView>
    );
  }

  // ─── Detail view ──────────────────────────────────────────────────────────
  const badge = typeBadge(tx.type, tx.entry_mode, theme.colors);
  const color = amountColor(tx.type, theme.colors);
  const isBatch = tx.entry_mode === 'batch';
  const isTransfer = tx.type === 'transfer';

  // Transfers: show amount unsigned (it's a movement between own accounts)
  const amountDisplayStr =
    tx.type === 'expense' || tx.type === 'adjustment'
      ? `-${formatCurrency(tx.amount)}`
      : formatCurrency(tx.amount);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Amount hero */}
        <View style={styles.heroCard}>
          <Text style={[styles.amountText, { color }]}>{amountDisplayStr}</Text>
          <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeLabel, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Details card */}
        <View style={styles.detailCard}>
          {/* Category — hidden for transfers */}
          {!isTransfer && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={[styles.detailValue, !categoryName && styles.detailValueMuted]}>
                {categoryName ?? '—'}
              </Text>
            </View>
          )}

          {/* Wallet */}
          <View style={[styles.detailRow, !isTransfer && styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Wallet</Text>
            <Text style={styles.detailValue}>{accountName}</Text>
          </View>

          {/* Destination wallet (transfer only) */}
          {isTransfer && destAccountName != null && (
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>To Wallet</Text>
              <Text style={styles.detailValue}>{destAccountName}</Text>
            </View>
          )}

          {/* Date */}
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDateDisplay(tx.date)}</Text>
          </View>

          {/* Description */}
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={[styles.detailValue, !tx.description && styles.detailValueMuted]}>
              {tx.description || '—'}
            </Text>
          </View>

          {/* Notes */}
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Notes</Text>
            <Text style={[styles.detailValue, !tx.notes && styles.detailValueMuted]}>
              {tx.notes || '—'}
            </Text>
          </View>

          {/* Period (batch only) */}
          {isBatch && tx.batch_period_start && tx.batch_period_end && (
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>Period</Text>
              <Text style={styles.detailValue}>
                {'For the week of '}
                {formatDateDisplay(tx.batch_period_start)}
                {' – '}
                {formatDateDisplay(tx.batch_period_end)}
              </Text>
            </View>
          )}
        </View>

        {/* Linked obligation/loan warning */}
        {tx.reference_id != null && (
          <View style={styles.warningBanner}>
            <Ionicons
              name="warning-outline"
              size={18}
              color={theme.colors.warningMain}
              style={styles.warningIcon}
            />
            <Text style={styles.warningText}>
              This transaction is linked to an obligation or loan record.
              Deleting it may affect related calculations.
            </Text>
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>Delete Transaction</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
