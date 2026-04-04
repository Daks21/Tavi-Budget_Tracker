// src/components/log/DayDetailSheet.tsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { inArray } from 'drizzle-orm';

import { useTheme, type Theme } from '@/theme';
import { formatCurrency } from '@/utils/formatCurrency';
import useTransactionStore from '@/store/useTransactionStore';
import type { Transaction, Category } from '@/db/schema';
import db from '@/db';
import { categories } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MON_NAMES[date.getMonth()];
  return `${dayName}, ${monthName} ${d}`;
}

function amountLabel(tx: Transaction): string {
  if (tx.type === 'income') return `+${formatCurrency(tx.amount)}`;
  if (tx.type === 'expense') return `-${formatCurrency(tx.amount)}`;
  return `→${formatCurrency(tx.amount)}`;
}

function amountColor(tx: Transaction, theme: Theme): string {
  if (tx.type === 'income') return theme.colors.accentMain;
  if (tx.type === 'expense') return theme.colors.dangerMain;
  return theme.colors.textSecondary;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  theme,
  categoryName,
}: {
  tx: Transaction;
  theme: Theme;
  categoryName: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.md,
        backgroundColor: theme.colors.bgCard,
        gap: theme.spacing.md,
      }}
    >
      {/* Icon */}
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
          name={
            tx.type === 'income'
              ? 'arrow-down-circle-outline'
              : tx.type === 'transfer'
              ? 'swap-horizontal-outline'
              : 'arrow-up-circle-outline'
          }
          size={20}
          color={theme.colors.accentMain}
        />
      </View>

      {/* Center */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.medium,
            lineHeight: theme.typography.lineHeight.body,
            flexShrink: 1,
          }}
        >
          {tx.description ?? tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.caption,
            fontFamily: theme.typography.fontFamily.regular,
            lineHeight: theme.typography.lineHeight.caption,
          }}
        >
          {categoryName}
        </Text>
      </View>

      {/* Amount */}
      <Text
        style={{
          color: amountColor(tx, theme),
          fontSize: theme.typography.fontSize.body,
          fontFamily: theme.typography.fontFamily.semibold,
          lineHeight: theme.typography.lineHeight.body,
        }}
      >
        {amountLabel(tx)}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAY DETAIL SHEET
// ─────────────────────────────────────────────────────────────────────────────

interface DayDetailSheetProps {
  visible: boolean;
  selectedDate: string | null;
  onClose: () => void;
}

export default function DayDetailSheet({
  visible,
  selectedDate,
  onClose,
}: DayDetailSheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { height } = useWindowDimensions();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Load transactions when date changes
  useEffect(() => {
    if (!selectedDate || !visible) {
      return;
    }

    setIsLoading(true);
    useTransactionStore
      .getState()
      .getTransactionsByDate(selectedDate)
      .then((txs) => {
        setTransactions(txs);

        // Load category names
        const catIds = [
          ...new Set(
            txs
              .map((tx) => tx.category_id)
              .filter((id): id is number => id != null),
          ),
        ];

        if (catIds.length === 0) {
          setCategoryMap({});
          setIsLoading(false);
          return;
        }

        return db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, catIds))
          .then((rows) => {
            const map: Record<number, string> = {};
            for (const row of rows) {
              map[row.id] = row.name;
            }
            setCategoryMap(map);
          });
      })
      .catch(() => {
        setTransactions([]);
        setCategoryMap({});
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedDate, visible]);

  // Calculate totals
  const { totalIncome, totalExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of transactions) {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
      }
    }

    return { totalIncome: income, totalExpense: expense };
  }, [transactions]);

  const dateHeaderText = selectedDate ? formatDateHeader(selectedDate) : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheet,
            { maxHeight: height * 0.9 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{dateHeaderText}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-outline"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accentMain} />
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={theme.colors.textDisabled}
              />
              <Text style={styles.emptyText}>No transactions on this day.</Text>
            </View>
          ) : (
            <>
              {/* Transaction list */}
              <FlatList
                scrollEnabled
                data={transactions}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TransactionRow
                    tx={item}
                    theme={theme}
                    categoryName={
                      item.category_id != null
                        ? (categoryMap[item.category_id] ?? item.type)
                        : item.type
                    }
                  />
                )}
              />

              {/* Daily totals */}
              <View style={styles.dailyTotals}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Income:</Text>
                  <Text style={styles.incomeAmount}>
                    +{formatCurrency(totalIncome)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Expenses:</Text>
                  <Text style={styles.expenseAmount}>
                    -{formatCurrency(totalExpense)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'flex-end',
    },

    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      paddingTop: theme.spacing.base,
      ...theme.shadows.modal,
    },

    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },

    sheetTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
    },

    loadingContainer: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyContainer: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
    },

    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: 'center',
    },

    dailyTotals: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.bgPage,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },

    totalLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
    },

    incomeAmount: {
      color: theme.colors.accentMain,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
    },

    expenseAmount: {
      color: theme.colors.dangerMain,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
    },
  });
}
