import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MoreStackParamList } from '@/types/navigation';
import { useTheme } from '@/theme';
import {
  createFullBackup,
  shareBackupFile,
  exportTransactionsCSV,
  exportBalancesCSV,
  restoreFromBackup,
  type RestoreResult,
} from '@/utils/backup';
import useWalletStore from '@/store/useWalletStore';
import useTransactionStore from '@/store/useTransactionStore';
import useBudgetStore from '@/store/useBudgetStore';
import useObligationStore from '@/store/useObligationStore';
import db from '@/db';
import { accounts, transactions } from '@/db/schema';

type Props = NativeStackScreenProps<MoreStackParamList, 'BackupRestore'>;

interface BackupInfo {
  date: string;
  transactions: number;
  accounts: number;
}

export default function BackupRestoreScreen(_props: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  // Store hooks for reloading after restore
  const { loadAccounts } = useWalletStore();
  const { loadRecentTransactions } = useTransactionStore();
  const { getBudgetProgress } = useBudgetStore();
  const { loadObligations } = useObligationStore();

  // Local state
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [lastBackupCounts, setLastBackupCounts] = useState<{
    transactions: number;
    accounts: number;
  } | null>(null);
  const [exportDateStart, setExportDateStart] = useState('');
  const [exportDateEnd, setExportDateEnd] = useState('');
  const [restoreResult, setRestoreResult] = useState<
    { success: boolean; counts?: Record<string, number>; error?: string } | null
  >(null);

  // Initialize date range on mount (first day of month to today)
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = now;

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setExportDateStart(formatDate(firstDay));
    setExportDateEnd(formatDate(today));

    // Load last backup info
    loadLastBackupInfo();
  }, []);

  const loadLastBackupInfo = async () => {
    try {
      const stored = await AsyncStorage.getItem('tavi_last_backup');
      if (stored) {
        const info: BackupInfo = JSON.parse(stored);
        setLastBackupDate(info.date);
        setLastBackupCounts({ transactions: info.transactions, accounts: info.accounts });
      }
    } catch (error) {
      console.error('Error loading last backup info:', error);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const filePath = await createFullBackup();
      await shareBackupFile(filePath);

      // Get accurate counts from database
      const [accountsRows, transactionsRows] = await Promise.all([
        db.select().from(accounts),
        db.select().from(transactions),
      ]);

      // Save backup metadata
      const now = new Date();
      const dateStr = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const backupInfo: BackupInfo = {
        date: dateStr,
        transactions: transactionsRows.length,
        accounts: accountsRows.length,
      };

      await AsyncStorage.setItem('tavi_last_backup', JSON.stringify(backupInfo));
      await loadLastBackupInfo();
    } catch (error) {
      Alert.alert('Backup Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleExportTransactions = async () => {
    try {
      const filePath = await exportTransactionsCSV(exportDateStart, exportDateEnd);
      await shareBackupFile(filePath);
    } catch (error) {
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleExportBalances = async () => {
    try {
      const filePath = await exportBalancesCSV();
      await shareBackupFile(filePath);
    } catch (error) {
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleChooseBackupFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const filePath = result.assets[0].uri;

        // Show confirmation dialog
        Alert.alert(
          'Replace all current data with this backup?',
          'This will delete everything currently in Tavi and replace it with the backup file.',
          [
            {
              text: 'Cancel',
              onPress: () => {},
              style: 'cancel',
            },
            {
              text: 'Yes, Restore',
              onPress: () => performRestore(filePath),
              style: 'destructive',
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error picking file:', error);
    }
  };

  const performRestore = async (filePath: string) => {
    setIsRestoring(true);
    try {
      const result = await restoreFromBackup(filePath);
      setRestoreResult(result);

      if (result.success) {
        // Reload all stores
        await Promise.all([loadAccounts(), loadRecentTransactions(5), getBudgetProgress(new Date().getMonth() + 1, new Date().getFullYear()), loadObligations()]);
      }
    } catch (error) {
      setRestoreResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleGoToHome = () => {
    setRestoreResult(null);
    // Navigate to Home tab using parent navigator
    _props.navigation.getParent()?.navigate('Home');
  };

  // Render restore result
  if (restoreResult) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={styles.resultContent}>
            {restoreResult.success ? (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={80}
                  color={theme.colors.successMain}
                  style={styles.resultIcon}
                />
                <Text style={styles.resultTitle}>Restored successfully.</Text>
                {restoreResult.counts && (
                  <Text style={styles.resultDetail}>
                    {restoreResult.counts.accounts} accounts, {restoreResult.counts.transactions}{' '}
                    transactions, and {restoreResult.counts.obligations} obligations restored.
                  </Text>
                )}
              </>
            ) : (
              <>
                <Ionicons
                  name="alert-circle"
                  size={80}
                  color={theme.colors.dangerMain}
                  style={styles.resultIcon}
                />
                <Text style={styles.resultTitle}>Restore failed.</Text>
                {restoreResult.error && (
                  <Text style={styles.resultError}>{restoreResult.error}</Text>
                )}
                <Text style={styles.resultDetail}>
                  Your previous data was not affected.
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              restoreResult.success ? styles.buttonPrimary : styles.buttonSecondary,
            ]}
            onPress={restoreResult.success ? handleGoToHome : () => setRestoreResult(null)}
          >
            <Text
              style={[
                styles.buttonText,
                restoreResult.success ? styles.buttonTextPrimary : styles.buttonTextSecondary,
              ]}
            >
              {restoreResult.success ? 'Go to Tavi' : 'Try Again'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BACKUP SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Back up your data</Text>
          <Text style={styles.description}>
            Save a backup file to your device. You can then copy it to Google Drive, email it to
            yourself, or save it anywhere you like. Your data is encoded — only Tavi can read it
            back.
          </Text>

          <View style={styles.lastBackupInfo}>
            <Text style={styles.lastBackupText}>
              {lastBackupDate
                ? `Last backup: ${lastBackupDate}`
                : 'No backup created yet.'}
            </Text>
            {lastBackupCounts && (
              <Text style={styles.lastBackupCaption}>
                {lastBackupCounts.accounts} accounts, {lastBackupCounts.transactions} transactions
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonPrimary,
              isCreatingBackup && styles.buttonDisabled,
            ]}
            onPress={handleCreateBackup}
            disabled={isCreatingBackup}
          >
            {isCreatingBackup ? (
              <ActivityIndicator color={theme.colors.textInverse} />
            ) : (
              <Text style={styles.buttonTextPrimary}>Create Backup</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* EXPORT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export to CSV</Text>
          <Text style={styles.description}>
            Export your transactions as a spreadsheet you can open in Excel or Google Sheets.
          </Text>

          <View style={styles.dateRangeContainer}>
            <Text style={styles.dateLabel}>From: {exportDateStart}</Text>
            <Text style={styles.dateLabel}>To: {exportDateEnd}</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleExportTransactions}
          >
            <Text style={styles.buttonTextSecondary}>Export Transactions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleExportBalances}
          >
            <Text style={styles.buttonTextSecondary}>Export Balances</Text>
          </TouchableOpacity>
        </View>

        {/* RESTORE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restore from backup</Text>

          <View style={styles.warningCard}>
            <Ionicons
              name="warning"
              size={24}
              color={theme.colors.warningMain}
              style={styles.warningIcon}
            />
            <Text style={styles.warningText}>
              Restoring a backup will replace ALL your current data. This cannot be undone. Make
              sure you want to do this.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonDanger,
              isRestoring && styles.buttonDisabled,
            ]}
            onPress={handleChooseBackupFile}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color={theme.colors.dangerMain} />
            ) : (
              <Text style={styles.buttonTextDanger}>Choose Backup File</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },
    scrollContent: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing['3xl'],
    },
    section: {
      marginBottom: theme.spacing['2xl'],
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
      lineHeight: 20,
    },
    lastBackupInfo: {
      backgroundColor: theme.colors.bgCard,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    lastBackupText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    lastBackupCaption: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    dateRangeContainer: {
      backgroundColor: theme.colors.bgCard,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateLabel: {
      fontSize: 14,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    warningCard: {
      backgroundColor: theme.colors.warningSubtle,
      borderColor: theme.colors.warningMain,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    warningIcon: {
      marginRight: theme.spacing.md,
      marginTop: -2,
    },
    warningText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.textPrimary,
      lineHeight: 20,
    },
    button: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      minHeight: 48,
    },
    buttonPrimary: {
      backgroundColor: theme.colors.accentMain,
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonDanger: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.dangerMain,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextPrimary: {
      color: theme.colors.textInverse,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextSecondary: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextDanger: {
      color: theme.colors.dangerMain,
      fontSize: 16,
      fontWeight: '600',
    },
    resultContainer: {
      flex: 1,
      paddingVertical: theme.spacing['2xl'],
      paddingHorizontal: theme.spacing.md,
      justifyContent: 'space-between',
    },
    resultContent: {
      alignItems: 'center',
      marginVertical: theme.spacing['3xl'],
    },
    resultIcon: {
      marginBottom: theme.spacing.lg,
    },
    resultTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    resultDetail: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    resultError: {
      fontSize: 12,
      color: theme.colors.dangerMain,
      textAlign: 'center',
      marginVertical: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
  });
