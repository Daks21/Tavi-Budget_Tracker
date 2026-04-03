// src/utils/calculations.ts

import { and, eq, isNotNull, isNull, like, or, sum } from 'drizzle-orm';

import db from '@/db';
import { accounts, transactions, type Account } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER — parse Drizzle sum() result
//
// Drizzle's sum() returns string | null (SQLite aggregate behaviour).
// All public functions return number — this helper centralises the cast.
// ─────────────────────────────────────────────────────────────────────────────
function toNumber(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER — format date prefix for LIKE queries
//
// Returns 'YYYY-MM-%' from a 1-based month and full year.
// month: 1–12   year: e.g. 2025
// ─────────────────────────────────────────────────────────────────────────────
function monthPrefix(month: number, year: number): string {
  const mm = String(month).padStart(2, '0');
  return `${year}-${mm}-%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 1 — getAccountBalance
//
// Computes the current balance for a single account.
//
// Formula (from Appendix B of the Phase 2 guide):
//   balance = starting_balance + total_credits - total_debits + net_adjustments
//
// DEBITS (subtract):
//   type = 'expense'  AND account_id = X AND is_deleted = 0
//   type = 'transfer' AND account_id = X AND destination_account_id IS NULL
//                     AND is_deleted = 0
//
// CREDITS (add):
//   type = 'income'   AND account_id = X AND is_deleted = 0
//   type = 'transfer' AND account_id = X AND destination_account_id IS NOT NULL
//                     AND is_deleted = 0
//
// ADJUSTMENTS (signed — add the signed sum):
//   type = 'adjustment' AND account_id = X AND is_deleted = 0
//   The amount column stores a signed value for adjustments.
//   Positive adjustments increase balance; negative ones decrease it.
//
// Returns 0 if the account does not exist.
// ─────────────────────────────────────────────────────────────────────────────
export async function getAccountBalance(accountId: number): Promise<number> {
  // Step 1 — get starting_balance from the accounts table
  const accountRows = await db
    .select({ starting_balance: accounts.starting_balance })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (accountRows.length === 0) return 0;

  const startingBalance = accountRows[0].starting_balance ?? 0;

  const base = and(
    eq(transactions.account_id, accountId),
    eq(transactions.is_deleted, 0)
  );

  // Step 2 — run three aggregate queries in parallel
  const [debitResult, creditResult, adjustmentResult] = await Promise.all([
    // DEBITS: expenses + outgoing transfers
    db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          base,
          or(
            eq(transactions.type, 'expense'),
            and(
              eq(transactions.type, 'transfer'),
              isNull(transactions.destination_account_id)
            )
          )
        )
      ),

    // CREDITS: income + incoming transfers
    db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          base,
          or(
            eq(transactions.type, 'income'),
            and(
              eq(transactions.type, 'transfer'),
              isNotNull(transactions.destination_account_id)
            )
          )
        )
      ),

    // ADJUSTMENTS: signed amounts — sum as-is
    db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(base, eq(transactions.type, 'adjustment'))),
  ]);

  const totalDebits = toNumber(debitResult[0]?.total);
  const totalCredits = toNumber(creditResult[0]?.total);
  const netAdjustments = toNumber(adjustmentResult[0]?.total);

  return startingBalance + totalCredits - totalDebits + netAdjustments;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 2 — getAllAccountBalances
//
// Computes balances for multiple accounts efficiently using Promise.all.
// Returns a Map<accountId, balance>.
//
// Usage:
//   const balances = await getAllAccountBalances([1, 2, 3]);
//   const gcashBalance = balances.get(1); // number
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllAccountBalances(
  accountIds: number[]
): Promise<Map<number, number>> {
  if (accountIds.length === 0) return new Map();

  const results = await Promise.all(
    accountIds.map(async (id) => {
      const balance = await getAccountBalance(id);
      return [id, balance] as [number, number];
    })
  );

  return new Map(results);
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 3 — getTotalPersonalBalance
//
// Sums computed balances for all accounts where category = 'personal'.
// Accepts the accounts array from useWalletStore (no extra DB query needed).
//
// Usage on WalletListScreen:
//   const total = await getTotalPersonalBalance(store.accounts);
// ─────────────────────────────────────────────────────────────────────────────
export async function getTotalPersonalBalance(
  allAccounts: Account[]
): Promise<number> {
  const personalAccounts = allAccounts.filter(
    (a) => a.category === 'personal' && a.is_active === 1
  );

  if (personalAccounts.length === 0) return 0;

  const ids = personalAccounts.map((a) => a.id);
  const balances = await getAllAccountBalances(ids);

  let total = 0;
  for (const balance of balances.values()) {
    total += balance;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 4 — getTotalBusinessBalance
//
// Sums computed balances for accounts where category is 'business'
// OR 'lending_fund'. Shown separately from personal balance on the
// home screen when business wallets exist.
// ─────────────────────────────────────────────────────────────────────────────
export async function getTotalBusinessBalance(
  allAccounts: Account[]
): Promise<number> {
  const businessAccounts = allAccounts.filter(
    (a) =>
      (a.category === 'business' || a.category === 'lending_fund') &&
      a.is_active === 1
  );

  if (businessAccounts.length === 0) return 0;

  const ids = businessAccounts.map((a) => a.id);
  const balances = await getAllAccountBalances(ids);

  let total = 0;
  for (const balance of balances.values()) {
    total += balance;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 5 — getMonthlyIncome
//
// Returns total income logged for a given month and year.
// Filters: type = 'income', date LIKE 'YYYY-MM-%', is_deleted = 0
//
// month: 1–12 (January = 1)
// year:  full year e.g. 2025
// ─────────────────────────────────────────────────────────────────────────────
export async function getMonthlyIncome(
  month: number,
  year: number
): Promise<number> {
  const result = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'income'),
        eq(transactions.is_deleted, 0),
        like(transactions.date, monthPrefix(month, year))
      )
    );

  return toNumber(result[0]?.total);
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 6 — getMonthlyExpenses
//
// Returns total expenses logged for a given month and year.
// Filters: type = 'expense', date LIKE 'YYYY-MM-%', is_deleted = 0
//
// month: 1–12 (January = 1)
// year:  full year e.g. 2025
// ─────────────────────────────────────────────────────────────────────────────
export async function getMonthlyExpenses(
  month: number,
  year: number
): Promise<number> {
  const result = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'expense'),
        eq(transactions.is_deleted, 0),
        like(transactions.date, monthPrefix(month, year))
      )
    );

  return toNumber(result[0]?.total);
}