// src/screens/plan/ObligationDetailScreen.tsx

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
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
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { asc, eq } from 'drizzle-orm';

import type { PlanStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useObligationStore from '@/store/useObligationStore';
import AccountPicker from '@/components/common/AccountPicker';
import db from '@/db';
import {
  obligationPayments,
  obligations,
  type ObligationPayment,
  type Obligation,
  type Account,
} from '@/db/schema';
import { formatCurrency } from '@/utils/formatCurrency';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<PlanStackParamList, 'ObligationDetail'>;
type StatusType = 'paid' | 'due_soon' | 'upcoming' | 'overdue';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const OBLIGATION_TYPES = [
  { label: 'Credit Card',   value: 'credit_card'   },
  { label: 'Personal Loan', value: 'personal_loan'  },
  { label: 'BNPL',          value: 'bnpl'           },
  { label: 'Installment',   value: 'installment'    },
  { label: 'Bank Loan',     value: 'bank_loan'      },
  { label: 'Other',         value: 'other'          },
] as const;

const TYPE_LABEL: Record<string, string> = {
  credit_card:   'Credit Card',
  personal_loan: 'Personal Loan',
  bank_loan:     'Bank Loan',
  bnpl:          'BNPL',
  installment:   'Installment',
  other:         'Other',
};

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

type StatusBadgeInfo = {
  label:   string;
  bgKey:   keyof Theme['colors'];
  textKey: keyof Theme['colors'];
};

const STATUS_BADGE: Record<StatusType, StatusBadgeInfo> = {
  paid:     { label: 'Paid',     bgKey: 'successSubtle', textKey: 'successMain' },
  due_soon: { label: 'Due Soon', bgKey: 'dangerSubtle',  textKey: 'dangerMain'  },
  upcoming: { label: 'Upcoming', bgKey: 'warningSubtle', textKey: 'warningMain' },
  overdue:  { label: 'Overdue',  bgKey: 'dangerSubtle',  textKey: 'dangerMain'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

function diffDays(scheduledDate: string): number {
  const today = new Date(todayStr());
  const due   = new Date(scheduledDate);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateStr: string): string {
  const parts      = dateStr.split('-');
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day        = parseInt(parts[2], 10);
  return `${SHORT_MONTHS[monthIndex]} ${day}`;
}

function formatDateDisplay(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-PH', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateComponents(s: string): { year: number; month: number; day: number } {
  const [y, mo, d] = s.split('-').map(Number);
  return { year: y, month: mo, day: d };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // ── Screen layout ──────────────────────────────────────────────────────────
    safe: {
      flex:            1,
      backgroundColor: theme.colors.bgPage,
    },
    scroll:        { flex: 1 },
    scrollContent: {
      padding:       theme.spacing.base,
      paddingBottom: theme.spacing.xxxl,
    },
    loadingContainer: {
      flex:            1,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: theme.colors.bgPage,
    },
    notFoundTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textSecondary,
    },

    // ── Section label ──────────────────────────────────────────────────────────
    sectionLabel: {
      fontSize:      theme.typography.fontSize.label,
      fontFamily:    theme.typography.fontFamily.semibold,
      color:         theme.colors.textSecondary,
      letterSpacing: theme.typography.letterSpacing.label,
      textTransform: 'uppercase',
      marginTop:     theme.spacing.base,
      marginBottom:  theme.spacing.sm,
    },

    // ── Status card ────────────────────────────────────────────────────────────
    statusCard: {
      backgroundColor: theme.colors.bgCard,
      borderRadius:    theme.radius.large,
      padding:         theme.spacing.base,
      alignItems:      'center',
      ...theme.shadows.card,
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical:   theme.spacing.sm,
      borderRadius:      theme.radius.full,
      marginBottom:      theme.spacing.sm,
    },
    statusBadgeText: {
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.bold,
    },
    nextPaymentText: {
      fontSize:     theme.typography.fontSize.body,
      fontFamily:   theme.typography.fontFamily.medium,
      color:        theme.colors.textSecondary,
      marginBottom: theme.spacing.base,
    },
    markPaidBtn: {
      height:          44,
      width:           '100%',
      borderRadius:    theme.radius.medium,
      backgroundColor: theme.colors.accentMain,
      alignItems:      'center',
      justifyContent:  'center',
    },
    markPaidBtnDisabled: { opacity: 0.4 },
    markPaidBtnTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textInverse,
    },

    // ── Progress card ──────────────────────────────────────────────────────────
    progressCard: {
      backgroundColor: theme.colors.bgCard,
      borderRadius:    theme.radius.large,
      padding:         theme.spacing.base,
      marginBottom:    theme.spacing.base,
      ...theme.shadows.card,
    },
    progressHeader: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'center',
      marginBottom:   theme.spacing.md,
    },
    progressLabel: {
      fontSize:   theme.typography.fontSize.label,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textSecondary,
      letterSpacing: theme.typography.letterSpacing.label,
      textTransform: 'uppercase',
    },
    progressAmounts: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      marginBottom:   theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
    },
    progressAmount: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textPrimary,
    },
    progressAmountLabel: {
      fontSize:   theme.typography.fontSize.label,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textSecondary,
      marginTop:  theme.spacing.xs / 2,
    },
    progressBarContainer: {
      height:       12,
      backgroundColor: theme.colors.bgPage,
      borderRadius: theme.radius.full,
      overflow:     'hidden',
      marginBottom: theme.spacing.md,
    },
    progressBarFilled: {
      height:       '100%',
      backgroundColor: theme.colors.successMain,
      borderRadius: theme.radius.full,
    },
    progressMeta: {
      textAlign:  'center',
      fontSize:   theme.typography.fontSize.label,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textSecondary,
    },

    // ── Details card ───────────────────────────────────────────────────────────
    detailsCard: {
      backgroundColor: theme.colors.bgCard,
      borderRadius:    theme.radius.large,
      overflow:        'hidden',
      ...theme.shadows.card,
    },
    detailRow: {
      flexDirection:     'row',
      justifyContent:    'space-between',
      alignItems:        'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical:   theme.spacing.md,
    },
    detailRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    detailLabel: {
      flex:       1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textSecondary,
    },
    detailValue: {
      flexShrink: 1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textPrimary,
      textAlign:  'right',
    },

    // ── Payment schedule ───────────────────────────────────────────────────────
    scheduleCard: {
      backgroundColor: theme.colors.bgCard,
      borderRadius:    theme.radius.large,
      overflow:        'hidden',
      ...theme.shadows.card,
    },
    paymentRow: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical:   theme.spacing.md,
    },
    paymentRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    paymentDate: {
      flex:       1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textPrimary,
    },
    paymentAmount: {
      fontSize:    theme.typography.fontSize.body,
      fontFamily:  theme.typography.fontFamily.medium,
      color:       theme.colors.textPrimary,
      marginRight: theme.spacing.sm,
    },
    emptyScheduleTxt: {
      padding:    theme.spacing.base,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textDisabled,
      textAlign:  'center',
    },

    // ── Archive button ─────────────────────────────────────────────────────────
    archiveBtn: {
      marginTop:       theme.spacing.xl,
      alignItems:      'center',
      paddingVertical: theme.spacing.sm,
    },
    archiveBtnTxt: {
      fontSize:           theme.typography.fontSize.body,
      fontFamily:         theme.typography.fontFamily.medium,
      color:              theme.colors.textSecondary,
      textDecorationLine: 'underline',
    },

    // ── Mark Paid sheet ────────────────────────────────────────────────────────
    sheetRoot:     { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: { flex: 1, backgroundColor: theme.colors.overlay },
    sheet: {
      backgroundColor:      theme.colors.bgCard,
      borderTopLeftRadius:  theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      padding:              theme.spacing.base,
      paddingBottom:        theme.spacing.xl,
      ...theme.shadows.modal,
    },
    sheetHandle: {
      alignSelf:       'center',
      width:           36,
      height:          4,
      borderRadius:    theme.radius.full,
      backgroundColor: theme.colors.border,
      marginBottom:    theme.spacing.md,
    },
    sheetHeader: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginBottom:   theme.spacing.base,
    },
    sheetTitle: {
      fontSize:   theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    sheetCloseBtn: { padding: theme.spacing.xs },
    sheetCloseX: {
      fontSize: theme.typography.fontSize.heading2,
      color:    theme.colors.textSecondary,
    },
    confirmBtn: {
      height:          52,
      borderRadius:    theme.radius.large,
      backgroundColor: theme.colors.accentMain,
      alignItems:      'center',
      justifyContent:  'center',
    },
    confirmBtnDisabled: { opacity: 0.5 },
    confirmBtnTxt: {
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textInverse,
    },

    // ── Edit sheet ─────────────────────────────────────────────────────────────
    editSafe: {
      flex:            1,
      backgroundColor: theme.colors.bgPage,
    },
    editHeader: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: theme.spacing.base,
      paddingVertical:   theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor:   theme.colors.bgPage,
    },
    editHeaderTitle: {
      fontSize:   theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    editCancelBtn: { padding: theme.spacing.xs },
    editCancelTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textSecondary,
    },
    editSaveBtn: { padding: theme.spacing.xs },
    editSaveTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.accentMain,
    },
    editSaveTxtDisabled: { opacity: 0.5 },
    editScrollContent: {
      padding:       theme.spacing.base,
      paddingBottom: theme.spacing.xxxl,
    },

    // ── Shared form fields ─────────────────────────────────────────────────────
    chipRow: {
      flexDirection: 'row',
      flexWrap:      'wrap',
      gap:           theme.spacing.sm,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical:   theme.spacing.xs,
      borderRadius:      theme.radius.full,
      borderWidth:       1,
      borderColor:       theme.colors.border,
      backgroundColor:   theme.colors.bgCard,
    },
    chipSelected: {
      borderColor:     theme.colors.accentMain,
      backgroundColor: theme.colors.accentSubtle,
    },
    chipTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textSecondary,
    },
    chipTxtSelected: { color: theme.colors.accentMain },
    fieldRow:        { marginBottom: theme.spacing.base },
    fieldLabel: {
      fontSize:     theme.typography.fontSize.body,
      fontFamily:   theme.typography.fontFamily.medium,
      color:        theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    optionalBadge: {
      fontSize:   theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textDisabled,
    },
    inputWrapper: {
      flexDirection:     'row',
      alignItems:        'center',
      backgroundColor:   theme.colors.bgInput,
      borderRadius:      theme.radius.medium,
      borderWidth:       1,
      borderColor:       theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      minHeight:         44,
    },
    inputPrefix: {
      fontSize:    theme.typography.fontSize.body,
      fontFamily:  theme.typography.fontFamily.medium,
      color:       theme.colors.textSecondary,
      marginRight: theme.spacing.xs,
    },
    inputSuffix: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textSecondary,
      marginLeft: theme.spacing.xs,
    },
    input: {
      flex:            1,
      fontSize:        theme.typography.fontSize.body,
      fontFamily:      theme.typography.fontFamily.regular,
      color:           theme.colors.textPrimary,
      paddingVertical: theme.spacing.sm,
    },
    inputMultiline: {
      minHeight:         80,
      textAlignVertical: 'top',
      paddingTop:        theme.spacing.sm,
    },
    dateBtn: {
      flex:            1,
      paddingVertical: theme.spacing.sm,
    },
    dateBtnTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textPrimary,
    },

    // ── Date picker modal ──────────────────────────────────────────────────────
    dpRoot:     { flex: 1, justifyContent: 'flex-end' },
    dpBackdrop: { flex: 1, backgroundColor: theme.colors.overlay },
    dpSheet: {
      backgroundColor:      theme.colors.bgCard,
      borderTopLeftRadius:  theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      padding:              theme.spacing.base,
      paddingBottom:        theme.spacing.xl,
      ...theme.shadows.modal,
    },
    dpHandle: {
      alignSelf:       'center',
      width:           36,
      height:          4,
      borderRadius:    theme.radius.full,
      backgroundColor: theme.colors.border,
      marginBottom:    theme.spacing.md,
    },
    dpSheetHeader: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginBottom:   theme.spacing.lg,
    },
    dpSheetTitle: {
      fontSize:   theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    dpCloseBtn: { padding: theme.spacing.xs },
    dpCloseX: {
      fontSize: theme.typography.fontSize.heading2,
      color:    theme.colors.textSecondary,
    },
    dpSpinnerRow: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingVertical:   theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    dpFieldLabel: {
      width:      60,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textSecondary,
    },
    dpVal: {
      flex:       1,
      textAlign:  'center',
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    dpBtns: { flexDirection: 'row', gap: theme.spacing.sm },
    dpBtn: {
      width:           36,
      height:          36,
      borderRadius:    theme.radius.medium,
      backgroundColor: theme.colors.bgPage,
      alignItems:      'center',
      justifyContent:  'center',
    },
    dpBtnTxt: {
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },
    dpFooter: {
      flexDirection: 'row',
      marginTop:     theme.spacing.lg,
    },
    dpConfirmBtn: {
      flex:            1,
      height:          44,
      borderRadius:    theme.radius.medium,
      backgroundColor: theme.colors.accentMain,
      alignItems:      'center',
      justifyContent:  'center',
    },
    dpConfirmBtnTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textInverse,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE PICKER MODAL
// Matches the pattern in AddObligationScreen — spinner-based, no native picker.
// ─────────────────────────────────────────────────────────────────────────────

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
  const s     = useMemo(() => makeStyles(theme), [theme]);

  const [yr, setYr] = useState(2026);
  const [mo, setMo] = useState(1);
  const [dy, setDy] = useState(1);

  useEffect(() => {
    if (visible) {
      const { year, month, day } = parseDateComponents(value);
      setYr(year);
      setMo(month);
      setDy(day);
    }
  }, [visible, value]);

  useEffect(() => {
    const max = daysInMonth(yr, mo);
    if (dy > max) setDy(max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yr, mo]);

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
      <View style={s.dpRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={s.dpBackdrop} />
        </Pressable>
        <View style={s.dpSheet}>
          <View style={s.dpHandle} />
          <View style={s.dpSheetHeader}>
            <Text style={s.dpSheetTitle}>Select Date</Text>
            <TouchableOpacity
              style={s.dpCloseBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.dpCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Month */}
          <View style={s.dpSpinnerRow}>
            <Text style={s.dpFieldLabel}>Month</Text>
            <Text style={s.dpVal}>{SHORT_MONTHS[mo - 1]}</Text>
            <View style={s.dpBtns}>
              <TouchableOpacity style={s.dpBtn} onPress={() => setMo(m => m > 1  ? m - 1 : 12)}>
                <Text style={s.dpBtnTxt}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dpBtn} onPress={() => setMo(m => m < 12 ? m + 1 : 1)}>
                <Text style={s.dpBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Year */}
          <View style={s.dpSpinnerRow}>
            <Text style={s.dpFieldLabel}>Year</Text>
            <Text style={s.dpVal}>{yr}</Text>
            <View style={s.dpBtns}>
              <TouchableOpacity style={s.dpBtn} onPress={() => setYr(y => y - 1)}>
                <Text style={s.dpBtnTxt}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dpBtn} onPress={() => setYr(y => y + 1)}>
                <Text style={s.dpBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Day */}
          <View style={s.dpSpinnerRow}>
            <Text style={s.dpFieldLabel}>Day</Text>
            <Text style={s.dpVal}>{dy}</Text>
            <View style={s.dpBtns}>
              <TouchableOpacity
                style={s.dpBtn}
                onPress={() => setDy(d => d > 1 ? d - 1 : daysInMonth(yr, mo))}
              >
                <Text style={s.dpBtnTxt}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.dpBtn}
                onPress={() => setDy(d => d < daysInMonth(yr, mo) ? d + 1 : 1)}
              >
                <Text style={s.dpBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.dpFooter}>
            <TouchableOpacity style={s.dpConfirmBtn} onPress={handleConfirm}>
              <Text style={s.dpConfirmBtnTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL ROW
// ─────────────────────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  isLast = false,
  s,
}: {
  label:   string;
  value:   string;
  isLast?: boolean;
  s:       ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[s.detailRow, !isLast && s.detailRowBorder]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS CARD
// ─────────────────────────────────────────────────────────────────────────────

function ProgressCard({
  obligation,
  totalPaymentCount,
  s,
}: {
  obligation: Obligation;
  totalPaymentCount: number;
  s: ReturnType<typeof makeStyles>;
}) {
  // Calculate amount paid: principal - remaining balance
  const amountPaid = obligation.principal_amount
    ? (obligation.principal_amount - (obligation.current_balance ?? 0))
    : 0;

  // Calculate progress percentage
  let progressPercent = 0;
  let progressLabel = '';

  if (obligation.principal_amount && obligation.principal_amount > 0) {
    progressPercent = Math.min(100, (amountPaid / obligation.principal_amount) * 100);
    progressLabel = `${obligation.payments_made} of ${totalPaymentCount} payments made`;
  } else if (totalPaymentCount > 0) {
    progressPercent = Math.min(100, (obligation.payments_made / totalPaymentCount) * 100);
    progressLabel = `${obligation.payments_made} of ${totalPaymentCount} payments made`;
  }

  const remaining = obligation.current_balance ?? 0;

  return (
    <View style={s.progressCard}>
      <View style={s.progressHeader}>
        <Text style={s.progressLabel}>Repayment Progress</Text>
      </View>

      <View style={s.progressAmounts}>
        <View>
          <Text style={s.progressAmount}>{formatCurrency(amountPaid)}</Text>
          <Text style={s.progressAmountLabel}>paid</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.progressAmount}>{formatCurrency(remaining)}</Text>
          <Text style={s.progressAmountLabel}>remaining</Text>
        </View>
      </View>

      <View style={s.progressBarContainer}>
        <View
          style={[
            s.progressBarFilled,
            { width: `${progressPercent}%` },
          ]}
        />
      </View>

      <Text style={s.progressMeta}>{progressLabel}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT ROW
// ─────────────────────────────────────────────────────────────────────────────

function PaymentRow({
  payment,
  isLast,
  theme,
  s,
}: {
  payment: ObligationPayment;
  isLast:  boolean;
  theme:   Theme;
  s:       ReturnType<typeof makeStyles>;
}) {
  const today    = todayStr();
  const isPaid   = payment.is_paid === 1;
  const isOverdue = !isPaid && payment.scheduled_date < today;
  const hasPartialPayment = !isPaid && payment.amount_paid && payment.amount_paid > 0;

  const iconName  = isPaid
    ? 'checkmark-circle'
    : isOverdue
    ? 'alert-circle'
    : 'ellipse-outline';

  const iconColor = isPaid
    ? theme.colors.successMain
    : isOverdue
    ? theme.colors.dangerMain
    : hasPartialPayment
    ? theme.colors.warningMain
    : theme.colors.textDisabled;

  return (
    <View style={[s.paymentRow, !isLast && s.paymentRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.paymentDate}>
          {formatShortDate(payment.scheduled_date)}
          {isPaid && payment.paid_date && ` • Paid ${formatShortDate(payment.paid_date)}`}
        </Text>
        {hasPartialPayment && (
          <Text style={[s.paymentAmount, { color: theme.colors.warningMain, marginTop: 4 }]}>
            {`Partial: ${formatCurrency(payment.amount_paid)} of ${formatCurrency(payment.amount_due)}`}
          </Text>
        )}
      </View>
      <Text style={s.paymentAmount}>
        {isPaid ? formatCurrency(payment.amount_paid || payment.amount_due) : formatCurrency(payment.amount_due)}
      </Text>
      <Ionicons
        name={iconName as React.ComponentProps<typeof Ionicons>['name']}
        size={20}
        color={iconColor}
        style={{ marginLeft: theme.spacing.sm }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK PAID SHEET
// ─────────────────────────────────────────────────────────────────────────────

function MarkPaidSheet({
  visible,
  nextPayment,
  onConfirm,
  onClose,
}: {
  visible:     boolean;
  nextPayment: ObligationPayment | null;
  onConfirm:   (amountPaid: number, accountId: number) => Promise<void>;
  onClose:     () => void;
}) {
  const theme = useTheme();
  const s     = useMemo(() => makeStyles(theme), [theme]);

  const [amount,               setAmount]               = useState('');
  const [accountId,            setAccountId]            = useState<number | null>(null);
  const [accountName,          setAccountName]          = useState('');
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [confirming,           setConfirming]           = useState(false);

  useEffect(() => {
    if (visible && nextPayment) {
      setAmount(String(nextPayment.amount_due));
      setAccountId(null);
      setAccountName('');
    }
  }, [visible, nextPayment]);

  const handleConfirm = async () => {
    if (!accountId) {
      Alert.alert('Select wallet', 'Please select a wallet to pay from.');
      return;
    }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payment amount.');
      return;
    }
    setConfirming(true);
    try {
      await onConfirm(parsed, accountId);
    } catch {
      Alert.alert('Error', 'Could not mark payment as paid. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <View style={s.sheetRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <View style={s.sheetBackdrop} />
          </Pressable>

          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Mark payment as paid</Text>
              <TouchableOpacity
                style={s.sheetCloseBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.sheetCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Amount paid</Text>
              <View style={s.inputWrapper}>
                <Text style={s.inputPrefix}>₱</Text>
                <TextInput
                  style={s.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  placeholderTextColor={theme.colors.textDisabled}
                />
              </View>
            </View>

            {/* From wallet */}
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>From wallet</Text>
              <TouchableOpacity
                style={s.inputWrapper}
                onPress={() => setAccountPickerVisible(true)}
                activeOpacity={0.7}
              >
                <View style={s.dateBtn}>
                  <Text
                    style={[s.dateBtnTxt, !accountId && { color: theme.colors.textDisabled }]}
                  >
                    {accountId ? accountName : 'Select wallet'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Date paid — informational; store always uses today */}
            <View style={[s.fieldRow, { marginBottom: theme.spacing.xl }]}>
              <Text style={s.fieldLabel}>Date paid</Text>
              <View style={[s.inputWrapper, { opacity: 0.6 }]}>
                <View style={s.dateBtn}>
                  <Text style={s.dateBtnTxt}>{formatDateDisplay(todayStr())}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, confirming && s.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={confirming}
              activeOpacity={0.8}
            >
              <Text style={s.confirmBtnTxt}>
                {confirming ? 'Processing…' : 'Confirm Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AccountPicker as a sibling modal so it is never nested */}
      <AccountPicker
        visible={accountPickerVisible}
        selectedAccountId={accountId}
        onSelect={(acc: Account) => {
          setAccountId(acc.id);
          setAccountName(acc.name);
          setAccountPickerVisible(false);
        }}
        onClose={() => setAccountPickerVisible(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT SHEET
// Minimal metadata-only edit mode. Does NOT regenerate the payment schedule.
// ─────────────────────────────────────────────────────────────────────────────

function EditSheet({
  visible,
  obligation,
  onSave,
  onClose,
}: {
  visible:    boolean;
  obligation: Obligation | null;
  onSave:     () => Promise<void>;
  onClose:    () => void;
}) {
  const theme = useTheme();
  const s     = useMemo(() => makeStyles(theme), [theme]);

  const [name,             setName]             = useState('');
  const [type,             setType]             = useState('');
  const [monthlyPayment,   setMonthlyPayment]   = useState('');
  const [nextDueDate,      setNextDueDate]      = useState(todayStr());
  const [balance,          setBalance]          = useState('');
  const [interestRate,     setInterestRate]     = useState('');
  const [notes,            setNotes]            = useState('');
  const [dpVisible,        setDpVisible]        = useState(false);
  const [saving,           setSaving]           = useState(false);

  // Pre-fill when sheet opens
  useEffect(() => {
    if (visible && obligation) {
      setName(obligation.name);
      setType(obligation.type);
      setMonthlyPayment(String(obligation.monthly_payment));
      setNextDueDate(obligation.next_due_date);
      setBalance(obligation.current_balance != null ? String(obligation.current_balance) : '');
      setInterestRate(obligation.interest_rate != null ? String(obligation.interest_rate) : '');
      setNotes(obligation.notes ?? '');
    }
  }, [visible, obligation]);

  const handleSave = async () => {
    if (!obligation || !name.trim()) return;
    const parsed = parseFloat(monthlyPayment);
    if (!parsed || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid monthly payment.');
      return;
    }
    setSaving(true);
    try {
      await db
        .update(obligations)
        .set({
          name:            name.trim(),
          type,
          monthly_payment: parsed,
          next_due_date:   nextDueDate,
          current_balance: balance      ? parseFloat(balance)      : null,
          interest_rate:   interestRate ? parseFloat(interestRate) : null,
          notes:           notes.trim() || null,
          updated_at:      nowISO(),
        })
        .where(eq(obligations.id, obligation.id));
      await onSave();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.editSafe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={s.editHeader}>
          <TouchableOpacity
            style={s.editCancelBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.editCancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.editHeaderTitle}>Edit Obligation</Text>
          <TouchableOpacity
            style={s.editSaveBtn}
            onPress={handleSave}
            disabled={saving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[s.editSaveTxt, saving && s.editSaveTxtDisabled]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.editScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type */}
            <Text style={s.sectionLabel}>Type</Text>
            <View style={s.chipRow}>
              {OBLIGATION_TYPES.map(({ label, value }) => {
                const selected = type === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[s.chip, selected && s.chipSelected]}
                    onPress={() => setType(value)}
                  >
                    <Text style={[s.chipTxt, selected && s.chipTxtSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Details */}
            <Text style={[s.sectionLabel, { marginTop: theme.spacing.lg }]}>Details</Text>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Name</Text>
              <View style={s.inputWrapper}>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Obligation name"
                  placeholderTextColor={theme.colors.textDisabled}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Monthly payment</Text>
              <View style={s.inputWrapper}>
                <Text style={s.inputPrefix}>₱</Text>
                <TextInput
                  style={s.input}
                  value={monthlyPayment}
                  onChangeText={setMonthlyPayment}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textDisabled}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Next due date</Text>
              <TouchableOpacity
                style={s.inputWrapper}
                onPress={() => setDpVisible(true)}
                activeOpacity={0.7}
              >
                <View style={s.dateBtn}>
                  <Text style={s.dateBtnTxt}>{formatDateDisplay(nextDueDate)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>
                Remaining balance{' '}
                <Text style={s.optionalBadge}>(optional)</Text>
              </Text>
              <View style={s.inputWrapper}>
                <Text style={s.inputPrefix}>₱</Text>
                <TextInput
                  style={s.input}
                  value={balance}
                  onChangeText={setBalance}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textDisabled}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>
                Interest rate{' '}
                <Text style={s.optionalBadge}>(optional)</Text>
              </Text>
              <View style={s.inputWrapper}>
                <TextInput
                  style={s.input}
                  value={interestRate}
                  onChangeText={setInterestRate}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textDisabled}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
                <Text style={s.inputSuffix}>% per month</Text>
              </View>
            </View>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>
                Notes{' '}
                <Text style={s.optionalBadge}>(optional)</Text>
              </Text>
              <View style={s.inputWrapper}>
                <TextInput
                  style={[s.input, s.inputMultiline]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any details..."
                  placeholderTextColor={theme.colors.textDisabled}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={{ height: theme.spacing.xxxl }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <DatePickerModal
          visible={dpVisible}
          value={nextDueDate}
          onConfirm={(date) => setNextDueDate(date)}
          onClose={() => setDpVisible(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OBLIGATION DETAIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function ObligationDetailScreen({ navigation, route }: Props) {
  const { obligationId } = route.params;
  const theme = useTheme();
  const s     = useMemo(() => makeStyles(theme), [theme]);

  // Store
  const obligationsList   = useObligationStore(st => st.obligations);
  const loadObligations   = useObligationStore(st => st.loadObligations);
  const markPaymentPaid   = useObligationStore(st => st.markPaymentPaid);
  const archiveObligation = useObligationStore(st => st.archiveObligation);
  const isLoading         = useObligationStore(st => st.isLoading);

  // Local state
  const [payments,        setPayments]        = useState<ObligationPayment[]>([]);
  const [markPaidVisible, setMarkPaidVisible] = useState(false);
  const [editVisible,     setEditVisible]     = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const obligation = useMemo(
    () => obligationsList.find(o => o.id === obligationId) ?? null,
    [obligationsList, obligationId],
  );

  const nextPayment = useMemo(
    () => payments.find(p => p.is_paid === 0) ?? null,
    [payments],
  );

  const daysUntilDue = useMemo(
    () => (nextPayment ? diffDays(nextPayment.scheduled_date) : null),
    [nextPayment],
  );

  const status: StatusType = useMemo(() => {
    if (!nextPayment) return 'paid';
    if (daysUntilDue === null) return 'upcoming';
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 3) return 'due_soon';
    return 'upcoming';
  }, [nextPayment, daysUntilDue]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadPayments = useCallback(async () => {
    const rows = await db
      .select()
      .from(obligationPayments)
      .where(eq(obligationPayments.obligation_id, obligationId))
      .orderBy(asc(obligationPayments.scheduled_date));
    setPayments(rows);
  }, [obligationId]);

  useFocusEffect(
    useCallback(() => {
      loadObligations().then(() => loadPayments());
    }, [loadObligations, loadPayments]),
  );

  // ── Navigation options ─────────────────────────────────────────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      title: obligation?.name ?? 'Obligation',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setEditVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, obligation?.name]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleMarkPaidConfirm = useCallback(
    async (amountPaid: number, accountId: number) => {
      if (!nextPayment) return;
      await markPaymentPaid(nextPayment.id, accountId, amountPaid);
      await loadPayments();
      setMarkPaidVisible(false);
    },
    [nextPayment, markPaymentPaid, loadPayments],
  );

  const handleEditSave = useCallback(async () => {
    await loadObligations();
    await loadPayments();
  }, [loadObligations, loadPayments]);

  const handleArchive = useCallback(() => {
    if (!obligation) return;
    Alert.alert(
      `Mark ${obligation.name} as fully paid off?`,
      'It will be removed from your active obligations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            await archiveObligation(obligation.id);
            navigation.navigate('ObligationList');
          },
        },
      ],
    );
  }, [obligation, archiveObligation, navigation]);

  // ── Loading / not found guard ──────────────────────────────────────────────

  if (!obligation) {
    const genuinelyNotFound = !isLoading && obligationsList.length > 0;
    return (
      <View style={s.loadingContainer}>
        {genuinelyNotFound ? (
          <Text style={s.notFoundTxt}>Obligation not found.</Text>
        ) : (
          <ActivityIndicator color={theme.colors.accentMain} size="large" />
        )}
      </View>
    );
  }

  const badge = STATUS_BADGE[status];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status card ───────────────────────────────────────────────────── */}
        <View style={s.statusCard}>
          <View style={[s.statusBadge, { backgroundColor: theme.colors[badge.bgKey] as string }]}>
            <Text style={[s.statusBadgeText, { color: theme.colors[badge.textKey] as string }]}>
              {badge.label}
            </Text>
          </View>

          <Text style={s.nextPaymentText}>
            {nextPayment
              ? `${formatCurrency(nextPayment.amount_due)} due ${formatShortDate(nextPayment.scheduled_date)}`
              : 'All payments complete'
            }
          </Text>

          <TouchableOpacity
            style={[s.markPaidBtn, !nextPayment && s.markPaidBtnDisabled]}
            onPress={() => setMarkPaidVisible(true)}
            disabled={!nextPayment}
            activeOpacity={0.8}
          >
            <Text style={s.markPaidBtnTxt}>Mark as Paid</Text>
          </TouchableOpacity>
        </View>

        {/* ── Progress card ────────────────────────────────────────────────── */}
        <ProgressCard
          obligation={obligation}
          totalPaymentCount={payments.length}
          s={s}
        />

        {/* ── Details ──────────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Details</Text>
        <View style={s.detailsCard}>
          <DetailRow
            label="Monthly payment"
            value={formatCurrency(obligation.monthly_payment)}
            s={s}
          />
          <DetailRow
            label="Type"
            value={TYPE_LABEL[obligation.type] ?? obligation.type}
            s={s}
          />
          <DetailRow
            label="Remaining balance"
            value={obligation.current_balance != null
              ? formatCurrency(obligation.current_balance)
              : 'Not specified'}
            s={s}
          />
          <DetailRow
            label="Interest rate"
            value={obligation.interest_rate != null
              ? `${obligation.interest_rate}% / month`
              : 'Not specified'}
            s={s}
          />
          <DetailRow
            label="Payments made"
            value={String(obligation.payments_made)}
            isLast={!obligation.notes}
            s={s}
          />
          {obligation.notes ? (
            <DetailRow label="Notes" value={obligation.notes} isLast s={s} />
          ) : null}
        </View>

        {/* ── Payment schedule ─────────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { marginTop: theme.spacing.lg }]}>
          Payment schedule
        </Text>
        <View style={s.scheduleCard}>
          {payments.length === 0 ? (
            <Text style={s.emptyScheduleTxt}>No payment schedule generated.</Text>
          ) : (
            payments.map((p, i) => (
              <PaymentRow
                key={p.id}
                payment={p}
                isLast={i === payments.length - 1}
                theme={theme}
                s={s}
              />
            ))
          )}
        </View>

        {/* ── Archive ──────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.archiveBtn}
          onPress={handleArchive}
          activeOpacity={0.7}
        >
          <Text style={s.archiveBtnTxt}>Mark as fully paid off</Text>
        </TouchableOpacity>

        <View style={{ height: theme.spacing.huge }} />
      </ScrollView>

      <MarkPaidSheet
        visible={markPaidVisible}
        nextPayment={nextPayment}
        onConfirm={handleMarkPaidConfirm}
        onClose={() => setMarkPaidVisible(false)}
      />

      <EditSheet
        visible={editVisible}
        obligation={obligation}
        onSave={handleEditSave}
        onClose={() => setEditVisible(false)}
      />
    </SafeAreaView>
  );
}