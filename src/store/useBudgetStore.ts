// src/store/useBudgetStore.ts

import { and, asc, eq, like, sql } from 'drizzle-orm';
import { create } from 'zustand';

import db from '@/db';
import {
  budgets,
  categories,
  transactions,
  type Budget,
  type Category,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetWithProgress {
  budget: Budget;
  category: Category;
  consumed: number;
  percent: number;
  remaining: number;
  status: 'healthy' | 'warning' | 'exceeded';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString();
}

function monthPrefix(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-%`;
}

function computeStatus(percent: number): 'healthy' | 'warning' | 'exceeded' {
  if (percent >= 100) return 'exceeded';
  if (percent >= 70) return 'warning';
  return 'healthy';
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetState {
  budgets: Budget[];
  categories: Category[];
  isLoading: boolean;
  currentMonth: number;
  currentYear: number;
}

interface BudgetActions {
  loadBudgets(month: number, year: number): Promise<void>;
  loadCategories(): Promise<void>;
  setBudgetLimit(
    categoryId: number,
    amount: number,
    month: number,
    year: number,
    rollover: boolean,
  ): Promise<void>;
  removeBudgetLimit(categoryId: number, month: number, year: number): Promise<void>;
  getBudgetProgress(month: number, year: number): Promise<BudgetWithProgress[]>;
  getTopPressuredBudgets(month: number, year: number, limit: number): Promise<BudgetWithProgress[]>;
}

type BudgetStore = BudgetState & BudgetActions;

// ─────────────────────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

const useBudgetStore = create<BudgetStore>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────────────────────
  budgets: [],
  categories: [],
  isLoading: false,
  currentMonth: new Date().getMonth() + 1,
  currentYear: new Date().getFullYear(),

  // ─────────────────────────────────────────────────────────────────────────
  // loadBudgets
  //
  // Fetches BUDGETS for the given month/year and all active CATEGORIES in
  // parallel. Updates state and advances currentMonth/currentYear.
  // ─────────────────────────────────────────────────────────────────────────
  loadBudgets: async (month, year) => {
    set({ isLoading: true });
    try {
      const [budgetRows, categoryRows] = await Promise.all([
        db
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.month, month),
              eq(budgets.year, year),
            ),
          ),
        db
          .select()
          .from(categories)
          .where(eq(categories.is_active, 1))
          .orderBy(asc(categories.display_order)),
      ]);

      set({
        budgets: budgetRows,
        categories: categoryRows,
        currentMonth: month,
        currentYear: year,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // loadCategories
  //
  // Queries all active CATEGORIES ordered by display_order.
  // ─────────────────────────────────────────────────────────────────────────
  loadCategories: async () => {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.is_active, 1))
      .orderBy(asc(categories.display_order));

    set({ categories: rows });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // setBudgetLimit
  //
  // Upserts a BUDGETS row. On conflict (category_id + month + year),
  // updates limit_amount, rollover_enabled, and updated_at only.
  // created_at is preserved for existing rows.
  // ─────────────────────────────────────────────────────────────────────────
  setBudgetLimit: async (categoryId, amount, month, year, rollover) => {
    const now = nowISO();

    await db
      .insert(budgets)
      .values({
        category_id: categoryId,
        month,
        year,
        limit_amount: amount,
        rollover_enabled: rollover ? 1 : 0,
        rollover_amount: 0,
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: [budgets.category_id, budgets.month, budgets.year],
        set: {
          limit_amount: amount,
          rollover_enabled: rollover ? 1 : 0,
          updated_at: now,
        },
      });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // removeBudgetLimit
  //
  // Hard-deletes the BUDGETS row for this category + month + year.
  // Budgets are user-defined limits, not financial records — deletion is safe.
  // ─────────────────────────────────────────────────────────────────────────
  removeBudgetLimit: async (categoryId, month, year) => {
    await db
      .delete(budgets)
      .where(
        and(
          eq(budgets.category_id, categoryId),
          eq(budgets.month, month),
          eq(budgets.year, year),
        ),
      );
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getBudgetProgress
  //
  // Queries BUDGETS and active CATEGORIES fresh from DB (not from state)
  // so the month/year is always consistent regardless of loaded state.
  //
  // Spending is computed in one grouped query over non-deleted expense
  // transactions whose date matches 'YYYY-MM-%'.
  //
  // Percent is capped at 999 for display. Status thresholds:
  //   0–69%  → healthy
  //   70–99% → warning
  //   100%+  → exceeded
  //
  // Returns results sorted by percent descending (most pressured first).
  // ─────────────────────────────────────────────────────────────────────────
  getBudgetProgress: async (month, year) => {
    const [budgetRows, categoryRows] = await Promise.all([
      db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.month, month),
            eq(budgets.year, year),
          ),
        ),
      db
        .select()
        .from(categories)
        .where(eq(categories.is_active, 1)),
    ]);

    if (budgetRows.length === 0) return [];

    const categoryMap = new Map<number, Category>(
      categoryRows.map((c) => [c.id, c]),
    );

    // Sum expense amounts per category for the month in one query
    const spendingRows = await db
      .select({
        category_id: transactions.category_id,
        total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          eq(transactions.is_deleted, 0),
          like(transactions.date, monthPrefix(month, year)),
        ),
      )
      .groupBy(transactions.category_id);

    const spendingMap = new Map<number, number>(
      spendingRows.map((r) => [r.category_id as number, r.total]),
    );

    const result: BudgetWithProgress[] = [];

    for (const budget of budgetRows) {
      const category = categoryMap.get(budget.category_id);
      if (!category) continue;

      const consumed = spendingMap.get(budget.category_id) ?? 0;
      const rawPercent =
        budget.limit_amount > 0 ? (consumed / budget.limit_amount) * 100 : 0;
      const percent = Math.min(rawPercent, 999);
      const remaining = budget.limit_amount - consumed;
      const status = computeStatus(rawPercent);

      result.push({ budget, category, consumed, percent, remaining, status });
    }

    result.sort((a, b) => b.percent - a.percent);

    return result;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getTopPressuredBudgets
  //
  // Returns the top N budgets by percent consumed for the given month/year.
  // Delegates to getBudgetProgress so sorting and status logic stay in one place.
  // ─────────────────────────────────────────────────────────────────────────
  getTopPressuredBudgets: async (month, year, limit) => {
    const all = await get().getBudgetProgress(month, year);
    return all.slice(0, limit);
  },
}));

export default useBudgetStore;
