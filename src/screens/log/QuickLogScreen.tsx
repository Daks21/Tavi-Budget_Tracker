// src/screens/log/QuickLogScreen.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import useTransactionStore, {
  type TransactionTemplate,
} from '@/store/useTransactionStore';
import useWalletStore from '@/store/useWalletStore';
import { parseAmountInput } from '@/utils/formatCurrency';
import AccountPicker from '@/components/common/AccountPicker';
import CategoryPicker from '@/components/common/CategoryPicker';
import AmountInput from '@/components/common/AmountInput';
import db from '@/db';
import { transactions, categories as categoriesTable } from '@/db/schema';
import type { Category } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<LogStackParamList, 'QuickLog'>;
type TxType = 'income' | 'expense' | 'transfer';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BOTTOM_AREA_HEIGHT = 80;
const TOAST_DURATION_MS  = 10_000;
const MAX_TEMPLATES      = 5;

const TX_TABS: { type: TxType; label: string }[] = [
  { type: 'expense',  label: 'Expense'  },
  { type: 'income',   label: 'Income'   },
  { type: 'transfer', label: 'Transfer' },
];

// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateComponents(s: string): { year: number; month: number; day: number } {
  const [y, mo, d] = s.split('-').map(Number);
  return { year: y, month: mo, day: d };
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string): string {
  if (dateStr === todayDateStr()) return 'Today';
  const { year, month, day } = parseDateComponents(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE PICKER MODAL — styles
// ─────────────────────────────────────────────────────────────────────────────

function makeDPStyles(theme: Theme) {
  return StyleSheet.create({
    root:    { flex: 1, justifyContent: 'flex-end' },
    backdrop:{ flex: 1, backgroundColor: theme.colors.overlay },
    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius:  theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      padding:       theme.spacing.base,
      paddingBottom: theme.spacing.xl,
      ...theme.shadows.modal,
    },
    handle: {
      alignSelf:    'center',
      width:        36,
      height:       4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    sheetHeader: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginBottom:   theme.spacing.lg,
    },
    sheetTitle: {
      fontSize:   theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    closeBtn: { padding: theme.spacing.xs },
    closeX: {
      fontSize:   theme.typography.fontSize.heading2,
      color:      theme.colors.textSecondary,
    },
    spinnerRow: {
      flexDirection:   'row',
      alignItems:      'center',
      justifyContent:  'space-between',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    spinnerFieldLabel: {
      width:      60,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textSecondary,
    },
    spinnerVal: {
      flex:       1,
      textAlign:  'center',
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    spinnerBtns: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    spinnerBtn: {
      width:        36,
      height:       36,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.bgPage,
      alignItems:   'center',
      justifyContent: 'center',
    },
    spinnerBtnTxt: {
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    dpFooter: {
      flexDirection: 'row',
      gap:           theme.spacing.sm,
      marginTop:     theme.spacing.lg,
    },
    todayBtn: {
      flex:           1,
      height:         44,
      borderRadius:   theme.radius.medium,
      borderWidth:    1,
      borderColor:    theme.colors.accentMain,
      alignItems:     'center',
      justifyContent: 'center',
    },
    todayBtnTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.accentMain,
    },
    confirmBtn: {
      flex:            2,
      height:          44,
      borderRadius:    theme.radius.medium,
      backgroundColor: theme.colors.accentMain,
      alignItems:      'center',
      justifyContent:  'center',
    },
    confirmBtnTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textInverse,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE PICKER MODAL — component
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

function DatePickerModal({
  visible,
  value,
  onConfirm,
  onClose,
}: {
  visible:   boolean;
  value:     string;
  onConfirm: (date: string) => void;
  onClose:   () => void;
}) {
  const theme = useTheme();
  const s     = useMemo(() => makeDPStyles(theme), [theme]);

  const [yr, setYr] = useState(2026);
  const [mo, setMo] = useState(1);
  const [dy, setDy] = useState(1);

  // Sync to incoming value when modal opens
  useEffect(() => {
    if (visible) {
      const { year, month, day } = parseDateComponents(value);
      setYr(year); setMo(month); setDy(day);
    }
  }, [visible, value]);

  // Clamp day when month / year changes
  useEffect(() => {
    const max = daysInMonth(yr, mo);
    if (dy > max) setDy(max);
  }, [yr, mo]); // intentionally omit dy

  const goToToday = () => {
    const { year, month, day } = parseDateComponents(todayDateStr());
    setYr(year); setMo(month); setDy(day);
  };

  const handleConfirm = () => {
    onConfirm(toDateStr(yr, mo, Math.min(dy, daysInMonth(yr, mo))));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={s.backdrop} />
        </Pressable>

        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Select Date</Text>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Month */}
          <View style={s.spinnerRow}>
            <Text style={s.spinnerFieldLabel}>Month</Text>
            <Text style={s.spinnerVal}>{MONTH_NAMES[mo - 1]}</Text>
            <View style={s.spinnerBtns}>
              <TouchableOpacity style={s.spinnerBtn} onPress={() => setMo(m => m > 1  ? m - 1 : 12)}>
                <Text style={s.spinnerBtnTxt}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.spinnerBtn} onPress={() => setMo(m => m < 12 ? m + 1 : 1)}>
                <Text style={s.spinnerBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Year */}
          <View style={s.spinnerRow}>
            <Text style={s.spinnerFieldLabel}>Year</Text>
            <Text style={s.spinnerVal}>{yr}</Text>
            <View style={s.spinnerBtns}>
              <TouchableOpacity style={s.spinnerBtn} onPress={() => setYr(y => y - 1)}>
                <Text style={s.spinnerBtnTxt}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.spinnerBtn} onPress={() => setYr(y => y + 1)}>
                <Text style={s.spinnerBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Day */}
          <View style={s.spinnerRow}>
            <Text style={s.spinnerFieldLabel}>Day</Text>
            <Text style={s.spinnerVal}>{dy}</Text>
            <View style={s.spinnerBtns}>
              <TouchableOpacity style={s.spinnerBtn} onPress={() => {
                const max = daysInMonth(yr, mo);
                setDy(d => d > 1   ? d - 1 : max);
              }}>
                <Text style={s.spinnerBtnTxt}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.spinnerBtn} onPress={() => {
                const max = daysInMonth(yr, mo);
                setDy(d => d < max ? d + 1 : 1);
              }}>
                <Text style={s.spinnerBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.dpFooter}>
            <TouchableOpacity style={s.todayBtn} onPress={goToToday}>
              <Text style={s.todayBtnTxt}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
              <Text style={s.confirmBtnTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN STYLES FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    flex: { flex: 1 },

    root: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },

    screenHeader: {
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.base,
      paddingBottom: theme.spacing.xs,
    },

    screenTitle: {
      fontSize: theme.typography.fontSize.heading1,
      lineHeight: theme.typography.lineHeight.heading1,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.textPrimary,
    },  

    scrollContent: {
      paddingBottom: BOTTOM_AREA_HEIGHT + theme.spacing.xl,
    },

    // ── Type tabs ──────────────────────────────────────────────────────────
    tabRow: {
      flexDirection:    'row',
      paddingHorizontal: theme.spacing.base,
      paddingTop:       theme.spacing.base,
      paddingBottom:    theme.spacing.sm,
      gap:              theme.spacing.sm,
    },
    tab: {
      flex:            1,
      alignItems:      'center',
      paddingVertical: theme.spacing.sm,
      borderRadius:    theme.radius.medium,
      backgroundColor: theme.colors.bgCard,
      borderWidth:     1,
      borderColor:     theme.colors.border,
    },
    tabActive: {
      backgroundColor: theme.colors.accentSubtle,
      borderColor:     theme.colors.accentMain,
    },
    tabLabel: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textSecondary,
    },
    tabLabelActive: {
      color:      theme.colors.accentMain,
      fontFamily: theme.typography.fontFamily.semibold,
    },

    // ── Amount section ─────────────────────────────────────────────────────
    amountSection: {
      paddingHorizontal: theme.spacing.sm,
    },

    // ── Form card ──────────────────────────────────────────────────────────
    formCard: {
      marginHorizontal: theme.spacing.base,
      marginTop:        theme.spacing.sm,
      backgroundColor:  theme.colors.bgCard,
      borderRadius:     theme.radius.medium,
      overflow:         'hidden',
      ...theme.shadows.card,
    },
    formRow: {
      flexDirection: 'row',
      alignItems:    'center',
      paddingHorizontal: theme.spacing.base,
      minHeight:     52,
    },
    formRowSep: {
      height:          StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft:      theme.spacing.base,
    },
    rowIconBox: {
      width:          32,
      height:         32,
      borderRadius:   theme.radius.medium,
      alignItems:     'center',
      justifyContent: 'center',
      marginRight:    theme.spacing.md,
    },
    rowInitial: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textInverse,
    },
    rowLabel: {
      flex:       1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textSecondary,
    },
    rowValue: {
      flex:       1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textPrimary,
    },
    descInput: {
      flex:       1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textPrimary,
      paddingVertical: theme.spacing.md,
      padding:    0,
    },

    // ── Templates ──────────────────────────────────────────────────────────
    templatesSection: {
      marginHorizontal: theme.spacing.base,
      marginTop:        theme.spacing.md,
    },
    templatesLabel: {
      fontSize:      theme.typography.fontSize.label,
      fontFamily:    theme.typography.fontFamily.medium,
      color:         theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.label,
      marginBottom:  theme.spacing.xs,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap:      'wrap',
      gap:           theme.spacing.sm,
    },
    chip: {
      backgroundColor: theme.colors.bgCard,
      borderRadius:    theme.radius.full,
      borderWidth:     1,
      borderColor:     theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical:   theme.spacing.xs,
      ...theme.shadows.card,
    },
    chipText: {
      fontSize:   theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textPrimary,
    },

    // ── Bottom save area ───────────────────────────────────────────────────
    bottomArea: {
      height:            BOTTOM_AREA_HEIGHT,
      paddingHorizontal: theme.spacing.base,
      paddingTop:        theme.spacing.sm,
      paddingBottom:     theme.spacing.base,
      borderTopWidth:    StyleSheet.hairlineWidth,
      borderTopColor:    theme.colors.border,
      backgroundColor:   theme.colors.bgPage,
      justifyContent:    'center',
    },
    saveBtn: {
      height:          52,
      borderRadius:    theme.radius.medium,
      backgroundColor: theme.colors.accentMain,
      alignItems:      'center',
      justifyContent:  'center',
    },
    saveBtnDisabled: {
      backgroundColor: theme.colors.border,
    },
    saveBtnLabel: {
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textInverse,
    },

    // ── Undo toast ─────────────────────────────────────────────────────────
    toast: {
      position: 'absolute',
      bottom:   BOTTOM_AREA_HEIGHT + theme.spacing.sm,
      left:     theme.spacing.base,
      right:    theme.spacing.base,
      backgroundColor: theme.colors.brand,
      borderRadius:    theme.radius.medium,
      flexDirection:   'row',
      alignItems:      'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical:   theme.spacing.md,
      ...theme.shadows.modal,
    },
    toastText: {
      flex:       1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textInverse,
    },
    toastUndo: {
      fontSize:    theme.typography.fontSize.body,
      fontFamily:  theme.typography.fontFamily.semibold,
      color:       theme.colors.accentSoft,
      paddingLeft: theme.spacing.md,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function templateChipLabel(
  t: TransactionTemplate,
  categoryNames: Record<number, string>,
  getAccountById: (id: number) => { name: string } | undefined,
) {
  const categoryName =
    t.categoryId !== null ? categoryNames[t.categoryId] ?? 'Category' : 'Category';

  const accountName = getAccountById(t.accountId)?.name ?? 'Wallet';

  return `${categoryName} from ${accountName}`;
}

function buildTransferReferenceId(): string {
  return `TRF-${Date.now()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function QuickLogScreen({ route }: Props) {
  const theme  = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ── Store bindings ─────────────────────────────────────────────────────────
  const addTransaction          = useTransactionStore(s => s.addTransaction);
  const softDeleteTransaction   = useTransactionStore(s => s.softDeleteTransaction);
  const undoLastTransaction     = useTransactionStore(s => s.undoLastTransaction);
  const loadRecentTransactions  = useTransactionStore(s => s.loadRecentTransactions);
  const templates               = useTransactionStore(s => s.templates);
  const loadTemplates           = useTransactionStore(s => s.loadTemplates);
  const incrementTemplateUseCount = useTransactionStore(s => s.incrementTemplateUseCount);
  const setLastEntryMode        = useTransactionStore(s => s.setLastEntryMode);

  const reloadAccounts  = useWalletStore(s => s.reloadAccounts);
  const getAccountById  = useWalletStore(s => s.getAccountById);

  // ── Route params ───────────────────────────────────────────────────────────
  const prefillCategoryId = route.params?.prefillCategoryId;
  const prefillAccountId  = route.params?.prefillAccountId;
  const prefillType       = route.params?.prefillType;

  // ── Local state ────────────────────────────────────────────────────────────
  const [txType,              setTxType]              = useState<TxType>(prefillType ?? 'expense');
  const [amount,              setAmount]              = useState('0');
  const [selectedCategory,    setSelectedCategory]    = useState<Category | null>(null);
  const [selectedAccountId,   setSelectedAccountId]   = useState<number | null>(prefillAccountId ?? null);
  const [destinationAccountId,setDestinationAccountId]= useState<number | null>(null);
  const [selectedDate,        setSelectedDate]        = useState(todayDateStr);
  const [description,         setDescription]         = useState('');
  const [templateCategoryNames, setTemplateCategoryNames] = useState<Record<number, string>>({});
  
  // Picker visibility
  const [catPickerVisible,  setCatPickerVisible]  = useState(false);
  const [accPickerVisible,  setAccPickerVisible]  = useState(false);
  const [destPickerVisible, setDestPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const [isSaving,        setIsSaving]        = useState(false);
  const [showUndoToast,   setShowUndoToast]   = useState(false);
  // Holds both transfer row IDs so undo can soft-delete both
  const [undoTransferIds, setUndoTransferIds] = useState<[number, number] | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Derived amount value used by validation, template auto-save, and save flow
  const parsedAmount = parseAmountInput(amount);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ids = Array.from(
      new Set(
        templates
          .map((t) => t.categoryId)
          .filter((id): id is number => id !== null)
      )
    );

    if (ids.length === 0) {
      setTemplateCategoryNames({});
      return;
    }

    let cancelled = false;

    async function loadTemplateCategoryNames() {
      try {
        const rows = await Promise.all(
          ids.map((id) =>
            db
              .select()
              .from(categoriesTable)
              .where(eq(categoriesTable.id, id))
              .limit(1)
          )
        );

        if (cancelled) return;

        const map: Record<number, string> = {};
        rows.forEach((result) => {
          if (result.length > 0) {
            map[result[0].id] = result[0].name;
          }
        });

        setTemplateCategoryNames(map);
      } catch {
        if (!cancelled) setTemplateCategoryNames({});
      }
    }

    loadTemplateCategoryNames();

    return () => {
      cancelled = true;
    };
  }, [templates]);
  
  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill account from route params
  useEffect(() => {
    if (prefillAccountId != null) setSelectedAccountId(prefillAccountId);
  }, [prefillAccountId]);

  // Prefill category from route params (requires DB lookup for full object)
  useEffect(() => {
    if (prefillCategoryId == null) return;
    let cancelled = false;
    db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, prefillCategoryId))
      .limit(1)
      .then(rows => {
        if (!cancelled && rows.length > 0) setSelectedCategory(rows[0]);
      })
      .catch(() => {/* non-fatal */});
    return () => { cancelled = true; };
  }, [prefillCategoryId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isValid = useMemo(() => {
    if (parsedAmount <= 0) return false;
    if (selectedAccountId === null) return false;
    if (txType === 'transfer') {
      return (
        destinationAccountId !== null &&
        destinationAccountId !== selectedAccountId
      );
    }
    return selectedCategory !== null;
  }, [parsedAmount, selectedAccountId, txType, destinationAccountId, selectedCategory]);

  const relevantTemplates = useMemo(
    () =>
      templates
        .filter(t => t.type === txType)
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, MAX_TEMPLATES),
    [templates, txType],
  );

  // Derived account objects for display and transfer row descriptions
  const sourceAccount = getAccountById(selectedAccountId    ?? -1);
  const destAccount   = getAccountById(destinationAccountId ?? -1);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTypeChange = useCallback((type: TxType) => {
    if (type === txType) return;
    setTxType(type);
    setSelectedCategory(null); // category list changes between income / expense
  }, [txType]);

  const handleTemplatePress = useCallback(async (t: TransactionTemplate) => {
    // Immediate field prefill
    const amtStr = t.amount % 1 === 0
      ? String(Math.round(t.amount))
      : t.amount.toFixed(2);
    setAmount(amtStr);
    if (t.accountId)   setSelectedAccountId(t.accountId);
    if (t.description) setDescription(t.description);

    // Category requires a DB fetch for the full object
    if (t.categoryId !== null) {
      try {
        const rows = await db
          .select()
          .from(categoriesTable)
          .where(eq(categoriesTable.id, t.categoryId))
          .limit(1);
        if (rows.length > 0) setSelectedCategory(rows[0]);
      } catch {/* non-fatal */}
    }

    await incrementTemplateUseCount(t.id);
  }, [incrementTemplateUseCount]);

  // ── Undo ───────────────────────────────────────────────────────────────────

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setShowUndoToast(false);
  }, []);

  const handleUndo = useCallback(async () => {
    dismissToast();
    try {
      if (undoTransferIds) {
        // Undo both transfer rows directly
        await softDeleteTransaction(undoTransferIds[0]);
        await softDeleteTransaction(undoTransferIds[1]);
        setUndoTransferIds(null);
      } else {
        await undoLastTransaction();
      }
      await reloadAccounts();
    } catch (err) {
      console.error('[QuickLog] undo failed:', err);
    }
  }, [undoTransferIds, softDeleteTransaction, undoLastTransaction, reloadAccounts, dismissToast]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const showToastFor10s = useCallback((transferIds: [number, number] | null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUndoTransferIds(transferIds);
    setShowUndoToast(true);
    toastTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      setUndoTransferIds(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving || !isValid) return;
    setIsSaving(true);

    try {
      if (txType === 'transfer') {
        // ── Dual-record transfer ──────────────────────────────────────────
        const referenceId = buildTransferReferenceId();
        const now         = new Date().toISOString();
        const noteText    = description.trim() || null;
        const srcName     = sourceAccount?.name ?? '';
        const dstName     = destAccount?.name   ?? '';

        let capturedDebitId:  number | null = null;
        let capturedCreditId: number | null = null;

        await db.transaction(async tx => {
          // Row 1 — Debit: money leaving source
          const debitResult = await tx
            .insert(transactions)
            .values({
              type:                   'transfer',
              account_id:             selectedAccountId!,
              destination_account_id: null,
              amount:                 parsedAmount,
              description:            `Transfer to ${dstName}`,
              notes:                  noteText,
              reference_id:           referenceId,
              entry_mode:             'realtime',
              date:                   selectedDate,
              is_deleted:             0,
              created_at:             now,
              updated_at:             now,
            })
            .returning({ id: transactions.id });

          // Row 2 — Credit: money arriving in destination
          const creditResult = await tx
            .insert(transactions)
            .values({
              type:                   'transfer',
              account_id:             destinationAccountId!,
              destination_account_id: selectedAccountId!,
              amount:                 parsedAmount,
              description:            `Transfer from ${srcName}`,
              notes:                  noteText,
              reference_id:           referenceId,
              entry_mode:             'realtime',
              date:                   selectedDate,
              is_deleted:             0,
              created_at:             now,
              updated_at:             now,
            })
            .returning({ id: transactions.id });

          capturedDebitId  = debitResult[0]?.id  ?? null;
          capturedCreditId = creditResult[0]?.id ?? null;
        });

        // Sync recent-transaction list (store is unaware of direct inserts)
        await loadRecentTransactions();

        // Undo is only available when both IDs were captured
        const transferIds: [number, number] | null =
          capturedDebitId !== null && capturedCreditId !== null
            ? [capturedDebitId, capturedCreditId]
            : null;

        await reloadAccounts();
        setLastEntryMode('realtime');
        setAmount('0');
        showToastFor10s(transferIds);

      } else {
        // ── Normal income / expense ───────────────────────────────────────
        await addTransaction({
          date:        selectedDate,
          type:        txType,
          category_id: selectedCategory?.id ?? null,
          account_id:  selectedAccountId!,
          amount:      parsedAmount,
          description: description.trim() || null,
          entry_mode:  'realtime',
        });

        await reloadAccounts();
        setLastEntryMode('realtime');
        setAmount('0');
        // category & account kept for fast re-entry
        showToastFor10s(null); // store tracks _lastInsertedId for undo
      }
    } catch (err) {
      console.error('[QuickLog] save failed:', err);
      Alert.alert('Error', 'Could not save the transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving, isValid, txType,
    selectedAccountId, destinationAccountId,
    parsedAmount, selectedDate, description,
    selectedCategory, sourceAccount, destAccount,
    addTransaction, loadRecentTransactions, reloadAccounts,
    setLastEntryMode, showToastFor10s,
  ]);

  // ── Toast label ────────────────────────────────────────────────────────────
  const toastLabel =
    txType === 'transfer' ? 'Transfer saved. Undo?' :
    txType === 'income'   ? 'Income saved. Undo?'   :
                            'Expense saved. Undo?';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.root} edges={['bottom']}>

          {/* ── Scrollable form ── */}
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.screenHeader}>
              <Text style={styles.screenTitle}>Log</Text>
            </View>

            {/* ── Type tabs ── */}
            <View style={styles.tabRow}>
              {TX_TABS.map(({ type, label }) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.tab, txType === type && styles.tabActive]}
                  onPress={() => handleTypeChange(type)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabLabel, txType === type && styles.tabLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Amount input (display + keypad) ── */}
            <View style={styles.amountSection}>
              <AmountInput value={amount} onChange={setAmount} />
            </View>

            {/* ── Form fields card ── */}
            <View style={styles.formCard}>

              {/* Category row — hidden for transfers */}
              {txType !== 'transfer' && (
                <>
                  <TouchableOpacity
                    style={styles.formRow}
                    onPress={() => setCatPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    {selectedCategory ? (
                      <View
                        style={[
                          styles.rowIconBox,
                          { backgroundColor: theme.colors.accentSubtle },
                        ]}
                      >
                        <Text style={styles.rowInitial}>
                          {selectedCategory.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.rowIconBox,
                          { backgroundColor: theme.colors.bgPage },
                        ]}
                      >
                        <Ionicons
                          name="pricetag-outline"
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      </View>
                    )}
                    <Text
                      style={selectedCategory ? styles.rowValue : styles.rowLabel}
                      numberOfLines={1}
                    >
                      {selectedCategory?.name ?? 'Select category'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <View style={styles.formRowSep} />
                </>
              )}

              {/* Source account row */}
              <TouchableOpacity
                style={styles.formRow}
                onPress={() => setAccPickerVisible(true)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.rowIconBox,
                    {
                      backgroundColor: sourceAccount
                        ? theme.colors.successSubtle
                        : theme.colors.bgPage,
                    },
                  ]}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={16}
                    color={
                      sourceAccount
                        ? theme.colors.successMain
                        : theme.colors.textSecondary
                    }
                  />
                </View>
                <Text
                  style={sourceAccount ? styles.rowValue : styles.rowLabel}
                  numberOfLines={1}
                >
                  {sourceAccount?.name ??
                    (txType === 'transfer' ? 'From wallet' : 'Select wallet')}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Destination account row — transfers only */}
              {txType === 'transfer' && (
                <>
                  <View style={styles.formRowSep} />
                  <TouchableOpacity
                    style={styles.formRow}
                    onPress={() => setDestPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.rowIconBox,
                        {
                          backgroundColor: destAccount
                            ? theme.colors.accentSubtle
                            : theme.colors.bgPage,
                        },
                      ]}
                    >
                      <Ionicons
                        name="wallet-outline"
                        size={16}
                        color={
                          destAccount
                            ? theme.colors.accentMain
                            : theme.colors.textSecondary
                        }
                      />
                    </View>
                    <Text
                      style={destAccount ? styles.rowValue : styles.rowLabel}
                      numberOfLines={1}
                    >
                      {destAccount?.name ?? 'To wallet'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </>
              )}

              {/* Date row */}
              <View style={styles.formRowSep} />
              <TouchableOpacity
                style={styles.formRow}
                onPress={() => setDatePickerVisible(true)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.rowIconBox,
                    { backgroundColor: theme.colors.warningSubtle },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={theme.colors.warningMain}
                  />
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {formatDateDisplay(selectedDate)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Description */}
              <View style={styles.formRowSep} />
              <View style={styles.formRow}>
                <View
                  style={[
                    styles.rowIconBox,
                    { backgroundColor: theme.colors.bgPage },
                  ]}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </View>
                <TextInput
                  style={styles.descInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What's this for? (optional)"
                  placeholderTextColor={theme.colors.textSecondary}
                  returnKeyType="done"
                  maxLength={100}
                  autoCorrect={false}
                />
              </View>

            </View>{/* end formCard */}

            {/* ── Templates row ── */}
            {relevantTemplates.length > 0 && (
              <View style={styles.templatesSection}>
                <Text style={styles.templatesLabel}>Quick-add:</Text>
                <View style={styles.chipsRow}>
                  {relevantTemplates.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.chip}
                      onPress={() => handleTemplatePress(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>
                        {templateChipLabel(t, templateCategoryNames, getAccountById)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

          </ScrollView>

          {/* ── Save button ── */}
          <View style={styles.bottomArea}>
            <TouchableOpacity
              style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!isValid || isSaving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnLabel}>
                {isSaving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Undo toast ── */}
          {showUndoToast && (
            <View style={styles.toast} pointerEvents="box-none">
              <Text style={styles.toastText}>{toastLabel}</Text>
              <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.toastUndo}>Undo</Text>
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ── Pickers (rendered outside scroll to avoid z-index issues) ── */}
      <CategoryPicker
        visible={catPickerVisible}
        type={txType === 'income' ? 'income' : 'expense'}
        selectedCategoryId={selectedCategory?.id ?? null}
        onSelect={cat => setSelectedCategory(cat)}
        onClose={() => setCatPickerVisible(false)}
      />

      <AccountPicker
        visible={accPickerVisible}
        selectedAccountId={selectedAccountId}
        excludeAccountId={destinationAccountId}
        onSelect={acc => setSelectedAccountId(acc.id)}
        onClose={() => setAccPickerVisible(false)}
      />

      <AccountPicker
        visible={destPickerVisible}
        selectedAccountId={destinationAccountId}
        excludeAccountId={selectedAccountId}
        onSelect={acc => setDestinationAccountId(acc.id)}
        onClose={() => setDestPickerVisible(false)}
      />

      <DatePickerModal
        visible={datePickerVisible}
        value={selectedDate}
        onConfirm={setSelectedDate}
        onClose={() => setDatePickerVisible(false)}
      />
    </>
  );
}
