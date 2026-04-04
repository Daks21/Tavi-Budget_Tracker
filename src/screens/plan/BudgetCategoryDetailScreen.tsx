// src/screens/plan/BudgetCategoryDetailScreen.tsx

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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { and, desc, eq, like } from 'drizzle-orm';

import type { PlanStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useBudgetStore from '@/store/useBudgetStore';
import { formatCurrency } from '@/utils/formatCurrency';
import db from '@/db';
import { budgets, categories, transactions, type Transaction } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<PlanStackParamList, 'BudgetCategoryDetail'>;

type Section = {
  title: string;
  data: Transaction[];
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function monthPrefix(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-%`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(dateStr: string): string {
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${MON_NAMES[date.getMonth()]} ${d}`;
}

function groupByDate(txs: Transaction[]): Section[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const existing = map.get(tx.date);
    if (existing) {
      existing.push(tx);
    } else {
      map.set(tx.date, [tx]);
    }
  }
  return Array.from(map.entries()).map(([date, data]) => ({
    title: formatDateHeader(date),
    data,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR (height 16)
// ─────────────────────────────────────────────────────────────────────────────

function DetailProgressBar({
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
        height: 16,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
      }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={{
          height: 16,
          borderRadius: theme.radius.full,
          backgroundColor: fillColor,
          width: animWidth,
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION ROW
// ─────────────────────────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  theme,
  onPress,
}: {
  tx: Transaction;
  theme: Theme;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.md,
        backgroundColor: theme.colors.bgCard,
        gap: theme.spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.medium,
          backgroundColor: theme.colors.accentSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name="arrow-up-circle-outline"
          size={20}
          color={theme.colors.accentMain}
        />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.medium,
            lineHeight: theme.typography.lineHeight.body,
          }}
        >
          {tx.description ?? 'Expense'}
        </Text>
        {tx.notes ? (
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.caption,
              fontFamily: theme.typography.fontFamily.regular,
              lineHeight: theme.typography.lineHeight.caption,
            }}
          >
            {tx.notes}
          </Text>
        ) : null}
      </View>

      <Text
        style={{
          color: theme.colors.dangerMain,
          fontSize: theme.typography.fontSize.body,
          fontFamily: theme.typography.fontFamily.semibold,
          lineHeight: theme.typography.lineHeight.body,
        }}
      >
        -{formatCurrency(tx.amount)}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

function DateSectionHeader({ title, theme }: { title: string; theme: Theme }) {
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.base,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xs,
        backgroundColor: theme.colors.bgPage,
      }}
    >
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.caption,
          fontFamily: theme.typography.fontFamily.medium,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.label,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetCategoryDetailScreen({ route, navigation }: Props) {
  const { categoryId, month, year } = route.params;
  const theme = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);

  const setBudgetLimitAction = useBudgetStore((st) => st.setBudgetLimit);
  const removeBudgetLimitAction = useBudgetStore((st) => st.removeBudgetLimit);

  // ── Local state ─────────────────────────────────────────────────────────────

  const [categoryName, setCategoryName] = useState('');
  const [limitAmount, setLimitAmount] = useState(0);
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [consumed, setConsumed] = useState(0);
  const [hasBudget, setHasBudget] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);

  // Sheet state
  const [showSheet, setShowSheet] = useState(false);
  const [sheetAmount, setSheetAmount] = useState('');
  const [sheetRollover, setSheetRollover] = useState(false);

  // ── Sheet open (ref so headerRight never captures stale state) ──────────────

  const openSheetRef = useRef<() => void>(() => {});
  openSheetRef.current = () => {
    setSheetAmount(limitAmount > 0 ? String(limitAmount) : '');
    setSheetRollover(rolloverEnabled);
    setShowSheet(true);
  };

  // ── Navigation: header title + edit button ──────────────────────────────────

  useEffect(() => {
    navigation.setOptions({
      title: categoryName || 'Budget',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => openSheetRef.current()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginRight: 4 }}
        >
          <Ionicons name="pencil-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      ),
    });
  }, [categoryName, navigation]);

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Category name
      const catRows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.id, categoryId));
      setCategoryName(catRows[0]?.name ?? '');

      // Budget row for this category/month/year
      const budgetRows = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.category_id, categoryId),
            eq(budgets.month, month),
            eq(budgets.year, year),
          ),
        );
      const budget = budgetRows[0];
      if (budget) {
        setHasBudget(true);
        setLimitAmount(budget.limit_amount);
        setRolloverEnabled(budget.rollover_enabled === 1);
      } else {
        setHasBudget(false);
        setLimitAmount(0);
        setRolloverEnabled(false);
      }

      // Expense transactions for this category this month
      const txRows = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.category_id, categoryId),
            eq(transactions.type, 'expense'),
            eq(transactions.is_deleted, 0),
            like(transactions.date, monthPrefix(month, year)),
          ),
        )
        .orderBy(desc(transactions.date));

      // Consumed = sum of all those transactions
      const total = txRows.reduce((sum, tx) => sum + tx.amount, 0);
      setConsumed(total);

      // Group by date for display
      setSections(groupByDate(txRows));
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const percent =
    hasBudget && limitAmount > 0
      ? Math.min((consumed / limitAmount) * 100, 999)
      : 0;

  const statusInfo = useMemo(() => {
    if (percent >= 100) {
      const over = consumed - limitAmount;
      return {
        message: `Limit reached — ${formatCurrency(over)} over budget.`,
        color: theme.colors.dangerMain,
      };
    }
    if (percent >= 70) {
      return {
        message: 'Getting close to your limit.',
        color: theme.colors.warningMain,
      };
    }
    return {
      message: "You're on track.",
      color: theme.colors.accentMain,
    };
  }, [percent, consumed, limitAmount, theme]);

  // ── Sheet save ──────────────────────────────────────────────────────────────

  async function handleSave() {
    const amount = parseFloat(sheetAmount.replace(/,/g, ''));
    if (!amount || isNaN(amount) || amount <= 0) return;
    await setBudgetLimitAction(categoryId, amount, month, year, sheetRollover);
    setShowSheet(false);
    loadData();
  }

  // ── Remove limit ────────────────────────────────────────────────────────────

  function handleRemove() {
    Alert.alert(
      'Remove limit',
      `Remove the limit for ${categoryName}? Your spending history will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setShowSheet(false);
            await removeBudgetLimitAction(categoryId, month, year);
            navigation.navigate('BudgetOverview');
          },
        },
      ],
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.loadingContainer}>
          <ActivityIndicator color={theme.colors.accentMain} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status card ── */}
        {hasBudget && (
          <View style={s.statusCard}>
            <DetailProgressBar percent={percent} theme={theme} />

            <View style={s.statusMeta}>
              <Text style={s.statusSpent}>
                {formatCurrency(consumed)} of {formatCurrency(limitAmount)} spent
              </Text>
              <Text style={s.statusPercent}>{Math.round(percent)}% used</Text>
            </View>

            <Text style={[s.statusMessage, { color: statusInfo.color }]}>
              {statusInfo.message}
            </Text>
          </View>
        )}

        {/* ── Transactions section ── */}
        <Text style={s.sectionLabel}>Transactions this month</Text>

        {sections.length === 0 ? (
          <View style={s.emptyTx}>
            <Ionicons
              name="receipt-outline"
              size={36}
              color={theme.colors.textDisabled}
            />
            <Text style={s.emptyTxText}>No expenses logged this month.</Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.title} style={s.sectionGroup}>
              <DateSectionHeader title={section.title} theme={theme} />
              {section.data.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  theme={theme}
                  onPress={() => {}}
                />
              ))}
            </View>
          ))
        )}

        <View style={{ height: theme.spacing.huge }} />
      </ScrollView>

      {/* ── SetBudgetLimitSheet ── */}
      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSheet(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSheet(false)}
            activeOpacity={1}
          />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Edit Budget Limit</Text>

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

            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setShowSheet(false)}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            {hasBudget && (
              <TouchableOpacity style={s.removeBtn} onPress={handleRemove}>
                <Text style={s.removeBtnText}>Remove budget limit</Text>
              </TouchableOpacity>
            )}
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

    // ── Loading ─────────────────────────────────────────────────────────────
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Scroll ──────────────────────────────────────────────────────────────
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: theme.spacing.base,
    },

    // ── Status card ─────────────────────────────────────────────────────────
    statusCard: {
      backgroundColor: theme.colors.bgCard,
      marginHorizontal: theme.spacing.base,
      borderRadius: theme.radius.large,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.base,
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    statusMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    statusSpent: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },
    statusPercent: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    statusMessage: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
    },

    // ── Section label ────────────────────────────────────────────────────────
    sectionLabel: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.label,
      paddingHorizontal: theme.spacing.base,
      marginBottom: theme.spacing.xs,
    },

    // ── Transaction group ────────────────────────────────────────────────────
    sectionGroup: {
      backgroundColor: theme.colors.bgCard,
      marginHorizontal: theme.spacing.base,
      borderRadius: theme.radius.large,
      overflow: 'hidden',
      marginBottom: theme.spacing.sm,
      ...theme.shadows.card,
    },

    // ── Empty transactions ───────────────────────────────────────────────────
    emptyTx: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyTxText: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },

    // ── Modal overlay ────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },

    // ── Bottom sheet ─────────────────────────────────────────────────────────
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
    removeBtn: {
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    removeBtnText: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.dangerMain,
    },
  });
}
