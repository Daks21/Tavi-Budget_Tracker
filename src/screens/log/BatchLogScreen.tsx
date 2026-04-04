// src/screens/log/BatchLogScreen.tsx

import React, {
  useCallback,
  useEffect,
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
import { and, asc, eq } from 'drizzle-orm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { LogStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useTransactionStore from '@/store/useTransactionStore';
import useWalletStore from '@/store/useWalletStore';
import db from '@/db';
import { transactions, categories as categoriesTable } from '@/db/schema';
import type { Category } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<LogStackParamList, 'BatchLog'>;
type PeriodMode = 'this_week' | 'last_week' | 'custom';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORY_COUNT = 6;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getThisWeekRange(): { start: string; end: string } {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysFromMon = (dow + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMon);
  return { start: toDateStr(monday), end: toDateStr(today) };
}

function getLastWeekRange(): { start: string; end: string } {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = (dow + 6) % 7;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysFromMon);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  return { start: toDateStr(lastMonday), end: toDateStr(lastSunday) };
}

function formatPeriodDisplay(start: string, end: string): string {
  const s = fromDateStr(start);
  const e = fromDateStr(end);
  const sLabel = `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}`;
  const eLabel = `${MONTH_NAMES[e.getMonth()]} ${e.getDate()}`;
  return `${sLabel} – ${eLabel}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE DATE PICKER MODAL
// ─────────────────────────────────────────────────────────────────────────────

type DatePickerProps = {
  label: string;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
  theme: Theme;
};

function SimpleDatePickerModal({ label, value, onConfirm, onClose, theme }: DatePickerProps) {
  const parsed = fromDateStr(value);
  const [year, setYear]   = useState(parsed.getFullYear());
  const [month, setMonth] = useState(parsed.getMonth() + 1); // 1–12
  const [day, setDay]     = useState(parsed.getDate());

  const s = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      padding: theme.spacing.xl,
      ...theme.shadows.modal,
    },
    title: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.bodyLarge,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.base,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.base,
    },
    inputWrap: {
      flex: 1,
    },
    inputLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.caption,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    input: {
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.medium,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    btnRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.bgInput,
      alignItems: 'center',
    },
    cancelText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.brand,
      alignItems: 'center',
    },
    confirmText: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textInverse,
    },
  }), [theme]);

  function handleConfirm() {
    const y = Math.max(2000, Math.min(2100, year));
    const mo = Math.max(1, Math.min(12, month));
    const daysInMo = new Date(y, mo, 0).getDate();
    const d = Math.max(1, Math.min(daysInMo, day));
    onConfirm(toDateStr(new Date(y, mo - 1, d)));
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={s.sheet}>
            <Text style={s.title}>{label}</Text>
            <View style={s.row}>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Month</Text>
                <TextInput
                  style={s.input}
                  keyboardType="number-pad"
                  value={String(month)}
                  onChangeText={t => setMonth(Number(t.replace(/[^0-9]/g, '')) || 1)}
                  maxLength={2}
                />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Day</Text>
                <TextInput
                  style={s.input}
                  keyboardType="number-pad"
                  value={String(day)}
                  onChangeText={t => setDay(Number(t.replace(/[^0-9]/g, '')) || 1)}
                  maxLength={2}
                />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Year</Text>
                <TextInput
                  style={s.input}
                  keyboardType="number-pad"
                  value={String(year)}
                  onChangeText={t => setYear(Number(t.replace(/[^0-9]/g, '')) || 2026)}
                  maxLength={4}
                />
              </View>
            </View>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
                <Text style={s.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AMOUNT MODAL
// ─────────────────────────────────────────────────────────────────────────────

type AmountModalProps = {
  categoryName: string;
  initialValue: string;
  onDone: (value: string) => void;
  onClose: () => void;
  theme: Theme;
};

function AmountModal({ categoryName, initialValue, onDone, onClose, theme }: AmountModalProps) {
  const [value, setValue] = useState(initialValue === '0' ? '' : initialValue);

  const s = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      padding: theme.spacing.xl,
      ...theme.shadows.modal,
    },
    title: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.bodyLarge,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.base,
    },
    input: {
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.medium,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.heading2,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.base,
    },
    btnRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.bgInput,
      alignItems: 'center',
    },
    cancelText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
    },
    doneBtn: {
      flex: 2,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.brand,
      alignItems: 'center',
    },
    doneText: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textInverse,
    },
  }), [theme]);

  function handleDone() {
    const num = parseFloat(value);
    onDone(isNaN(num) || num < 0 ? '0' : String(num));
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={s.sheet}>
              <Text style={s.title}>Amount for {categoryName}</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                value={value}
                onChangeText={setValue}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textDisabled}
                autoFocus
              />
              <View style={s.btnRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.doneBtn} onPress={handleDone}>
                  <Text style={s.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function BatchLogScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);

  const loadRecentTransactions = useTransactionStore((s) => s.loadRecentTransactions);
  const setLastEntryMode = useTransactionStore((s) => s.setLastEntryMode);

  const accounts = useWalletStore((s) => s.accounts);
  const loadAccounts = useWalletStore((s) => s.loadAccounts);
  const reloadAccounts = useWalletStore((s) => s.reloadAccounts);

  // ── State ─────────────────────────────────────────────────────────────────

  const [periodMode, setPeriodMode] = useState<PeriodMode>('this_week');

  const thisWeek = useMemo(() => getThisWeekRange(), []);
  const lastWeek = useMemo(() => getLastWeekRange(), []);

  const [customStart, setCustomStart] = useState(thisWeek.start);
  const [customEnd,   setCustomEnd]   = useState(thisWeek.end);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker,   setShowEndPicker]   = useState(false);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [expanded, setExpanded]           = useState(false);
  const [amounts, setAmounts]             = useState<Record<number, string>>({});

  const [modalCategoryId,   setModalCategoryId]   = useState<number | null>(null);
  const [modalCategoryName, setModalCategoryName] = useState('');

  const [isSaving,   setIsSaving]   = useState(false);
  const [isDone,     setIsDone]     = useState(false);

  // ── Derived values ────────────────────────────────────────────────────────

  const periodRange = useMemo((): { start: string; end: string } => {
    if (periodMode === 'this_week') return thisWeek;
    if (periodMode === 'last_week') return lastWeek;
    return { start: customStart, end: customEnd };
  }, [periodMode, thisWeek, lastWeek, customStart, customEnd]);

  const normalizedPeriodRange = useMemo(() => {
    if (periodRange.start <= periodRange.end) return periodRange;
    return {
      start: periodRange.end,
      end: periodRange.start,
    };
  }, [periodRange]);

  const periodLabel = useMemo(
    () => formatPeriodDisplay(normalizedPeriodRange.start, normalizedPeriodRange.end),
    [normalizedPeriodRange],
  );

  const visibleCategories = useMemo(
    () => (expanded ? allCategories : allCategories.slice(0, DEFAULT_CATEGORY_COUNT)),
    [allCategories, expanded],
  );

  const total = useMemo(() => {
    return Object.values(amounts).reduce((sum, v) => {
      const n = parseFloat(v);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }, [amounts]);

  const defaultAccount = useMemo(() => {
    if (accounts.length === 0) return null;
    // prefer the account with the latest created_at (most recent)
    const sorted = [...accounts].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return sorted[0];
  }, [accounts]);

  // ── Load categories on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (accounts.length === 0) {
      loadAccounts();
    }
  }, [accounts.length, loadAccounts]);

  useEffect(() => {
    async function load() {
      try {
        const rows = await db
          .select()
          .from(categoriesTable)
          .where(
            and(
              eq(categoriesTable.type, 'expense'),
              eq(categoriesTable.is_active, 1),
            )
          )
          .orderBy(asc(categoriesTable.display_order));
        setAllCategories(rows);
      } catch (err) {
        console.error('[BatchLog] Failed to load categories:', err);
      }
    }
    load();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openAmountModal = useCallback((cat: Category) => {
    setModalCategoryId(cat.id);
    setModalCategoryName(cat.name);
  }, []);

  const handleAmountDone = useCallback((value: string) => {
    if (modalCategoryId !== null) {
      setAmounts(prev => ({ ...prev, [modalCategoryId]: value }));
    }
    setModalCategoryId(null);
    setModalCategoryName('');
  }, [modalCategoryId]);

  const handleAmountClose = useCallback(() => {
    setModalCategoryId(null);
    setModalCategoryName('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!defaultAccount) {
      Alert.alert('No Account', 'Add a wallet before logging expenses.');
      return;
    }

    const entries = Object.entries(amounts).filter(([, v]) => {
      const n = parseFloat(v);
      return !isNaN(n) && n > 0;
    });

    if (entries.length === 0) {
      Alert.alert('Nothing to save', 'Enter at least one amount.');
      return;
    }

    setIsSaving(true);
    try {
      const now = nowISO();
      const dateValue = normalizedPeriodRange.end; // last day of period

      await db.transaction(async (tx) => {
        for (const [catIdStr, amountStr] of entries) {
          const catId = Number(catIdStr);
          const amount = parseFloat(amountStr);
          const cat = allCategories.find(c => c.id === catId);
          const catName = cat?.name ?? 'Unknown';

          await tx.insert(transactions).values({
            type: 'expense',
            category_id: catId,
            account_id: defaultAccount.id,
            amount,
            entry_mode: 'batch',
            batch_period_start: normalizedPeriodRange.start,
            batch_period_end: normalizedPeriodRange.end,
            date: dateValue,
            description: `${catName} — week of ${normalizedPeriodRange.start}`,
            created_at: now,
            updated_at: now,
          });
        }
      });

      await Promise.all([
        loadRecentTransactions(),
        reloadAccounts(),
      ]);

      setLastEntryMode('batch');
      setIsDone(true);
    } catch (err) {
      console.error('[BatchLog] Save failed:', err);
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    defaultAccount,
    amounts,
    allCategories,
    periodRange,
    loadRecentTransactions,
    reloadAccounts,
    normalizedPeriodRange,
    setLastEntryMode,
  ]);

  // ── Completion state ──────────────────────────────────────────────────────

  if (isDone) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.completionContainer}>
          <View style={s.mascotPlaceholder}>
            <Ionicons name="checkmark-circle" size={64} color={theme.colors.accentMain} />
          </View>
          <Text style={s.completionHeading}>Logged. You're on top of it.</Text>
          <Text style={s.completionSub}>
            Tavi updated your spending summary for this period.
          </Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Weekly Summary</Text>
            <View style={s.backBtn} />
          </View>

          {/* Intro */}
          <Text style={s.introText}>
            Log what you roughly spent this week — category by category.{'\n'}
            No need to remember every detail.
          </Text>

          {/* Period selector */}
          <View style={s.card}>
            <Text style={s.cardLabel}>For the period:</Text>
            <View style={s.periodTabs}>
              {(['this_week', 'last_week', 'custom'] as PeriodMode[]).map((mode) => {
                const labels: Record<PeriodMode, string> = {
                  this_week: 'This week',
                  last_week: 'Last week',
                  custom: 'Custom',
                };
                const active = periodMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[s.periodTab, active && s.periodTabActive]}
                    onPress={() => setPeriodMode(mode)}
                  >
                    <Text style={[s.periodTabText, active && s.periodTabTextActive]}>
                      {labels[mode]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {periodMode === 'custom' ? (
              <View style={s.customDateRow}>
                <TouchableOpacity
                  style={s.customDateBtn}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={s.customDateLabel}>From</Text>
                  <Text style={s.customDateValue}>
                    {formatPeriodDisplay(customStart, customStart).split(' –')[0]}
                  </Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.textSecondary} />
                <TouchableOpacity
                  style={s.customDateBtn}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={s.customDateLabel}>To</Text>
                  <Text style={s.customDateValue}>
                    {formatPeriodDisplay(customEnd, customEnd).split(' –')[0]}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={s.periodDisplayText}>{periodLabel}</Text>
            )}
          </View>

          {/* Category rows */}
          <View style={s.card}>
            {visibleCategories.map((cat) => {
              const amountVal = amounts[cat.id] ?? '0';
              const hasAmount = parseFloat(amountVal) > 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={s.categoryRow}
                  onPress={() => openAmountModal(cat)}
                  activeOpacity={0.7}
                >
                  <View style={s.categoryIconWrap}>
                    <Ionicons
                      name="pricetag-outline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={s.categoryName}>{cat.name}</Text>
                  <View style={[s.amountBadge, hasAmount && s.amountBadgeActive]}>
                    <Text style={[s.amountText, hasAmount && s.amountTextActive]}>
                      ₱{hasAmount ? parseFloat(amountVal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {allCategories.length > DEFAULT_CATEGORY_COUNT && (
              <TouchableOpacity
                style={s.expandBtn}
                onPress={() => setExpanded(v => !v)}
              >
                <Text style={s.expandBtnText}>
                  {expanded
                    ? 'Show fewer categories'
                    : `Add more categories (+${allCategories.length - DEFAULT_CATEGORY_COUNT})`}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={theme.colors.accentMain}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Total */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total logged:</Text>
            <Text style={s.totalAmount}>
              ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[s.primaryBtn, (isSaving || !defaultAccount) && s.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving || !defaultAccount}
          >
            <Text style={s.primaryBtnText}>
              {isSaving ? 'Saving…' : 'Save Summary'}
            </Text>
          </TouchableOpacity>

          {!defaultAccount && (
            <Text style={s.noAccountWarning}>
              No active wallet found. Add a wallet to save.
            </Text>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Amount modal */}
      {modalCategoryId !== null && (
        <AmountModal
          categoryName={modalCategoryName}
          initialValue={amounts[modalCategoryId] ?? '0'}
          onDone={handleAmountDone}
          onClose={handleAmountClose}
          theme={theme}
        />
      )}

      {/* Custom date pickers */}
      {showStartPicker && (
        <SimpleDatePickerModal
          label="Start date"
          value={customStart}
          onConfirm={(d) => { setCustomStart(d); setShowStartPicker(false); }}
          onClose={() => setShowStartPicker(false)}
          theme={theme}
        />
      )}
      {showEndPicker && (
        <SimpleDatePickerModal
          label="End date"
          value={customEnd}
          onConfirm={(d) => { setCustomEnd(d); setShowEndPicker(false); }}
          onClose={() => setShowEndPicker(false)}
          theme={theme}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.sm,
    },

    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.base,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.fontSize.heading2,
      color: theme.colors.textPrimary,
    },

    // Intro
    introText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      lineHeight: theme.typography.lineHeight.body,
      marginBottom: theme.spacing.base,
    },

    // Card
    card: {
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.large,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.base,
      ...theme.shadows.card,
    },
    cardLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.bodySmall,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },

    // Period tabs
    periodTabs: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    periodTab: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.bgInput,
      alignItems: 'center',
    },
    periodTabActive: {
      backgroundColor: theme.colors.brand,
    },
    periodTabText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.bodySmall,
      color: theme.colors.textSecondary,
    },
    periodTabTextActive: {
      color: theme.colors.textInverse,
    },
    periodDisplayText: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },

    // Custom date row
    customDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    customDateBtn: {
      flex: 1,
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.medium,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
    },
    customDateLabel: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.caption,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    customDateValue: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textPrimary,
    },

    // Category row
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    categoryIconWrap: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.bgInput,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    categoryName: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textPrimary,
    },
    amountBadge: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.bgInput,
    },
    amountBadgeActive: {
      backgroundColor: theme.colors.accentSubtle,
    },
    amountText: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textDisabled,
    },
    amountTextActive: {
      color: theme.colors.accentMain,
    },

    // Expand button
    expandBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    expandBtnText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.accentMain,
    },

    // Total
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xs,
      marginBottom: theme.spacing.base,
    },
    totalLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
    },
    totalAmount: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.fontSize.heading2,
      color: theme.colors.textPrimary,
    },

    // Primary button
    primaryBtn: {
      backgroundColor: theme.colors.brand,
      borderRadius: theme.radius.large,
      paddingVertical: theme.spacing.base,
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryBtnText: {
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.fontSize.bodyLarge,
      color: theme.colors.textInverse,
    },
    noAccountWarning: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.bodySmall,
      color: theme.colors.dangerMain,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },

    // Completion
    completionContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    mascotPlaceholder: {
      marginBottom: theme.spacing.xl,
    },
    completionHeading: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.fontSize.heading1,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    completionSub: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: theme.typography.lineHeight.body,
      marginBottom: theme.spacing.xxl,
    },
  });
}
