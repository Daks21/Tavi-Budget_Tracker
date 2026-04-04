// src/screens/plan/AddObligationScreen.tsx

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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { PlanStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useObligationStore from '@/store/useObligationStore';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & PROPS
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<PlanStackParamList, 'AddObligation'>;

type ObligationType =
  | 'credit_card'
  | 'personal_loan'
  | 'bnpl'
  | 'installment'
  | 'bank_loan'
  | 'other';

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

const PAYMENT_FREQUENCIES = [
  { label: 'Monthly',       value: 'monthly'        },
  { label: 'Every 2 weeks', value: 'semi_monthly'   },
  { label: 'Weekly',        value: 'weekly'         },
] as const;

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultNextDueDate(): string {
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
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

function formatDateDisplay(dateStr: string): string {
  const { year, month, day } = parseDateComponents(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE PICKER MODAL — styles
// ─────────────────────────────────────────────────────────────────────────────

function makeDPStyles(theme: Theme) {
  return StyleSheet.create({
    root:     { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: theme.colors.overlay },
    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius:  theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      padding:       theme.spacing.base,
      paddingBottom: theme.spacing.xl,
      ...theme.shadows.modal,
    },
    handle: {
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
      fontSize: theme.typography.fontSize.heading2,
      color:    theme.colors.textSecondary,
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
    spinnerBtns: { flexDirection: 'row', gap: theme.spacing.sm },
    spinnerBtn: {
      width:          36,
      height:         36,
      borderRadius:   theme.radius.medium,
      backgroundColor: theme.colors.bgPage,
      alignItems:     'center',
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
    confirmBtn: {
      flex:            1,
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

  useEffect(() => {
    if (visible) {
      const { year, month, day } = parseDateComponents(value);
      setYr(year); setMo(month); setDy(day);
    }
  }, [visible, value]);

  useEffect(() => {
    const max = daysInMonth(yr, mo);
    if (dy > max) setDy(max);
  }, [yr, mo]); // intentionally omit dy

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
              <TouchableOpacity style={s.spinnerBtn} onPress={() => setDy(d => d > 1 ? d - 1 : daysInMonth(yr, mo))}>
                <Text style={s.spinnerBtnTxt}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.spinnerBtn} onPress={() => setDy(d => d < daysInMonth(yr, mo) ? d + 1 : 1)}>
                <Text style={s.spinnerBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.dpFooter}>
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
// SCREEN STYLES
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },
    kav: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: {
      padding:       theme.spacing.base,
      paddingBottom: theme.spacing.xxxl,
    },

    // Header
    header: {
      flexDirection:  'row',
      alignItems:     'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical:   theme.spacing.md,
      backgroundColor:   theme.colors.bgPage,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backBtn: {
      padding:      theme.spacing.xs,
      marginRight:  theme.spacing.sm,
    },
    backTxt: {
      fontSize:   theme.typography.fontSize.bodyLarge,
      color:      theme.colors.accentMain,
      fontFamily: theme.typography.fontFamily.medium,
    },
    headerTitle: {
      flex:       1,
      fontSize:   theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textPrimary,
    },

    // Section
    sectionLabel: {
      fontSize:      theme.typography.fontSize.label,
      fontFamily:    theme.typography.fontFamily.semibold,
      color:         theme.colors.textSecondary,
      letterSpacing: theme.typography.letterSpacing.label,
      textTransform: 'uppercase',
      marginTop:     theme.spacing.lg,
      marginBottom:  theme.spacing.sm,
    },

    // Type chips
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
    chipTxtSelected: {
      color: theme.colors.accentMain,
    },

    // Field
    fieldRow: {
      marginBottom: theme.spacing.base,
    },
    fieldLabel: {
      fontSize:     theme.typography.fontSize.body,
      fontFamily:   theme.typography.fontFamily.medium,
      color:        theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    fieldLabelOptional: {
      color: theme.colors.textSecondary,
    },
    optionalBadge: {
      fontSize:   theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textDisabled,
    },
    inputWrapper: {
      flexDirection:  'row',
      alignItems:     'center',
      backgroundColor: theme.colors.bgInput,
      borderRadius:   theme.radius.medium,
      borderWidth:    1,
      borderColor:    theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      minHeight:      44,
    },
    inputWrapperError: {
      borderColor: theme.colors.dangerMain,
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
      flex:       1,
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textPrimary,
      paddingVertical: theme.spacing.sm,
    },
    inputMultiline: {
      minHeight:  80,
      textAlignVertical: 'top',
      paddingTop: theme.spacing.sm,
    },
    dateBtn: {
      flex:       1,
      paddingVertical: theme.spacing.sm,
    },
    dateBtnTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textPrimary,
    },
    helperTxt: {
      fontSize:   theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.textSecondary,
      marginTop:  theme.spacing.xs,
    },
    errorTxt: {
      fontSize:   theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.dangerMain,
      marginTop:  theme.spacing.xs,
    },

    // Important helper box
    importantBox: {
      backgroundColor: theme.colors.accentSubtle,
      borderRadius:    theme.radius.medium,
      padding:         theme.spacing.md,
      marginTop:       theme.spacing.lg,
      marginBottom:    theme.spacing.base,
    },
    importantTxt: {
      fontSize:   theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color:      theme.colors.accentMain,
      lineHeight: theme.typography.lineHeight.body,
    },

    // Save button
    saveBtn: {
      height:          52,
      borderRadius:    theme.radius.large,
      backgroundColor: theme.colors.accentMain,
      alignItems:      'center',
      justifyContent:  'center',
      marginTop:       theme.spacing.sm,
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnTxt: {
      fontSize:   theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color:      theme.colors.textInverse,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function AddObligationScreen({ navigation }: Props) {
  const theme = useTheme();
  const s     = useMemo(() => makeStyles(theme), [theme]);

  const addObligation   = useObligationStore(state => state.addObligation);
  const loadObligations = useObligationStore(state => state.loadObligations);

  // Form state
  const [obligationType, setObligationType] = useState<ObligationType | ''>('');
  const [name,            setName]           = useState('');
  const [monthlyPayment,  setMonthlyPayment] = useState('');
  const [nextDueDate,     setNextDueDate]    = useState(defaultNextDueDate);
  const [currentBalance,  setCurrentBalance] = useState('');
  const [interestRate,    setInterestRate]   = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'semi_monthly' | 'weekly'>('monthly');
  const [notes,           setNotes]          = useState('');

  // Validation errors (only shown after touched or save attempt)
  const [touched, setTouched]   = useState<Record<string, boolean>>({});
  const [errors,  setErrors]    = useState<Record<string, string>>({});

  // UI state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [saving, setSaving]                        = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = useCallback((allTouched = false): Record<string, string> => {
    const e: Record<string, string> = {};

    if (allTouched || touched.type) {
      if (!obligationType) e.type = 'Please select the obligation type.';
    }
    if (allTouched || touched.name) {
      if (!name.trim()) e.name = 'Please give this obligation a name.';
    }
    if (allTouched || touched.monthlyPayment) {
      const v = parseFloat(monthlyPayment);
      if (!monthlyPayment || isNaN(v) || v <= 0) e.monthlyPayment = 'Please enter the monthly payment amount.';
    }
    if (allTouched || touched.nextDueDate) {
      if (!nextDueDate) e.nextDueDate = 'Please select the next due date.';
    }

    return e;
  }, [obligationType, name, monthlyPayment, nextDueDate, touched]);

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Re-run validation whenever dependencies change
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      setErrors(validate());
    }
  }, [obligationType, name, monthlyPayment, nextDueDate, touched, validate]);

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const allErrors = validate(true);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) return;

    if (!obligationType) return;

    const safeType: ObligationType = obligationType;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type: safeType,
        monthly_payment: parseFloat(monthlyPayment),
        next_due_date: nextDueDate,
        payment_frequency: paymentFrequency,
        current_balance: currentBalance ? parseFloat(currentBalance) : null,
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await addObligation(payload);
      await loadObligations();
      navigation.navigate('ObligationList');
    } catch (err) {
      Alert.alert('Error', 'Could not save obligation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Obligation</Text>
      </View>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Type selector ─────────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Type</Text>
          <View style={s.chipRow}>
            {OBLIGATION_TYPES.map(({ label, value }) => {
              const selected = obligationType === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[s.chip, selected && s.chipSelected]}
                  onPress={() => {
                    setObligationType(value);
                    markTouched('type');
                  }}
                >
                  <Text style={[s.chipTxt, selected && s.chipTxtSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.type ? <Text style={s.errorTxt}>{errors.type}</Text> : null}

          {/* ── Name ──────────────────────────────────────────────────────── */}
          <Text style={[s.sectionLabel, { marginTop: theme.spacing.lg }]}>Details</Text>

          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Name</Text>
            <View style={[s.inputWrapper, errors.name ? s.inputWrapperError : null]}>
              <TextInput
                style={s.input}
                placeholder="e.g. RCBC CC, BPI Personal Loan, ShopeePay Later"
                placeholderTextColor={theme.colors.textDisabled}
                value={name}
                onChangeText={setName}
                onBlur={() => markTouched('name')}
                returnKeyType="next"
                autoCapitalize="words"
              />
            </View>
            {errors.name
              ? <Text style={s.errorTxt}>{errors.name}</Text>
              : <Text style={s.helperTxt}>Give it a name you'll recognize.</Text>
            }
          </View>

          {/* ── Monthly payment ───────────────────────────────────────────── */}
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Monthly payment</Text>
            <View style={[s.inputWrapper, errors.monthlyPayment ? s.inputWrapperError : null]}>
              <Text style={s.inputPrefix}>₱</Text>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textDisabled}
                value={monthlyPayment}
                onChangeText={setMonthlyPayment}
                onBlur={() => markTouched('monthlyPayment')}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            {errors.monthlyPayment
              ? <Text style={s.errorTxt}>{errors.monthlyPayment}</Text>
              : <Text style={s.helperTxt}>The amount you pay each month (or per period).</Text>
            }
          </View>

          {/* ── Next due date ─────────────────────────────────────────────── */}
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Next due date</Text>
            <TouchableOpacity
              style={[s.inputWrapper, errors.nextDueDate ? s.inputWrapperError : null]}
              onPress={() => {
                markTouched('nextDueDate');
                setDatePickerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={s.dateBtn}>
                <Text style={s.dateBtnTxt}>{formatDateDisplay(nextDueDate)}</Text>
              </View>
            </TouchableOpacity>
            {errors.nextDueDate
              ? <Text style={s.errorTxt}>{errors.nextDueDate}</Text>
              : null
            }
          </View>

          {/* ── Current balance (optional) ────────────────────────────────── */}
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>
              Remaining balance{' '}
              <Text style={s.optionalBadge}>(optional)</Text>
            </Text>
            <View style={s.inputWrapper}>
              <Text style={s.inputPrefix}>₱</Text>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textDisabled}
                value={currentBalance}
                onChangeText={setCurrentBalance}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <Text style={s.helperTxt}>
              How much you still owe in total. Skip if you're not sure.
            </Text>
          </View>

          {/* ── Interest rate (optional) ───────────────────────────────────── */}
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>
              Interest rate{' '}
              <Text style={s.optionalBadge}>(optional)</Text>
            </Text>
            <View style={s.inputWrapper}>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textDisabled}
                value={interestRate}
                onChangeText={setInterestRate}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
              <Text style={s.inputSuffix}>% per month</Text>
            </View>
            <Text style={s.helperTxt}>
              Check your statement or contract. Skip if unknown.
            </Text>
          </View>

          {/* ── Payment frequency (optional) ─────────────────────────────── */}
          <Text style={s.sectionLabel}>
            Payment frequency{' '}
            <Text style={{ textTransform: 'none', letterSpacing: 0, fontSize: theme.typography.fontSize.caption, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.textDisabled }}>(optional)</Text>
          </Text>
          <View style={[s.chipRow, { marginBottom: theme.spacing.base }]}>
            {PAYMENT_FREQUENCIES.map(({ label, value }) => {
              const selected = paymentFrequency === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[s.chip, selected && s.chipSelected]}
                  onPress={() => setPaymentFrequency(value)}
                >
                  <Text style={[s.chipTxt, selected && s.chipTxtSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Notes (optional) ──────────────────────────────────────────── */}
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>
              Notes{' '}
              <Text style={s.optionalBadge}>(optional)</Text>
            </Text>
            <View style={s.inputWrapper}>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Any details you want to remember..."
                placeholderTextColor={theme.colors.textDisabled}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* ── Important helper ──────────────────────────────────────────── */}
          <View style={s.importantBox}>
            <Text style={s.importantTxt}>
              You don't need all the details right now. Name, payment amount, and due date are enough to get started.
            </Text>
          </View>

          {/* ── Save button ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={s.saveBtnTxt}>
              {saving ? 'Saving…' : 'Add Obligation'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date picker */}
      <DatePickerModal
        visible={datePickerVisible}
        value={nextDueDate}
        onConfirm={date => {
          setNextDueDate(date);
          markTouched('nextDueDate');
        }}
        onClose={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
}
