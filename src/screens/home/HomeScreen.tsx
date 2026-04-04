// src/screens/home/HomeScreen.tsx

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import type { RootTabParamList } from '@/types/navigation';
import { useTheme } from '@/theme';
import useWalletStore from '@/store/useWalletStore';
import useTransactionStore from '@/store/useTransactionStore';
import useBudgetStore from '@/store/useBudgetStore';
import useObligationStore from '@/store/useObligationStore';

import HomeHeader from '@/components/home/HomeHeader';
import QuickActionsBar from '@/components/home/QuickActionsBar';
import UpcomingObligationsWidget from '@/components/home/UpcomingObligationsWidget';
import BudgetHealthWidget from '@/components/home/BudgetHealthWidget';
import RecentTransactionsWidget from '@/components/home/RecentTransactionsWidget';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

export default function HomeScreen(_props: Props) {
  const theme = useTheme();

  // Store hooks
  const { loadAccounts } = useWalletStore();
  const { loadRecentTransactions, recentTransactions } = useTransactionStore();
  const { getBudgetProgress } = useBudgetStore();
  const { loadObligations, upcomingPayments } = useObligationStore();

  // Local state
  const [isLoading, setIsLoading] = useState(true);
  const [budgetProgress, setBudgetProgress] = useState<any[]>([]);

  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Load all data in parallel
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [, , budgets] = await Promise.all([
        loadAccounts(),
        loadRecentTransactions(5),
        getBudgetProgress(currentMonth, currentYear),
        loadObligations(),
      ]);
      setBudgetProgress(budgets);
    } catch (error) {
      console.error('Error loading home screen data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAccounts, loadRecentTransactions, getBudgetProgress, loadObligations, currentMonth, currentYear]);

  // Load on mount
  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  // Determine visibility
  const hasObligations = upcomingPayments.length > 0;
  const hasBudgets = budgetProgress.some((bp: any) => bp.budget?.limit != null && bp.budget.limit > 0);
  const hasTransactions = recentTransactions.length > 0;
  const isFirstLaunch = !hasObligations && !hasBudgets && !hasTransactions;

  // Make styles
  const makeStyles = (theme: any) =>
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.colors.bgPage,
      },
      innerContainer: {
        flex: 1,
        flexDirection: 'column',
      },
      scrollView: {
        flex: 1,
      },
      contentContainer: {
        paddingBottom: theme.spacing['5xl'],
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: theme.spacing.xl,
      },
      emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: theme.spacing['3xl'],
      },
      emptyStateText: {
        fontSize: theme.typography.fontSize.body,
        lineHeight: theme.typography.lineHeight.body,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.lg,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.lg,
      },
    });

  const dynamicStyles = React.useMemo(() => makeStyles(theme), [theme]);

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView
        style={dynamicStyles.container}
        edges={['right', 'left', 'bottom']}
      >
        <HomeHeader />
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.accentMain} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={dynamicStyles.container}
      edges={['right', 'left', 'bottom']}
    >
      <View style={dynamicStyles.innerContainer}>
        {/* Header with balance — outside ScrollView */}
        <HomeHeader />

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={dynamicStyles.scrollView}
          contentContainerStyle={dynamicStyles.contentContainer}
        >
          {/* Quick Actions Bar — always shown */}
          <QuickActionsBar />

          {/* First-launch empty state — only shown if no obligations, budgets, or transactions */}
          {isFirstLaunch ? (
            <View style={dynamicStyles.emptyStateContainer}>
              <Text style={dynamicStyles.emptyStateText}>
                Welcome to Tavi.
              </Text>
              <Text style={dynamicStyles.emptyStateText}>
                Start by logging your first expense or setting a budget.
              </Text>
            </View>
          ) : (
            <>
              {/* Upcoming Obligations Widget — hidden if no obligations */}
              {hasObligations && <UpcomingObligationsWidget />}

              {/* Budget Health Widget — hidden if no budgets with limits */}
              {hasBudgets && <BudgetHealthWidget />}

              {/* Recent Transactions Widget — always shown */}
              <RecentTransactionsWidget />
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});