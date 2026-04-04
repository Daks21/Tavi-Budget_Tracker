// src/components/home/RecentTransactionsWidget.tsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, type Theme } from '@/theme';
import useTransactionStore from '@/store/useTransactionStore';
import useBudgetStore from '@/store/useBudgetStore';
import { formatCurrency } from '@/utils/formatCurrency';
import type { RootTabParamList } from '@/types/navigation';
import type { Transaction } from '@/db/schema';

type NavigationProp = NativeStackNavigationProp<RootTabParamList>;

// ─────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MON_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTransactionDate(dateStr: string): string {
  const today = todayStr();
  const yesterday = yesterdayStr();

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  // Parse 'YYYY-MM-DD' format: 'Jan 6'
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MON_NAMES[m - 1]} ${d}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AMOUNT & COLOR HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getAmountLabel(tx: Transaction): string {
  if (tx.type === 'income') return `+${formatCurrency(tx.amount)}`;
  if (tx.type === 'expense') return `-${formatCurrency(tx.amount)}`;
  return `↔${formatCurrency(tx.amount)}`;
}

function getAmountColor(tx: Transaction, theme: Theme): string {
  if (tx.type === 'income') return theme.colors.accentMain;
  if (tx.type === 'expense') return theme.colors.dangerMain;
  return theme.colors.textSecondary;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RecentTransactionsWidget() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { recentTransactions, isLoading, loadRecentTransactions } = useTransactionStore();
  const { categories } = useBudgetStore();

  // Load recent transactions on mount
  useEffect(() => {
    loadRecentTransactions(5);
  }, [loadRecentTransactions]);

  // Build category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  // Get first 5 transactions
  const displayTransactions = recentTransactions.slice(0, 5);

  // Get category name helper
  const getCategoryName = (categoryId: number | null): string => {
    if (categoryId === null) return 'Other';
    return categoryMap.get(categoryId) ?? 'Other';
  };

  // Handle "See all" link
  const handleSeeAll = () => {
    navigation.navigate('Log', {
      screen: 'TransactionHistory',
    });
  };

  // Handle transaction row tap
  const handleTransactionPress = (transactionId: number) => {
    navigation.navigate('Log', {
      screen: 'TransactionDetail',
      params: { transactionId },
    });
  };

  const makeStyles = (theme: Theme) =>
    StyleSheet.create({
      container: {
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.lg,
      },
      headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
      },
      header: {
        fontSize: theme.typography.fontSize.heading2,
        lineHeight: theme.typography.lineHeight.heading2,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.textPrimary,
      },
      seeAllLink: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.accentMain,
      },
      emptyText: {
        fontSize: theme.typography.fontSize.body,
        lineHeight: theme.typography.lineHeight.body,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
      },
      transactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      },
      iconPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.bgInput,
      },
      contentContainer: {
        flex: 1,
        justifyContent: 'center',
      },
      description: {
        fontSize: theme.typography.fontSize.body,
        lineHeight: theme.typography.lineHeight.body,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textPrimary,
      },
      categoryName: {
        fontSize: theme.typography.fontSize.caption,
        lineHeight: theme.typography.lineHeight.caption,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
        marginTop: 2,
      },
      rightContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
      },
      amount: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.semibold,
      },
      date: {
        fontSize: theme.typography.fontSize.caption,
        lineHeight: theme.typography.lineHeight.caption,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
        marginTop: 2,
      },
    });

  const dynamicStyles = useMemo(() => makeStyles(theme), [theme]);

  // Show loading state
  if (isLoading) {
    return (
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.headerContainer}>
          <Text style={dynamicStyles.header}>Recent</Text>
        </View>
        <ActivityIndicator color={theme.colors.accentMain} />
      </View>
    );
  }

  // Show empty state
  if (displayTransactions.length === 0) {
    return (
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.headerContainer}>
          <Text style={dynamicStyles.header}>Recent</Text>
        </View>
        <Text style={dynamicStyles.emptyText}>No transactions logged yet.</Text>
      </View>
    );
  }

  // Render transactions
  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.headerContainer}>
        <Text style={dynamicStyles.header}>Recent</Text>
        <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
          <Text style={dynamicStyles.seeAllLink}>See all</Text>
        </TouchableOpacity>
      </View>

      {displayTransactions.map((tx, idx) => {
        const isLastRow = idx === displayTransactions.length - 1;
        const amountLabel = getAmountLabel(tx);
        const amountColor = getAmountColor(tx, theme);
        const categoryName = getCategoryName(tx.category_id);
        const dateLabel = formatTransactionDate(tx.date);

        return (
          <TouchableOpacity
            key={`tx-${tx.id}`}
            onPress={() => handleTransactionPress(tx.id)}
            activeOpacity={0.7}
            style={[
              dynamicStyles.transactionRow,
              isLastRow && { borderBottomWidth: 0 },
            ]}
          >
            {/* Icon placeholder */}
            <View style={dynamicStyles.iconPlaceholder} />

            {/* Center content */}
            <View style={dynamicStyles.contentContainer}>
              <Text
                numberOfLines={1}
                style={dynamicStyles.description}
              >
                {tx.description ?? 'Transaction'}
              </Text>
              <Text style={dynamicStyles.categoryName}>{categoryName}</Text>
            </View>

            {/* Right side: amount and date */}
            <View style={dynamicStyles.rightContainer}>
              <Text style={[dynamicStyles.amount, { color: amountColor }]}>
                {amountLabel}
              </Text>
              <Text style={dynamicStyles.date}>{dateLabel}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
