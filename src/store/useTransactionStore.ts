// src/store/useTransactionStore.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { and, desc, eq, gte, lte, like, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { create } from 'zustand';

import db from '@/db';
import { transactions, type Transaction, type NewTransaction } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionTemplate {
  id: number;             // timestamp-based, generated on save
  categoryId: number | null;
  accountId: number;
  amount: number;
  description: string | null;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  useCount: number;
  lastUsed: string;       // ISO date string: 'YYYY-MM-DD'
}

/**
 * What a caller must supply to create a transaction.
 * Auto-managed fields are excluded — the store fills them in.
 */
export type TransactionInput = Omit<
  NewTransaction,
  'id' | 'created_at' | 'updated_at' | 'is_deleted'
>;

/**
 * What a caller may update. updated_at is always refreshed internally.
 */
export type TransactionUpdate = Partial<
  Omit<NewTransaction, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>
>;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES_KEY = 'tavi_templates';
const UNDO_WINDOW_MS = 10_000; // 10 seconds
const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current moment as a SQLite-compatible datetime string.
 * Format: 'YYYY-MM-DD HH:MM:SS' — matches datetime('now') output.
 */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Runs template auto-detection after a successful addTransaction.
 *
 * Rules:
 *  - Only income/expense qualify (transfer/adjustment are skipped).
 *  - One template per categoryId + accountId + type combo.
 *  - Checks the last 30 days for >= 3 transactions with the same
 *    combo whose amounts fall within ±10% of the just-added amount.
 *  - On match, auto-creates a template using the just-added amount.
 *
 * Non-throwing: all errors are swallowed by the caller (.catch).
 */
async function _maybeAutoSaveTemplate(
  set: (partial: Partial<TransactionStore>) => void,
  get: () => TransactionStore,
  data: TransactionInput,
): Promise<void> {
  if (data.type === 'transfer' || data.type === 'adjustment') return;
  if (data.category_id == null) return;

  const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
  const storedTemplates: TransactionTemplate[] = raw ? JSON.parse(raw) : [];

  // Keep Zustand state in sync with storage
  set({ templates: Array.isArray(storedTemplates) ? storedTemplates : [] });

  const alreadyExists = storedTemplates.some(
    (t) =>
      t.type === (data.type as TransactionTemplate['type']) &&
      t.categoryId === data.category_id &&
      t.accountId === data.account_id,
  );
  if (alreadyExists) return;

  // Query matching transactions in the last 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const rows = await db
    .select({ amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        eq(transactions.is_deleted, 0),
        eq(transactions.type, data.type),
        eq(transactions.account_id, data.account_id),
        eq(transactions.category_id, data.category_id),
        gte(transactions.date, cutoffStr),
      ),
    );

  // Apply ±10% amount filter in JS
  const lo = data.amount * 0.9;
  const hi = data.amount * 1.1;
  const withinRange = rows.filter((r) => r.amount >= lo && r.amount <= hi);

  if (withinRange.length < 3) return;

  await get().saveTemplate({
    categoryId: data.category_id,
    accountId: data.account_id,
    amount: data.amount,
    description: data.description ?? null,
    type: data.type as 'income' | 'expense',
    useCount: 0,
    lastUsed: data.date,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY FILTER TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionHistoryFilter {
  typeFilter: 'all' | 'expense' | 'income' | 'transfer';
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION FILTERS TYPE (for calendar & browseable history)
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionFilters {
  typeFilter: 'all' | 'income' | 'expense' | 'transfer';
  accountId: number | null;
  categoryId: number | null;
  dateStart: string | null;
  dateEnd: string | null;
  searchQuery: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

interface TransactionStore {
  // ── Public state ─────────────────────────────────────────────────────────
  recentTransactions: Transaction[];
  isLoading: boolean;
  lastEntryMode: 'realtime' | 'batch';
  templates: TransactionTemplate[];

  // ── Paginated history state ───────────────────────────────────────────────
  allTransactions: Transaction[];
  isLoadingAll: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;

  // ── Calendar/browseable history state ────────────────────────────────────
  totalTransactionCount: number;
  currentPage: number;
  pageSize: number;
  hasMorePages: boolean;
  activeFilters: TransactionFilters;
  isLoadingFiltered: boolean;

  // ── Internal pagination state ─────────────────────────────────────────────
  _allOffset: number;
  _allFilter: TransactionHistoryFilter | null;

  // ── Internal undo state ───────────────────────────────────────────────────
  // Prefixed with _ to signal these are not for consumers.
  _lastInsertedId: number | null;
  _lastInsertedAt: number | null;
  _undoTimeoutId: ReturnType<typeof setTimeout> | null;

  // ── Transaction actions ──────────────────────────────────────────────────
  loadRecentTransactions(limit?: number): Promise<void>;
  addTransaction(data: TransactionInput): Promise<number>;
  updateTransaction(id: number, data: TransactionUpdate): Promise<void>;
  softDeleteTransaction(id: number): Promise<void>;
  undoLastTransaction(): Promise<void>;

  // ── Paginated history actions ─────────────────────────────────────────────
  loadAllTransactions(filter: TransactionHistoryFilter): Promise<void>;
  loadMoreTransactions(): Promise<void>;

  // ── Calendar/browseable history actions ──────────────────────────────────
  loadTransactionPage(page: number, filters: TransactionFilters): Promise<void>;
  setFilters(filters: Partial<TransactionFilters>): Promise<void>;
  clearFilters(): Promise<void>;
  getTransactionsByDate(date: string): Promise<Transaction[]>;
  getTransactionSumsByMonth(
    month: number,
    year: number,
  ): Promise<Map<string, { income: number; expense: number }>>;

  // ── Template actions ─────────────────────────────────────────────────────
  loadTemplates(): Promise<void>;
  saveTemplate(template: Omit<TransactionTemplate, 'id'>): Promise<void>;
  incrementTemplateUseCount(templateId: number): Promise<void>;
  deleteTemplate(templateId: number): Promise<void>;

  // ── Mode ─────────────────────────────────────────────────────────────────
  setLastEntryMode(mode: 'realtime' | 'batch'): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: TransactionFilters = {
  typeFilter: 'all',
  accountId: null,
  categoryId: null,
  dateStart: null,
  dateEnd: null,
  searchQuery: '',
};

const useTransactionStore = create<TransactionStore>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────────────────────
  recentTransactions: [],
  isLoading: false,
  lastEntryMode: 'realtime',
  templates: [],
  allTransactions: [],
  isLoadingAll: false,
  isLoadingMore: false,
  hasMore: false,
  totalTransactionCount: 0,
  currentPage: 1,
  pageSize: 30,
  hasMorePages: false,
  activeFilters: DEFAULT_FILTERS,
  isLoadingFiltered: false,
  _allOffset: 0,
  _allFilter: null,
  _lastInsertedId: null,
  _lastInsertedAt: null,
  _undoTimeoutId: null,

  // ─────────────────────────────────────────────────────────────────────────
  // loadRecentTransactions
  //
  // Queries non-deleted transactions ordered by date DESC, then
  // created_at DESC to break ties on the same day.
  // ─────────────────────────────────────────────────────────────────────────
  loadRecentTransactions: async (limit = 20) => {
    set({ isLoading: true });
    try {
      const rows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.is_deleted, 0))
        .orderBy(desc(transactions.date), desc(transactions.created_at))
        .limit(limit);
      set({ recentTransactions: rows });
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // loadAllTransactions
  //
  // Resets pagination and loads the first PAGE_SIZE rows matching the
  // supplied filter. Ordered newest-first (date DESC, created_at DESC).
  // ─────────────────────────────────────────────────────────────────────────
  loadAllTransactions: async (filter) => {
    set({ isLoadingAll: true, allTransactions: [], _allOffset: 0, _allFilter: filter, hasMore: false });
    try {
      const conditions = [eq(transactions.is_deleted, 0)];
      if (filter.typeFilter !== 'all') {
        conditions.push(eq(transactions.type, filter.typeFilter));
      }
      if (filter.dateRangeStart) {
        conditions.push(gte(transactions.date, filter.dateRangeStart));
      }
      if (filter.dateRangeEnd) {
        conditions.push(lte(transactions.date, filter.dateRangeEnd));
      }

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.date), desc(transactions.created_at))
        .limit(PAGE_SIZE)
        .offset(0);

      set({
        allTransactions: rows,
        _allOffset: PAGE_SIZE,
        hasMore: rows.length === PAGE_SIZE,
      });
    } finally {
      set({ isLoadingAll: false });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // loadMoreTransactions
  //
  // Appends the next PAGE_SIZE rows using the current filter and offset.
  // No-ops if already loading or there are no more pages.
  // ─────────────────────────────────────────────────────────────────────────
  loadMoreTransactions: async () => {
    const { isLoadingAll, isLoadingMore, hasMore, _allOffset, _allFilter } = get();
    if (isLoadingAll || isLoadingMore || !hasMore || _allFilter === null) return;

    set({ isLoadingMore: true });
    try {
      const conditions = [eq(transactions.is_deleted, 0)];
      if (_allFilter.typeFilter !== 'all') {
        conditions.push(eq(transactions.type, _allFilter.typeFilter));
      }
      if (_allFilter.dateRangeStart) {
        conditions.push(gte(transactions.date, _allFilter.dateRangeStart));
      }
      if (_allFilter.dateRangeEnd) {
        conditions.push(lte(transactions.date, _allFilter.dateRangeEnd));
      }

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.date), desc(transactions.created_at))
        .limit(PAGE_SIZE)
        .offset(_allOffset);

      set((state) => ({
        allTransactions: [...state.allTransactions, ...rows],
        _allOffset: _allOffset + PAGE_SIZE,
        hasMore: rows.length === PAGE_SIZE,
      }));
    } finally {
      set({ isLoadingMore: false });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // addTransaction
  //
  // Inserts the row, starts the 10-second undo window, reloads
  // recent transactions, and returns the new row's id.
  //
  // After a successful insert, fires template auto-detection in the
  // background (non-blocking). Errors from detection are swallowed so
  // they never surface to the caller.
  //
  // If a previous undo window is still open (user added two transactions
  // rapidly), its timeout is cancelled before the new one starts —
  // only the most recent transaction is ever undoable.
  // ─────────────────────────────────────────────────────────────────────────
  addTransaction: async (data) => {
    const now = nowISO();

    const inserted = await db
      .insert(transactions)
      .values({
        ...data,
        is_deleted: 0,
        created_at: now,
        updated_at: now,
      })
      .returning({ id: transactions.id });

    const newId = inserted[0].id;

    // Cancel any existing undo timeout before registering the new one
    const existingTimeout = get()._undoTimeoutId;
    if (existingTimeout !== null) clearTimeout(existingTimeout);

    // Auto-expire the undo window after 10 seconds
    const timeoutId = setTimeout(() => {
      set({ _lastInsertedId: null, _lastInsertedAt: null, _undoTimeoutId: null });
    }, UNDO_WINDOW_MS);

    set({
      _lastInsertedId: newId,
      _lastInsertedAt: Date.now(),
      _undoTimeoutId: timeoutId,
    });

    await get().loadRecentTransactions();

    // Fire-and-forget: template detection must not block the caller
    _maybeAutoSaveTemplate(set, get, data).catch(() => {});

    return newId;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // updateTransaction
  //
  // Updates mutable fields. Always stamps updated_at with current time.
  // Reloads recent transactions after the update.
  // ─────────────────────────────────────────────────────────────────────────
  updateTransaction: async (id, data) => {
    await db
      .update(transactions)
      .set({ ...data, updated_at: nowISO() })
      .where(eq(transactions.id, id));

    await get().loadRecentTransactions();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // softDeleteTransaction
  //
  // Sets is_deleted = 1. Never hard-deletes rows — the ledger must
  // remain intact for balance recomputation. Removes the row from
  // recentTransactions immediately (optimistic update) so the UI
  // responds instantly without waiting for a DB round-trip.
  // ─────────────────────────────────────────────────────────────────────────
  softDeleteTransaction: async (id) => {
    await db
      .update(transactions)
      .set({ is_deleted: 1, updated_at: nowISO() })
      .where(eq(transactions.id, id));

    // Optimistic removal from in-memory list
    set((state) => ({
      recentTransactions: state.recentTransactions.filter((t) => t.id !== id),
      allTransactions: state.allTransactions.filter((t) => t.id !== id),
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // undoLastTransaction
  //
  // Soft-deletes the most recently added transaction — but only if the
  // 10-second undo window has not yet expired. Cancels the auto-expire
  // timeout and clears all undo state in one pass.
  //
  // Calling this after the window has expired is a no-op (safe to call).
  // ─────────────────────────────────────────────────────────────────────────
  undoLastTransaction: async () => {
    const { _lastInsertedId, _lastInsertedAt, _undoTimeoutId } = get();

    // No undo state — nothing to do
    if (_lastInsertedId === null || _lastInsertedAt === null) return;

    // Window has already expired — clean up and exit
    if (Date.now() - _lastInsertedAt > UNDO_WINDOW_MS) {
      set({ _lastInsertedId: null, _lastInsertedAt: null, _undoTimeoutId: null });
      return;
    }

    // Cancel the auto-expire timeout — we're handling cleanup now
    if (_undoTimeoutId !== null) clearTimeout(_undoTimeoutId);

    await get().softDeleteTransaction(_lastInsertedId);

    set({ _lastInsertedId: null, _lastInsertedAt: null, _undoTimeoutId: null });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // loadTemplates
  //
  // Reads the template array from AsyncStorage.
  // Returns an empty array on cache miss or JSON parse failure —
  // never throws to the caller.
  // ─────────────────────────────────────────────────────────────────────────
  loadTemplates: async () => {
    try {
      const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
      if (raw === null) {
        set({ templates: [] });
        return;
      }
      const parsed = JSON.parse(raw) as TransactionTemplate[];
      set({ templates: Array.isArray(parsed) ? parsed : [] });
    } catch {
      // Corrupted storage — reset gracefully
      set({ templates: [] });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // saveTemplate
  //
  // Generates a numeric id from Date.now() (unique enough for local
  // AsyncStorage — no UUID library needed). Appends to the current
  // list and persists the full array.
  // ─────────────────────────────────────────────────────────────────────────
  saveTemplate: async (template) => {
    const newTemplate: TransactionTemplate = {
      ...template,
      id: Date.now(),
    };
    const updated = [...get().templates, newTemplate];
    set({ templates: updated });
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // incrementTemplateUseCount
  //
  // Bumps useCount by 1 and stamps lastUsed with today's date.
  // Called every time a template is applied to a new transaction.
  // ─────────────────────────────────────────────────────────────────────────
  incrementTemplateUseCount: async (templateId) => {
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const updated = get().templates.map((t) =>
      t.id === templateId
        ? { ...t, useCount: t.useCount + 1, lastUsed: today }
        : t
    );
    set({ templates: updated });
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // deleteTemplate
  //
  // Removes by id. Persists the filtered array.
  // ─────────────────────────────────────────────────────────────────────────
  deleteTemplate: async (templateId) => {
    const updated = get().templates.filter((t) => t.id !== templateId);
    set({ templates: updated });
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // setLastEntryMode
  //
  // Records whether the user last used realtime or batch mode.
  // Used by the Log tab to restore the correct default on next open.
  // ─────────────────────────────────────────────────────────────────────────
  setLastEntryMode: (mode) => {
    set({ lastEntryMode: mode });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // loadTransactionPage
  //
  // Loads a page of transactions with the given filters applied.
  // Builds dynamic conditions based on filter values.
  // If page = 1, replaces allTransactions.
  // If page > 1, appends to allTransactions (continuation).
  // Updates totalTransactionCount, currentPage, and hasMorePages.
  // ─────────────────────────────────────────────────────────────────────────
  loadTransactionPage: async (page, filters) => {
    const { pageSize } = get();
    set({ isLoadingFiltered: true, activeFilters: filters });

    try {
      const conditions = [eq(transactions.is_deleted, 0)];

      if (filters.typeFilter !== 'all') {
        conditions.push(eq(transactions.type, filters.typeFilter));
      }

      if (filters.accountId !== null) {
        conditions.push(eq(transactions.account_id, filters.accountId));
      }

      if (filters.categoryId !== null) {
        conditions.push(eq(transactions.category_id, filters.categoryId));
      }

      if (filters.dateStart !== null) {
        conditions.push(gte(transactions.date, filters.dateStart));
      }

      if (filters.dateEnd !== null) {
        conditions.push(lte(transactions.date, filters.dateEnd));
      }

      if (filters.searchQuery.trim() !== '') {
        const query = `%${filters.searchQuery}%`;
        conditions.push(
          or(
            like(transactions.description, query) || sql`1=1`,
            like(transactions.notes, query) || sql`1=1`,
          ) as any,
        );
      }

      // Get total count
      const countResult = await db
        .select({ count: transactions.id })
        .from(transactions)
        .where(and(...conditions));
      const totalCount = countResult.length;

      // Get paginated rows
      const offset = (page - 1) * pageSize;
      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.date), desc(transactions.created_at))
        .limit(pageSize)
        .offset(offset);

      const hasMore = offset + rows.length < totalCount;

      if (page === 1) {
        set({
          allTransactions: rows,
          totalTransactionCount: totalCount,
          currentPage: page,
          hasMorePages: hasMore,
        });
      } else {
        set((state) => ({
          allTransactions: [...state.allTransactions, ...rows],
          totalTransactionCount: totalCount,
          currentPage: page,
          hasMorePages: hasMore,
        }));
      }
    } finally {
      set({ isLoadingFiltered: false });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // setFilters
  //
  // Merges new filters with activeFilters and resets to page 1.
  // Calls loadTransactionPage(1, mergedFilters) to reload data.
  // ─────────────────────────────────────────────────────────────────────────
  setFilters: async (filters) => {
    const { activeFilters } = get();
    const mergedFilters = { ...activeFilters, ...filters };
    await get().loadTransactionPage(1, mergedFilters);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // clearFilters
  //
  // Resets activeFilters to defaults and reloads from page 1.
  // ─────────────────────────────────────────────────────────────────────────
  clearFilters: async () => {
    await get().loadTransactionPage(1, DEFAULT_FILTERS);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getTransactionsByDate
  //
  // Returns all non-deleted transactions for a specific date.
  // Used by calendar view day detail.
  // ─────────────────────────────────────────────────────────────────────────
  getTransactionsByDate: async (date) => {
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.is_deleted, 0), eq(transactions.date, date)))
      .orderBy(desc(transactions.created_at));
    return rows;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getTransactionSumsByMonth
  //
  // Returns a Map where key = 'YYYY-MM-DD' date string.
  // Value = { income: sum of income txns, expense: sum of expense txns }
  // for every day in the given month that has transactions.
  // Used to populate the calendar view indicators.
  // ─────────────────────────────────────────────────────────────────────────
  getTransactionSumsByMonth: async (month, year) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Calculate last day of month
    const nextMonth = new Date(year, month, 1);
    const lastDay = new Date(nextMonth.getTime() - 1).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const rows = await db
      .select({
        date: transactions.date,
        type: transactions.type,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.is_deleted, 0),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      )
      .orderBy(transactions.date);

    const sums = new Map<string, { income: number; expense: number }>();

    for (const row of rows) {
      const existing = sums.get(row.date) || { income: 0, expense: 0 };

      if (row.type === 'income') {
        existing.income += row.amount;
      } else if (row.type === 'expense') {
        existing.expense += row.amount;
      }

      sums.set(row.date, existing);
    }

    return sums;
  },
}));

export default useTransactionStore;
