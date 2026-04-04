// src/store/useObligationStore.ts

import { and, asc, eq } from 'drizzle-orm';
import { create } from 'zustand';

import db from '@/db';
import {
  categories,
  obligations,
  obligationPayments,
  transactions,
  type Obligation,
  type NewObligation,
  type ObligationPayment,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type ObligationWithStatus = {
  obligation: Obligation;
  nextPayment: ObligationPayment | null;
  daysUntilDue: number | null;
  status: 'paid' | 'upcoming' | 'due_soon' | 'overdue';
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

function diffDays(scheduledDate: string): number {
  const today = new Date(todayStr());
  const due = new Date(scheduledDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((due.getTime() - today.getTime()) / msPerDay);
}

function computeStatus(
  nextPayment: ObligationPayment | null,
  daysUntilDue: number | null,
): ObligationWithStatus['status'] {
  if (nextPayment?.is_paid === 1) return 'paid';
  if (daysUntilDue === null) return 'upcoming';
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 3) return 'due_soon';
  return 'upcoming';
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function generatePaymentSchedule(
  obligationId: number,
  startDate: string,
  frequency: string,
  amountDue: number,
  count: number,
): Array<{
  obligation_id: number;
  scheduled_date: string;
  amount_due: number;
  is_paid: number;
  created_at: string;
  updated_at: string;
}> {
  const now = nowISO();
  const schedule = [];
  let current = startDate;

  for (let i = 0; i < count; i++) {
    schedule.push({
      obligation_id: obligationId,
      scheduled_date: current,
      amount_due: amountDue,
      is_paid: 0,
      created_at: now,
      updated_at: now,
    });

    if (frequency === 'weekly') {
      current = addDays(current, 7);
    } else if (frequency === 'semi_monthly') {
      current = addDays(current, 15);
    } else {
      current = addMonths(current, 1);
    }
  }

  return schedule;
}

// Maps obligation type to seeded category name (see seed.ts)
const OBLIGATION_CATEGORY_MAP: Record<string, string> = {
  credit_card: 'CC Payment',
  personal_loan: 'Loan Payment',
  bank_loan: 'Loan Payment',
  bnpl: 'Loan Payment',
  installment: 'Loan Payment',
  other: 'Miscellaneous',
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

interface ObligationStore {
  obligations: Obligation[];
  upcomingPayments: ObligationWithStatus[];
  isLoading: boolean;

  loadObligations(): Promise<void>;
  addObligation(data: NewObligation): Promise<number>;
  markPaymentPaid(paymentId: number, accountId: number, amountPaid: number): Promise<void>;
  getUpcomingPayments(daysAhead: number): Promise<ObligationWithStatus[]>;
  getTotalMonthlyBurden(): Promise<number>;
  archiveObligation(id: number): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

const useObligationStore = create<ObligationStore>((set, get) => ({
  obligations: [],
  upcomingPayments: [],
  isLoading: false,

  // ─────────────────────────────────────────────────────────────────────────
  // loadObligations
  //
  // Fetches all active obligations, then for each finds the earliest
  // unpaid payment. Computes daysUntilDue and status in memory.
  // ─────────────────────────────────────────────────────────────────────────
  loadObligations: async () => {
    set({ isLoading: true });
    try {
      const activeObligations = await db
        .select()
        .from(obligations)
        .where(eq(obligations.is_active, 1));

      const withStatus: ObligationWithStatus[] = await Promise.all(
        activeObligations.map(async (obligation) => {
          const [nextPayment = null] = await db
            .select()
            .from(obligationPayments)
            .where(
              and(
                eq(obligationPayments.obligation_id, obligation.id),
                eq(obligationPayments.is_paid, 0),
              ),
            )
            .orderBy(asc(obligationPayments.scheduled_date))
            .limit(1);

          const daysUntilDue = nextPayment ? diffDays(nextPayment.scheduled_date) : null;
          const status = computeStatus(nextPayment, daysUntilDue);

          return { obligation, nextPayment, daysUntilDue, status };
        }),
      );

      set({ obligations: activeObligations, upcomingPayments: withStatus });
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // addObligation
  //
  // Inserts the obligation row, then generates 12 obligation_payment rows
  // starting from next_due_date using the stored payment_frequency.
  // Returns the new obligation id.
  // ─────────────────────────────────────────────────────────────────────────
  addObligation: async (data) => {
    const now = nowISO();

    const inserted = await db
      .insert(obligations)
      .values({
        ...data,
        created_at: now,
        updated_at: now,
      })
      .returning({ id: obligations.id });

    const newId = inserted[0].id;

    const frequency = data.payment_frequency ?? 'monthly';
    const schedule = generatePaymentSchedule(
      newId,
      data.next_due_date,
      frequency,
      data.monthly_payment,
      12,
    );

    if (schedule.length > 0) {
      await db.insert(obligationPayments).values(schedule);
    }

    await get().loadObligations();
    return newId;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // markPaymentPaid
  //
  // Marks a payment row as paid, creates a linked expense transaction,
  // and increments obligations.payments_made. Category is resolved from
  // the obligation type via OBLIGATION_CATEGORY_MAP. Falls back to
  // 'Miscellaneous' if the type is unrecognised or the category row is
  // missing from the database.
  // ─────────────────────────────────────────────────────────────────────────
  markPaymentPaid: async (paymentId, accountId, amountPaid) => {
    const now = nowISO();
    const today = todayStr();

    const [payment] = await db
      .select()
      .from(obligationPayments)
      .where(eq(obligationPayments.id, paymentId))
      .limit(1);

    if (!payment) throw new Error(`ObligationPayment ${paymentId} not found`);

    const [obligation] = await db
      .select()
      .from(obligations)
      .where(eq(obligations.id, payment.obligation_id))
      .limit(1);

    if (!obligation) throw new Error(`Obligation ${payment.obligation_id} not found`);

    // Resolve category name; unrecognised types fall back to Miscellaneous
    const categoryName = OBLIGATION_CATEGORY_MAP[obligation.type] ?? 'Miscellaneous';

    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, categoryName))
      .limit(1);

    const categoryId = category?.id ?? null;

    const insertedTx = await db
      .insert(transactions)
      .values({
        date: today,
        type: 'expense',
        category_id: categoryId,
        account_id: accountId,
        amount: amountPaid,
        description: `${obligation.name} payment`,
        reference_id: `OBL-${obligation.id}`,
        entry_mode: 'realtime',
        is_deleted: 0,
        created_at: now,
        updated_at: now,
      })
      .returning({ id: transactions.id });

    const txId = insertedTx[0].id;

    await db
      .update(obligationPayments)
      .set({
        is_paid: 1,
        paid_date: today,
        amount_paid: amountPaid,
        linked_transaction_id: txId,
        updated_at: now,
      })
      .where(eq(obligationPayments.id, paymentId));

    await db
      .update(obligations)
      .set({
        payments_made: obligation.payments_made + 1,
        updated_at: now,
      })
      .where(eq(obligations.id, obligation.id));

    await get().loadObligations();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getUpcomingPayments
  //
  // Filters in-memory upcomingPayments to those with a next unpaid payment
  // falling within the next N days. Sorted by scheduled_date ascending.
  // ─────────────────────────────────────────────────────────────────────────
  getUpcomingPayments: async (daysAhead) => {
    const { upcomingPayments } = get();
    return upcomingPayments
      .filter(
        (item) =>
          item.daysUntilDue !== null &&
          item.daysUntilDue >= 0 &&
          item.daysUntilDue <= daysAhead,
      )
      .sort((a, b) => {
        const aDate = a.nextPayment?.scheduled_date ?? '';
        const bDate = b.nextPayment?.scheduled_date ?? '';
        return aDate.localeCompare(bDate);
      });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getTotalMonthlyBurden
  //
  // Returns the sum of monthly_payment for all active obligations.
  // ─────────────────────────────────────────────────────────────────────────
  getTotalMonthlyBurden: async () => {
    const rows = await db
      .select({ monthly_payment: obligations.monthly_payment })
      .from(obligations)
      .where(eq(obligations.is_active, 1));

    return rows.reduce((sum, row) => sum + row.monthly_payment, 0);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // archiveObligation
  //
  // Sets is_active = 0 and reloads obligations so state reflects the change.
  // ─────────────────────────────────────────────────────────────────────────
  archiveObligation: async (id) => {
    await db
      .update(obligations)
      .set({ is_active: 0, updated_at: nowISO() })
      .where(eq(obligations.id, id));

    await get().loadObligations();
  },
}));

export default useObligationStore;
