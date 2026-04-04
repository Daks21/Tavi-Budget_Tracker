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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq } from 'drizzle-orm';

import type { RootTabParamList } from '@/types/navigation';
import { useTheme } from '@/theme';
import useWalletStore from '@/store/useWalletStore';
import useTransactionStore from '@/store/useTransactionStore';
import useBudgetStore from '@/store/useBudgetStore';
import useObligationStore from '@/store/useObligationStore';
import db from '@/db';
import { transactions } from '@/db/schema';

import HomeHeader from '@/components/home/HomeHeader';
import QuickActionsBar from '@/components/home/QuickActionsBar';
import BackupPromptBanner from '@/components/home/BackupPromptBanner';
import UpcomingObligationsWidget from '@/components/home/UpcomingObligationsWidget';
import BudgetHealthWidget from '@/components/home/BudgetHealthWidget';
import RecentTransactionsWidget from '@/components/home/RecentTransactionsWidget';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;
type NavigationProp = NativeStackNavigationProp<any>;

const BACKUP_PROMPT_DISMISSED_KEY = 'tavi_backup_prompt_dismissed';
const BACKUP_PROMPT_DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LAST_BACKUP_DATE_KEY = 'tavi_last_backup';

export default function HomeScreen(_props: Props) {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // Store hooks
  const { loadAccounts } = useWalletStore();
  const { loadRecentTransactions, recentTransactions, allTransactions } = useTransactionStore();
  const { getBudgetProgress } = useBudgetStore();
  const { loadObligations, upcomingPayments } = useObligationStore();

  // Local state
  const [isLoading, setIsLoading] = useState(true);
  const [budgetProgress, setBudgetProgress] = useState<any[]>([]);
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);

  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Helper: Check if backup prompt should be shown
  const checkBackupPromptVisibility = useCallback(async (count: number) => {
    try {
      // Check if prompt was recently dismissed
      const dismissedTimestamp = await AsyncStorage.getItem(BACKUP_PROMPT_DISMISSED_KEY);
      if (dismissedTimestamp) {
        const dismissedTime = parseInt(dismissedTimestamp, 10);
        const now = Date.now();
        if (now - dismissedTime < BACKUP_PROMPT_DISMISSAL_DURATION_MS) {
          setShowBackupPrompt(false);
          return;
        }
      }

      // Check if a backup exists
      const lastBackupDate = await AsyncStorage.getItem(LAST_BACKUP_DATE_KEY);
      if (lastBackupDate) {
        setShowBackupPrompt(false);
        return;
      }

      // Show prompt if transaction count >= 10
      if (count >= 10) {
        setShowBackupPrompt(true);
      } else {
        setShowBackupPrompt(false);
      }
    } catch (error) {
      console.error('Error checking backup prompt visibility:', error);
      setShowBackupPrompt(false);
    }
  }, []);

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

      // Get total transaction count from database
      const txnRows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.is_deleted, 0));
      const count = txnRows.length;
      setTransactionCount(count);
      await checkBackupPromptVisibility(count);
    } catch (error) {
      console.error('Error loading home screen data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAccounts, loadRecentTransactions, getBudgetProgress, loadObligations, currentMonth, currentYear, checkBackupPromptVisibility]);

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

  // Handle backup prompt actions
  const handleBackUpNow = useCallback(() => {
    navigation.navigate('More', { screen: 'BackupRestore' });
  }, [navigation]);

  const handleDismissBackupPrompt = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        BACKUP_PROMPT_DISMISSED_KEY,
        Date.now().toString()
      );
      setShowBackupPrompt(false);
    } catch (error) {
      console.error('Error dismissing backup prompt:', error);
    }
  }, []);

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

          {/* Backup Prompt Banner — shown when conditions are met */}
          <BackupPromptBanner
            visible={showBackupPrompt}
            onBackUpNow={handleBackUpNow}
            onDismiss={handleDismissBackupPrompt}
          />

          {/* First-launch empty state — only shown if no obligations, budgets, or transactions */}
          {isFirstLaunch ? (
            <View style={dynamicStyles.emptyStateContainer}>
              <Text style={dynamicStyles.emptyStateText}>
                Welcome to Tavi.
              </Text>
              <Text style={dynamicStyles.emptyStateText}>
                Start by logging your first expense or setting a budget.
              </Text>
              <QuickActionsBar />
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