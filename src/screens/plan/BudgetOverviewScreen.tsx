// src/screens/plan/BudgetOverviewScreen.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { and, eq, like, sql } from 'drizzle-orm';

import type { PlanStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useBudgetStore, { type BudgetWithProgress } from '@/store/useBudgetStore';
import { formatCurrency } from '@/utils/formatCurrency';
import db from '@/db';
import { categories, transactions, type Category } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<PlanStackParamList, 'BudgetOverview'>;

interface CategoryWithSpend {
  category: Category;
  amountSpent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthPrefix(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

function BudgetProgressBar({
  percent,
  theme,
}: {
  percent: number;
  theme: Theme;
}) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const fillColor =
    percent >= 100
      ? theme.colors.dangerMain
      : percent >= 70
      ? theme.colors.warningMain
      : theme.colors.accentMain;

  useEffect(() => {
    if (trackWidth > 0) {
      const target = (trackWidth * Math.min(percent, 100)) / 100;
      Animated.timing(animWidth, {
        toValue: target,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [trackWidth, percent, animWidth]);

  return (
    <View
      style={{
        height: 8,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
      }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={{
          height: 8,
          borderRadius: theme.radius.full,
          backgroundColor: fillColor,
          width: animWidth,
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetOverviewScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);

  const loadBudgets = useBudgetStore((st) => st.loadBudgets);
  const getBudgetProgress = useBudgetStore((st) => st.getBudgetProgress);
  const setBudgetLimitAction = useBudgetStore((st) => st.setBudgetLimit);
  const storeCategories = useBudgetStore((st) => st.categories);

  const now = new Date();
  const [displayMonth, setDisplayMonth] = useState(now.getMonth() + 1);
  const [displayYear, setDisplayYear] = useState(now.getFullYear());

  const [budgetProgress, setBudgetProgress] = useState<BudgetWithProgress[]>([]);
  const [unbudgetedCategories, setUnbudgetedCategories] = useState<CategoryWithSpend[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showSetLimitSheet, setShowSetLimitSheet] = useState(false);
  const [selectedCategoryForLimit, setSelectedCategoryForLimit] = useState<Category | null>(null);

  // Sheet form state
  const [sheetAmount, setSheetAmount] = useState('');
  const [sheetRollover, setSheetRollover] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  async function fetchData(month: number, year: number) {
    setIsLoading(true);
    try {
      await loadBudgets(month, year);
      const progress = await getBudgetProgress(month, year);
      setBudgetProgress(progress);

      // Compute unbudgeted: expense categories with spending but no budget
      const allExpense = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.is_active, 1),
            eq(categories.type, 'expense'),
          ),
        );

      const budgetedIds = new Set(progress.map((b) => b.category.id));
      const unbudgeted = allExpense.filter((c) => !budgetedIds.has(c.id));

      if (unbudgeted.length === 0) {
        setUnbudgetedCategories([]);
        return;
      }

      const spendingRows = await db
        .select({
          category_id: transactions.category_id,
          total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'expense'),
            eq(transactions.is_deleted, 0),
            like(transactions.date, monthPrefix(month, year)),
          ),
        )
        .groupBy(transactions.category_id);

      const spendMap = new Map(
        spendingRows.map((r) => [r.category_id as number, r.total]),
      );

      const result: CategoryWithSpend[] = unbudgeted
        .map((c) => ({ category: c, amountSpent: spendMap.get(c.id) ?? 0 }))
        .filter((x) => x.amountSpent > 0);

      setUnbudgetedCategories(result);
    } finally {
      setIsLoading(false);
    }
  }

  // Reload when month/year changes (covers initial mount too)
  useEffect(() => {
    fetchData(displayMonth, displayYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMonth, displayYear]);

  // Reload on screen focus (handles returning from BudgetCategoryDetail)
  useFocusEffect(
    useCallback(() => {
      fetchData(displayMonth, displayYear);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayMonth, displayYear]),
  );

  // ── Month navigation ───────────────────────────────────────────────────────

  function prevMonth() {
    if (displayMonth === 1) {
      setDisplayMonth(12);
      setDisplayYear((y) => y - 1);
    } else {
      setDisplayMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (displayMonth === 12) {
      setDisplayMonth(1);
      setDisplayYear((y) => y + 1);
    } else {
      setDisplayMonth((m) => m + 1);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const totalBudgeted = budgetProgress.reduce(
    (sum, b) => sum + b.budget.limit_amount,
    0,
  );
  const totalSpent =
    budgetProgress.reduce((sum, b) => sum + b.consumed, 0) +
    unbudgetedCategories.reduce((sum, u) => sum + u.amountSpent, 0);
  const totalRemaining = totalBudgeted - totalSpent;

  // ── Sheet handlers ─────────────────────────────────────────────────────────

  function openSheet(category: Category | null) {
    setSelectedCategoryForLimit(category);
    setSheetAmount('');
    setSheetRollover(false);
    setShowSetLimitSheet(true);
  }

  async function handleSave() {
    if (!selectedCategoryForLimit) return;
    const amount = parseFloat(sheetAmount.replace(/,/g, ''));
    if (!amount || isNaN(amount) || amount <= 0) return;

    await setBudgetLimitAction(
      selectedCategoryForLimit.id,
      amount,
      displayMonth,
      displayYear,
      sheetRollover,
    );
    setShowSetLimitSheet(false);
    fetchData(displayMonth, displayYear);
  }

  const allExpenseCategories = storeCategories.filter((c) => c.type === 'expense');

  const isEmpty =
    !isLoading &&
    budgetProgress.length === 0 &&
    unbudgetedCategories.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Screen header */}
      <Text style={s.screenHeader}>Budget</Text>

      {/* Month selector */}
      <View style={s.monthSelector}>
        <TouchableOpacity
          onPress={prevMonth}
          style={s.arrowBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.arrowText}>‹</Text>
        </TouchableOpacity>

        <Text style={s.monthText}>
          {MONTH_NAMES[displayMonth - 1]} {displayYear}
        </Text>

        <TouchableOpacity
          onPress={nextMonth}
          style={s.arrowBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={s.summaryBar}>
        <View style={s.summaryItem}>
          <Text style={s.summaryPhrase}>
            <Text style={s.summaryAmount}>{formatCurrency(totalBudgeted)}</Text>
            {' budgeted\nthis month'}
          </Text>
        </View>

        <View style={s.summaryDivider} />

        <View style={s.summaryItem}>
          <Text style={s.summaryPhrase}>
            <Text style={s.summaryAmount}>{formatCurrency(totalSpent)}</Text>
            {' spent\nso far'}
          </Text>
        </View>

        <View style={s.summaryDivider} />

        <View style={s.summaryItem}>
          <Text style={s.summaryPhrase}>
            <Text
              style={[
                s.summaryAmount,
                {
                  color:
                    totalRemaining >= 0
                      ? theme.colors.successMain
                      : theme.colors.dangerMain,
                },
              ]}
            >
              {formatCurrency(totalRemaining)}
            </Text>
            {'\nremaining'}
          </Text>
        </View>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color={theme.colors.accentMain} />
        </View>
      ) : isEmpty ? (
        <View style={s.emptyState}>
          <View style={s.mascotPlaceholder} />
          <Text style={s.emptyTitle}>No spending tracked yet.</Text>
          <Text style={s.emptySubtitle}>
            Log some expenses and set budget limits to see your progress.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section A: With limits */}
          {budgetProgress.length > 0 && (
            <>
              <Text style={s.sectionHeader}>With limits</Text>

              {budgetProgress.map((item) => (
                <TouchableOpacity
                  key={item.budget.id}
                  style={s.card}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('BudgetCategoryDetail', {
                      categoryId: item.category.id,
                      month: displayMonth,
                      year: displayYear,
                    })
                  }
                >
                  <View style={s.cardRow}>
                    <View style={s.iconPlaceholder} />
                    <View style={s.cardBody}>
                      <Text style={s.categoryName}>{item.category.name}</Text>
                      <BudgetProgressBar percent={item.percent} theme={theme} />
                      <View style={s.barFooter}>
                        <Text style={s.spentText}>
                          {formatCurrency(item.consumed)} spent
                        </Text>
                        {item.remaining >= 0 ? (
                          <Text style={s.remainingText}>
                            {formatCurrency(item.remaining)} left
                          </Text>
                        ) : (
                          <Text
                            style={[
                              s.remainingText,
                              { color: theme.colors.dangerMain },
                            ]}
                          >
                            -{formatCurrency(Math.abs(item.remaining))} over
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Section B: Without limits */}
          {unbudgetedCategories.length > 0 && (
            <>
              <Text style={s.sectionHeader}>Without limits</Text>

              {unbudgetedCategories.map((item) => (
                <View key={item.category.id} style={s.card}>
                  <View style={s.cardRow}>
                    <View style={s.iconPlaceholder} />
                    <View style={s.cardBody}>
                      <Text style={s.categoryName}>{item.category.name}</Text>
                      <Text style={s.spentText}>
                        {formatCurrency(item.amountSpent)} spent
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.setLimitBtn}
                      onPress={() => openSheet(item.category)}
                    >
                      <Text style={s.setLimitBtnText}>+ Set limit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={{ height: theme.spacing.huge }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => openSheet(null)}>
        <Text style={s.fabText}>Set Budget</Text>
      </TouchableOpacity>

      {/* SetBudgetLimitSheet */}
      <Modal
        visible={showSetLimitSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSetLimitSheet(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSetLimitSheet(false)}
            activeOpacity={1}
          />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Set Budget Limit</Text>

            {/* Category picker */}
            <Text style={s.sheetLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.chipScroll}
            >
              {allExpenseCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    s.chip,
                    selectedCategoryForLimit?.id === c.id && s.chipSelected,
                  ]}
                  onPress={() => setSelectedCategoryForLimit(c)}
                >
                  <Text
                    style={[
                      s.chipText,
                      selectedCategoryForLimit?.id === c.id && s.chipTextSelected,
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Amount input */}
            <Text style={s.sheetLabel}>Monthly limit</Text>
            <View style={s.amountRow}>
              <Text style={s.pesoPrefix}>₱</Text>
              <TextInput
                style={s.amountInput}
                value={sheetAmount}
                onChangeText={setSheetAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textDisabled}
              />
            </View>

            {/* Rollover toggle */}
            <View style={s.toggleRow}>
              <Text style={s.toggleLabel}>
                Carry unused budget to next month
              </Text>
              <Switch
                value={sheetRollover}
                onValueChange={setSheetRollover}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.accentMain,
                }}
                thumbColor={theme.colors.bgCard}
              />
            </View>

            {/* Buttons */}
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setShowSetLimitSheet(false)}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },

    // ── Screen header ───────────────────────────────────────────────────────
    screenHeader: {
      fontSize: theme.typography.fontSize.heading1,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.base,
      paddingBottom: theme.spacing.xs,
    },

    // ── Month selector ──────────────────────────────────────────────────────
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
    },
    arrowBtn: {
      padding: theme.spacing.sm,
    },
    arrowText: {
      fontSize: 28,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      lineHeight: 32,
    },
    monthText: {
      flex: 1,
      textAlign: 'center',
      fontSize: theme.typography.fontSize.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },

    // ── Summary bar ─────────────────────────────────────────────────────────
    summaryBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.bgCard,
      marginHorizontal: theme.spacing.base,
      borderRadius: theme.radius.large,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.sm,
      ...theme.shadows.card,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xs,
    },
    summaryDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    summaryPhrase: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: theme.typography.lineHeight.caption,
    },
    summaryAmount: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },

    // ── Loading / Empty ─────────────────────────────────────────────────────
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    mascotPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.bgInput,
      marginBottom: theme.spacing.base,
    },
    emptyTitle: {
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: theme.typography.lineHeight.body,
    },

    // ── Scroll ──────────────────────────────────────────────────────────────
    scroll: {
      flex: 1,
      marginTop: theme.spacing.base,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.base,
    },

    // ── Section header ──────────────────────────────────────────────────────
    sectionHeader: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.label,
      marginTop: theme.spacing.base,
      marginBottom: theme.spacing.sm,
    },

    // ── Budget card ─────────────────────────────────────────────────────────
    card: {
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.large,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.card,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    iconPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.bgInput,
      marginRight: theme.spacing.md,
      flexShrink: 0,
    },
    cardBody: {
      flex: 1,
    },
    categoryName: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    barFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.spacing.xs,
    },
    spentText: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },
    remainingText: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
    },

    // ── Set limit button (unbudgeted) ───────────────────────────────────────
    setLimitBtn: {
      borderWidth: 1,
      borderColor: theme.colors.accentMain,
      borderRadius: theme.radius.medium,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      alignSelf: 'center',
      marginLeft: theme.spacing.sm,
      backgroundColor: 'transparent',
    },
    setLimitBtnText: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.accentMain,
    },

    // ── FAB ─────────────────────────────────────────────────────────────────
    fab: {
      position: 'absolute',
      right: theme.spacing.base,
      bottom: theme.spacing.base,
      backgroundColor: theme.colors.brand,
      borderRadius: theme.radius.full,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      ...theme.shadows.modal,
    },
    fabText: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textInverse,
    },

    // ── Modal overlay ───────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },

    // ── Bottom sheet ────────────────────────────────────────────────────────
    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      padding: theme.spacing.xl,
      paddingBottom: theme.spacing.xxxl,
      ...theme.shadows.modal,
    },
    sheetTitle: {
      fontSize: theme.typography.fontSize.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.base,
    },
    sheetLabel: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    chipScroll: {
      marginBottom: theme.spacing.base,
    },
    chip: {
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      marginRight: theme.spacing.sm,
      backgroundColor: theme.colors.bgInput,
    },
    chipSelected: {
      backgroundColor: theme.colors.accentMain,
      borderColor: theme.colors.accentMain,
    },
    chipText: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
    },
    chipTextSelected: {
      color: theme.colors.textInverse,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.medium,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.base,
    },
    pesoPrefix: {
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
      marginRight: theme.spacing.xs,
    },
    amountInput: {
      flex: 1,
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textPrimary,
      paddingVertical: theme.spacing.md,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xl,
    },
    toggleLabel: {
      flex: 1,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textPrimary,
      marginRight: theme.spacing.base,
    },
    saveBtn: {
      backgroundColor: theme.colors.brand,
      borderRadius: theme.radius.medium,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    saveBtnText: {
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textInverse,
    },
    cancelBtn: {
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    cancelBtnText: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
    },
  });
}
