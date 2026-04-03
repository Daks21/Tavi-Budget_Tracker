// src/db/schema.ts

import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
  AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ============================================================
// TABLE 1: user_profile
// ============================================================

export const userProfile = sqliteTable('user_profile', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  income_type:      text('income_type').notNull().default('irregular'),
  onboarding_done:  integer('onboarding_done').notNull().default(0),
  privacy_mode:     integer('privacy_mode').notNull().default(0),
  preferred_currency: text('preferred_currency').notNull().default('PHP'),
  preferred_locale: text('preferred_locale').notNull().default('en-PH'),
  payday_date:      integer('payday_date'),
  app_version:      text('app_version'),
  notif_due_dates:  integer('notif_due_dates').notNull().default(1),
  notif_budget_warn: integer('notif_budget_warn').notNull().default(1),
  notif_weekly_sum: integer('notif_weekly_sum').notNull().default(1),
  notif_daily_log:  integer('notif_daily_log').notNull().default(0),
  created_at:       text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at:       text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type UserProfile       = InferSelectModel<typeof userProfile>;
export type NewUserProfile    = InferInsertModel<typeof userProfile>;


// ============================================================
// TABLE 2: accounts
// ============================================================

export const accounts = sqliteTable('accounts', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  name:             text('name').notNull(),
  type:             text('type').notNull(),
  // allowed: 'cash' | 'ewallet' | 'bank' | 'credit_card' | 'virtual_fund'
  category:         text('category').notNull().default('personal'),
  // allowed: 'personal' | 'business' | 'lending_fund'
  wallet_key:       text('wallet_key'),
  starting_balance: real('starting_balance').notNull().default(0),
  currency:         text('currency').notNull().default('PHP'),
  icon_key:         text('icon_key'),
  display_order:    integer('display_order').notNull().default(0),
  is_active:        integer('is_active').notNull().default(1),
  notes:            text('notes'),
  created_at:       text('created_at').notNull(),
  updated_at:       text('updated_at').notNull(),
});

export type Account    = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;


// ============================================================
// TABLE 3: categories
// ============================================================

export const categories = sqliteTable('categories', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  name:          text('name').notNull(),
  type:          text('type').notNull(),
  // allowed: 'income' | 'expense'
  icon_key:      text('icon_key'),
  color_key:     text('color_key'),
  is_custom:     integer('is_custom').notNull().default(0),
  is_active:     integer('is_active').notNull().default(1),
  display_order: integer('display_order').notNull().default(0),
  created_at:    text('created_at').notNull(),
});

export type Category    = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;


// ============================================================
// TABLE 4: transactions
// ============================================================

export const transactions = sqliteTable(
  'transactions',
  {
    id:                     integer('id').primaryKey({ autoIncrement: true }),
    date:                   text('date').notNull(),
    type:                   text('type').notNull(),
    // allowed: 'income' | 'expense' | 'transfer' | 'adjustment'
    category_id:            integer('category_id').references(() => categories.id),
    account_id:             integer('account_id').notNull().references(() => accounts.id),
    destination_account_id: integer('destination_account_id').references(() => accounts.id),
    amount:                 real('amount').notNull(),
    // always positive — type determines direction
    description:            text('description'),
    notes:                  text('notes'),
    reference_id:           text('reference_id'),
    // CRITICAL: links to loans, obligations, borrowers
    // Format: 'OBL-001', 'LOAN-003', 'COL-007'
    // MUST exist from migration 001
    entry_mode:             text('entry_mode').notNull().default('realtime'),
    // allowed: 'realtime' | 'batch'
    batch_period_start:     text('batch_period_start'),
    batch_period_end:       text('batch_period_end'),
    is_deleted:             integer('is_deleted').notNull().default(0),
    created_at:             text('created_at').notNull(),
    updated_at:             text('updated_at').notNull(),
  },
  (table) => ({
    idxCompound:    index('idx_transactions_compound').on(
      table.account_id,
      table.date,
      table.type,
      table.is_deleted
    ),
    idxReferenceId: index('idx_transactions_reference_id').on(table.reference_id),
  })
);

export type Transaction    = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;


// ============================================================
// TABLE 5: budgets
// ============================================================

export const budgets = sqliteTable(
  'budgets',
  {
    id:               integer('id').primaryKey({ autoIncrement: true }),
    category_id:      integer('category_id').notNull().references(() => categories.id),
    month:            integer('month').notNull(),   // 1-12
    year:             integer('year').notNull(),    // e.g. 2026
    limit_amount:     real('limit_amount').notNull(),
    rollover_enabled: integer('rollover_enabled').notNull().default(0),
    rollover_amount:  real('rollover_amount').notNull().default(0),
    created_at:       text('created_at').notNull(),
    updated_at:       text('updated_at').notNull(),
  },
  (table) => ({
    uniqCategoryMonthYear: uniqueIndex('uniq_budget_category_month_year').on(
      table.category_id,
      table.month,
      table.year
    ),
  })
);

export type Budget    = InferSelectModel<typeof budgets>;
export type NewBudget = InferInsertModel<typeof budgets>;


// ============================================================
// TABLE 6: obligations
// ============================================================

export const obligations = sqliteTable('obligations', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  name:              text('name').notNull(),
  type:              text('type').notNull(),
  // allowed: 'credit_card' | 'personal_loan' | 'bnpl' | 'installment' | 'bank_loan' | 'other'
  principal_amount:  real('principal_amount'),
  interest_rate:     real('interest_rate'),
  monthly_payment:   real('monthly_payment').notNull(),
  start_date:        text('start_date'),
  end_date:          text('end_date'),
  next_due_date:     text('next_due_date').notNull(),
  payment_frequency: text('payment_frequency').notNull().default('monthly'),
  // allowed: 'monthly' | 'semi_monthly' | 'weekly'
  total_payments:    integer('total_payments'),
  payments_made:     integer('payments_made').notNull().default(0),
  current_balance:   real('current_balance'),
  is_active:         integer('is_active').notNull().default(1),
  notes:             text('notes'),
  created_at:        text('created_at').notNull(),
  updated_at:        text('updated_at').notNull(),
});

export type Obligation    = InferSelectModel<typeof obligations>;
export type NewObligation = InferInsertModel<typeof obligations>;


// ============================================================
// TABLE 7: obligation_payments
// ============================================================

export const obligationPayments = sqliteTable(
  'obligation_payments',
  {
    id:                    integer('id').primaryKey({ autoIncrement: true }),
    obligation_id:         integer('obligation_id').notNull().references(() => obligations.id),
    scheduled_date:        text('scheduled_date').notNull(),
    amount_due:            real('amount_due').notNull(),
    amount_paid:           real('amount_paid'),
    paid_date:             text('paid_date'),
    is_paid:               integer('is_paid').notNull().default(0),
    linked_transaction_id: integer('linked_transaction_id').references(() => transactions.id),
    created_at:            text('created_at').notNull(),
    updated_at:            text('updated_at').notNull(),
  },
  (table) => ({
    idxObligationDate: index('idx_obpay_obligation_date').on(
      table.obligation_id,
      table.scheduled_date,
      table.is_paid
    ),
  })
);

export type ObligationPayment    = InferSelectModel<typeof obligationPayments>;
export type NewObligationPayment = InferInsertModel<typeof obligationPayments>;


// ============================================================
// TABLE 8: savings_goals
// ============================================================

export const savingsGoals = sqliteTable('savings_goals', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  name:              text('name').notNull(),
  target_amount:     real('target_amount').notNull(),
  target_date:       text('target_date'),
  linked_account_id: integer('linked_account_id').references(() => accounts.id),
  icon_key:          text('icon_key'),
  is_complete:       integer('is_complete').notNull().default(0),
  notes:             text('notes'),
  created_at:        text('created_at').notNull(),
  updated_at:        text('updated_at').notNull(),
});

export type SavingsGoal    = InferSelectModel<typeof savingsGoals>;
export type NewSavingsGoal = InferInsertModel<typeof savingsGoals>;


// ============================================================
// TABLE 9: savings_contributions
// ============================================================

export const savingsContributions = sqliteTable('savings_contributions', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  goal_id:               integer('goal_id').notNull().references(() => savingsGoals.id),
  amount:                real('amount').notNull(),
  date:                  text('date').notNull(),
  linked_transaction_id: integer('linked_transaction_id').references(() => transactions.id),
  notes:                 text('notes'),
  created_at:            text('created_at').notNull(),
});

export type SavingsContribution    = InferSelectModel<typeof savingsContributions>;
export type NewSavingsContribution = InferInsertModel<typeof savingsContributions>;


// ============================================================
// TABLE 10: recurring_rules
// ============================================================

export const recurringRules = sqliteTable('recurring_rules', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  type:          text('type').notNull(),
  // allowed: 'income' | 'expense'
  category_id:   integer('category_id').notNull().references(() => categories.id),
  account_id:    integer('account_id').notNull().references(() => accounts.id),
  amount:        real('amount').notNull(),
  frequency:     text('frequency').notNull(),
  // allowed: 'daily' | 'weekly' | 'monthly' | 'custom'
  next_due_date: text('next_due_date').notNull(),
  description:   text('description'),
  is_active:     integer('is_active').notNull().default(1),
  created_at:    text('created_at').notNull(),
  updated_at:    text('updated_at').notNull(),
});

export type RecurringRule    = InferSelectModel<typeof recurringRules>;
export type NewRecurringRule = InferInsertModel<typeof recurringRules>;


// ============================================================
// PHASE 2 SHELL TABLES
// No UI yet — must exist in migration 001 to prevent future
// breaking schema changes.
// ============================================================

// TABLE 11: borrowers
export const borrowers = sqliteTable('borrowers', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  name:              text('name').notNull(),
  contact:           text('contact'),
  referrer_id:       integer('referrer_id').references((): AnySQLiteColumn => borrowers.id),
  // self-reference to borrowers(id) — set manually to avoid circular ref
  referrer_share_pct: real('referrer_share_pct'),
  is_active:         integer('is_active').notNull().default(1),
  notes:             text('notes'),
  created_at:        text('created_at').notNull(),
  updated_at:        text('updated_at').notNull(),
});

export type Borrower    = InferSelectModel<typeof borrowers>;
export type NewBorrower = InferInsertModel<typeof borrowers>;


// TABLE 12: loans
export const loans = sqliteTable('loans', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  loan_code:             text('loan_code').notNull().unique(),
  // format: LOAN-0001, LOAN-0002, etc.
  borrower_id:           integer('borrower_id').notNull().references(() => borrowers.id),
  principal:             real('principal').notNull(),
  interest_rate:         real('interest_rate').notNull(),
  term_months:           integer('term_months'),
  frequency:             text('frequency').notNull().default('monthly'),
  // allowed: 'monthly' | 'semi_monthly' | 'weekly'
  start_date:            text('start_date').notNull(),
  end_date:              text('end_date'),
  funding_obligation_id: integer('funding_obligation_id').references(() => obligations.id),
  status:                text('status').notNull().default('active'),
// allowed: 'active' | 'completed' | 'defaulted'
  notes:                 text('notes'),
  created_at:            text('created_at').notNull(),
  updated_at:            text('updated_at').notNull(),
});

export type Loan    = InferSelectModel<typeof loans>;
export type NewLoan = InferInsertModel<typeof loans>;


// TABLE 13: loan_payments
export const loanPayments = sqliteTable(
  'loan_payments',
  {
    id:                    integer('id').primaryKey({ autoIncrement: true }),
    loan_id:               integer('loan_id').notNull().references(() => loans.id),
    scheduled_date:        text('scheduled_date').notNull(),
    amount_due:            real('amount_due').notNull(),
    interest_portion:      real('interest_portion').notNull().default(0),
    principal_portion:     real('principal_portion').notNull().default(0),
    is_paid:               integer('is_paid').notNull().default(0),
    paid_date:             text('paid_date'),
    paid_amount:           real('paid_amount'),
    linked_transaction_id: integer('linked_transaction_id').references(() => transactions.id),
    created_at:            text('created_at').notNull(),
    updated_at:            text('updated_at').notNull(),
  },
  (table) => ({
    idxLoanDate: index('idx_loanpay_loan_date').on(
      table.loan_id,
      table.scheduled_date,
      table.is_paid
    ),
  })
);

export type LoanPayment    = InferSelectModel<typeof loanPayments>;
export type NewLoanPayment = InferInsertModel<typeof loanPayments>;


// TABLE 14: paluwagan_groups
export const paluwaganGroups = sqliteTable('paluwagan_groups', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  name:                text('name').notNull(),
  contribution_amount: real('contribution_amount').notNull(),
  frequency:           text('frequency').notNull().default('monthly'),
  total_members:       integer('total_members').notNull(),
  user_role:           text('user_role').notNull().default('participant'),
  // allowed: 'participant' | 'organizer'
  start_date:          text('start_date').notNull(),
  user_turn_position:  integer('user_turn_position'),
  is_active:           integer('is_active').notNull().default(1),
  notes:               text('notes'),
  created_at:          text('created_at').notNull(),
  updated_at:          text('updated_at').notNull(),
});

export type PaluwaganGroup    = InferSelectModel<typeof paluwaganGroups>;
export type NewPaluwaganGroup = InferInsertModel<typeof paluwaganGroups>;


// TABLE 15: buysell_items
export const buysellItems = sqliteTable('buysell_items', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  name:                  text('name').notNull(),
  buy_price:             real('buy_price').notNull(),
  sell_price:            real('sell_price'),
  buy_date:              text('buy_date').notNull(),
  sell_date:             text('sell_date'),
  profit:                real('profit'),
  linked_transaction_id: integer('linked_transaction_id').references(() => transactions.id),
  notes:                 text('notes'),
  created_at:            text('created_at').notNull(),
  updated_at:            text('updated_at').notNull(),
});

export type BuysellItem    = InferSelectModel<typeof buysellItems>;
export type NewBuysellItem = InferInsertModel<typeof buysellItems>;