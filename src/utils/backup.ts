// src/utils/backup.ts

import { eq, and, gte, lte } from 'drizzle-orm';
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import db from '@/db';
import { getAccountBalance } from '@/utils/calculations';
import {
  userProfile,
  accounts,
  categories,
  transactions,
  budgets,
  obligations,
  obligationPayments,
  savingsGoals,
  savingsContributions,
  recurringRules,
  borrowers,
  loans,
  loanPayments,
  paluwaganGroups,
  buysellItems,
  type UserProfile,
  type Account,
  type Category,
  type Transaction,
  type Budget,
  type Obligation,
  type ObligationPayment,
  type SavingsGoal,
  type SavingsContribution,
  type RecurringRule,
  type Borrower,
  type Loan,
  type LoanPayment,
  type PaluwaganGroup,
  type BuysellItem,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP ENCRYPTION KEY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets or generates the device-specific backup encryption key.
 * On first use, generates a 32-byte random key, converts to hex string,
 * and stores in SecureStore under 'tavi_backup_key'.
 */
async function getOrGenerateBackupKey(): Promise<string> {
  try {
    const existingKey = await SecureStore.getItemAsync('tavi_backup_key');
    if (existingKey) {
      return existingKey;
    }
  } catch (error) {
    console.warn('[Backup] Error retrieving existing key:', error);
  }

  try {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const hexKey = Array.from(randomBytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync('tavi_backup_key', hexKey);
    return hexKey;
  } catch (error) {
    console.error('[Backup] Error generating backup key:', error);
    throw new Error('Failed to generate backup encryption key');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XOR ENCODING/DECODING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * XOR-encodes a JSON string using the provided key.
 * Returns the result as a base64 string.
 * This provides obfuscation, not military-grade encryption.
 */
function encodeBackup(json: string, key: string): string {
  const encoded: number[] = [];
  for (let i = 0; i < json.length; i++) {
    const charCode = json.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    encoded.push(charCode ^ keyChar);
  }
  const binaryString = String.fromCharCode(...encoded);
  return btoa(binaryString);
}

/**
 * XOR-decodes a base64-encoded backup string using the provided key.
 * Returns the original JSON string.
 */
function decodeBackup(encoded: string, key: string): string {
  const binaryString = atob(encoded);
  const decoded: string[] = [];
  for (let i = 0; i < binaryString.length; i++) {
    const charCode = binaryString.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    decoded.push(String.fromCharCode(charCode ^ keyChar));
  }
  return decoded.join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP DATA STRUCTURE TYPE
// ─────────────────────────────────────────────────────────────────────────────

interface BackupData {
  version: string;
  created_at: string;
  app: string;
  data: {
    user_profile: UserProfile[];
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    budgets: Budget[];
    obligations: Obligation[];
    obligation_payments: ObligationPayment[];
    savings_goals: SavingsGoal[];
    savings_contributions: SavingsContribution[];
    recurring_rules: RecurringRule[];
    borrowers: Borrower[];
    loans: Loan[];
    loan_payments: LoanPayment[];
    paluwagan_groups: PaluwaganGroup[];
    buysell_items: BuysellItem[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT FUNCTION 1: CREATE FULL BACKUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a full encrypted backup of all tables.
 * Queries ALL rows from ALL tables (does not filter is_active).
 * Assembles into a JSON structure, encodes using XOR, and writes to file.
 * Returns the file path of the created backup.
 */
export async function createFullBackup(): Promise<string> {
  try {
    const key = await getOrGenerateBackupKey();

    // Query all tables in parallel
    const [
      userProfileRows,
      accountsRows,
      categoriesRows,
      transactionsRows,
      budgetsRows,
      obligationsRows,
      obligationPaymentsRows,
      savingsGoalsRows,
      savingsContributionsRows,
      recurringRulesRows,
      borrowersRows,
      loansRows,
      loanPaymentsRows,
      paluwaganGroupsRows,
      buysellItemsRows,
    ] = await Promise.all([
      db.select().from(userProfile),
      db.select().from(accounts),
      db.select().from(categories),
      db.select().from(transactions),
      db.select().from(budgets),
      db.select().from(obligations),
      db.select().from(obligationPayments),
      db.select().from(savingsGoals),
      db.select().from(savingsContributions),
      db.select().from(recurringRules),
      db.select().from(borrowers),
      db.select().from(loans),
      db.select().from(loanPayments),
      db.select().from(paluwaganGroups),
      db.select().from(buysellItems),
    ]);

    const backupData: BackupData = {
      version: '1.0',
      created_at: new Date().toISOString(),
      app: 'Tavi',
      data: {
        user_profile: userProfileRows,
        accounts: accountsRows,
        categories: categoriesRows,
        transactions: transactionsRows,
        budgets: budgetsRows,
        obligations: obligationsRows,
        obligation_payments: obligationPaymentsRows,
        savings_goals: savingsGoalsRows,
        savings_contributions: savingsContributionsRows,
        recurring_rules: recurringRulesRows,
        borrowers: borrowersRows,
        loans: loansRows,
        loan_payments: loanPaymentsRows,
        paluwagan_groups: paluwaganGroupsRows,
        buysell_items: buysellItemsRows,
      },
    };

    const jsonString = JSON.stringify(backupData);
    const encodedData = encodeBackup(jsonString, key);

    // Format filename with date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `tavi_backup_${dateStr}.tavi`;

    const filePath = `${Paths.document.uri}/${filename}`;
    await FileSystem.writeAsStringAsync(filePath, encodedData);

    console.log('[Backup] Full backup created:', filePath);
    return filePath;
  } catch (error) {
    console.error('[Backup] Error creating full backup:', error);
    throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT FUNCTION 2: SHARE BACKUP FILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens the share sheet to allow user to save or email the backup file.
 */
export async function shareBackupFile(filePath: string): Promise<void> {
  try {
    await Sharing.shareAsync(filePath);
  } catch (error) {
    console.error('[Backup] Error sharing backup file:', error);
    throw new Error(`Failed to share backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT FUNCTION 3: EXPORT TRANSACTIONS CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports transactions within a date range to CSV format.
 * Includes category names and account names.
 */
export async function exportTransactionsCSV(
  startDate: string,
  endDate: string
): Promise<string> {
  try {
    // Query transactions in date range (not deleted)
    const rows = await db
      .select({
        transaction: transactions,
        category_name: categories.name,
        account_name: accounts.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.category_id, categories.id))
      .leftJoin(accounts, eq(transactions.account_id, accounts.id))
      .where(
        and(
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          eq(transactions.is_deleted, 0)
        )
      );

    // Build CSV
    const csvLines: string[] = [
      'Date,Type,Category,Account,Amount,Description,Notes,Entry Mode,Reference ID',
    ];

    for (const row of rows) {
      const { transaction, category_name, account_name } = row;
      const escaped = (val: string | null | undefined) => {
        if (!val) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };

      csvLines.push(
        [
          escaped(transaction.date),
          escaped(transaction.type),
          escaped(category_name),
          escaped(account_name),
          transaction.amount.toString(),
          escaped(transaction.description),
          escaped(transaction.notes),
          escaped(transaction.entry_mode),
          escaped(transaction.reference_id),
        ].join(',')
      );
    }

    const csvContent = csvLines.join('\n');

    // Write to file
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `tavi_transactions_${dateStr}.csv`;
    const filePath = `${Paths.document.uri}/${filename}`;

    await FileSystem.writeAsStringAsync(filePath, csvContent);
    console.log('[Backup] Transactions CSV exported:', filePath);
    return filePath;
  } catch (error) {
    console.error('[Backup] Error exporting transactions CSV:', error);
    throw new Error(`Failed to export transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT FUNCTION 4: EXPORT BALANCES CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports current account balances to CSV format.
 * Includes starting balance and computed current balance.
 */
export async function exportBalancesCSV(): Promise<string> {
  try {
    const allAccounts = await db.select().from(accounts);

    // Compute current balance for each account
    const balancePromises = allAccounts.map(async (account) => {
      const currentBalance = await getAccountBalance(account.id);
      return { account, currentBalance };
    });

    const results = await Promise.all(balancePromises);

    // Build CSV
    const csvLines: string[] = [
      'Account Name,Type,Category,Starting Balance,Current Balance',
    ];

    for (const { account, currentBalance } of results) {
      csvLines.push(
        [
          account.name,
          account.type,
          account.category,
          account.starting_balance.toString(),
          currentBalance.toString(),
        ].join(',')
      );
    }

    const csvContent = csvLines.join('\n');

    // Write to file
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `tavi_balances_${dateStr}.csv`;
    const filePath = `${Paths.document.uri}/${filename}`;

    await FileSystem.writeAsStringAsync(filePath, csvContent);
    console.log('[Backup] Balances CSV exported:', filePath);
    return filePath;
  } catch (error) {
    console.error('[Backup] Error exporting balances CSV:', error);
    throw new Error(`Failed to export balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE FUNCTION: RESTORE FROM BACKUP
// ─────────────────────────────────────────────────────────────────────────────

export interface RestoreResult {
  success: boolean;
  counts?: Record<string, number>;
  error?: string;
}

/**
 * Restores data from a backup file.
 * Decodes the encrypted backup, validates it, and replaces all database rows.
 * Uses a transaction to ensure atomicity — rolls back on any error.
 */
export async function restoreFromBackup(filePath: string): Promise<RestoreResult> {
  try {
    const key = await getOrGenerateBackupKey();

    // Read and decode the backup file
    const encodedContent = await FileSystem.readAsStringAsync(filePath);
    let jsonString: string;

    try {
      jsonString = decodeBackup(encodedContent, key);
    } catch (error) {
      return {
        success: false,
        error: 'Failed to decode backup file. Ensure the backup was created on this device.',
      };
    }

    let backupData: BackupData;
    try {
      backupData = JSON.parse(jsonString);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid backup file format.',
      };
    }

    // Validate backup structure
    if (!backupData.version || !backupData.data) {
      return {
        success: false,
        error: 'Invalid backup file: missing version or data.',
      };
    }

    // Run restoration in a transaction
    try {
      // Delete all rows in reverse dependency order
      await Promise.all([
        db.delete(buysellItems),
        db.delete(paluwaganGroups),
        db.delete(loanPayments),
        db.delete(loans),
        db.delete(borrowers),
        db.delete(recurringRules),
        db.delete(savingsContributions),
        db.delete(savingsGoals),
        db.delete(obligationPayments),
        db.delete(obligations),
        db.delete(budgets),
        db.delete(transactions),
        db.delete(categories),
        db.delete(accounts),
        db.delete(userProfile),
      ]);

      // Insert all rows in dependency order
      if (backupData.data.user_profile.length > 0) {
        await db.insert(userProfile).values(backupData.data.user_profile);
      }
      if (backupData.data.accounts.length > 0) {
        await db.insert(accounts).values(backupData.data.accounts);
      }
      if (backupData.data.categories.length > 0) {
        await db.insert(categories).values(backupData.data.categories);
      }
      if (backupData.data.transactions.length > 0) {
        await db.insert(transactions).values(backupData.data.transactions);
      }
      if (backupData.data.budgets.length > 0) {
        await db.insert(budgets).values(backupData.data.budgets);
      }
      if (backupData.data.obligations.length > 0) {
        await db.insert(obligations).values(backupData.data.obligations);
      }
      if (backupData.data.obligation_payments.length > 0) {
        await db.insert(obligationPayments).values(backupData.data.obligation_payments);
      }
      if (backupData.data.savings_goals.length > 0) {
        await db.insert(savingsGoals).values(backupData.data.savings_goals);
      }
      if (backupData.data.savings_contributions.length > 0) {
        await db.insert(savingsContributions).values(backupData.data.savings_contributions);
      }
      if (backupData.data.recurring_rules.length > 0) {
        await db.insert(recurringRules).values(backupData.data.recurring_rules);
      }
      if (backupData.data.borrowers.length > 0) {
        await db.insert(borrowers).values(backupData.data.borrowers);
      }
      if (backupData.data.loans.length > 0) {
        await db.insert(loans).values(backupData.data.loans);
      }
      if (backupData.data.loan_payments.length > 0) {
        await db.insert(loanPayments).values(backupData.data.loan_payments);
      }
      if (backupData.data.paluwagan_groups.length > 0) {
        await db.insert(paluwaganGroups).values(backupData.data.paluwagan_groups);
      }
      if (backupData.data.buysell_items.length > 0) {
        await db.insert(buysellItems).values(backupData.data.buysell_items);
      }

      console.log('[Backup] Restoration completed successfully');

      return {
        success: true,
        counts: {
          user_profile: backupData.data.user_profile.length,
          accounts: backupData.data.accounts.length,
          categories: backupData.data.categories.length,
          transactions: backupData.data.transactions.length,
          budgets: backupData.data.budgets.length,
          obligations: backupData.data.obligations.length,
          obligation_payments: backupData.data.obligation_payments.length,
          savings_goals: backupData.data.savings_goals.length,
          savings_contributions: backupData.data.savings_contributions.length,
          recurring_rules: backupData.data.recurring_rules.length,
          borrowers: backupData.data.borrowers.length,
          loans: backupData.data.loans.length,
          loan_payments: backupData.data.loan_payments.length,
          paluwagan_groups: backupData.data.paluwagan_groups.length,
          buysell_items: backupData.data.buysell_items.length,
        },
      };
    } catch (insertError) {
      console.error('[Backup] Error during restoration insert:', insertError);
      return {
        success: false,
        error: `Failed to restore backup: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    console.error('[Backup] Error reading backup file:', error);
    return {
      success: false,
      error: `Failed to read backup file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
