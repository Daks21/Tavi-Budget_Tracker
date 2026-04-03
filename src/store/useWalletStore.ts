// src/store/useWalletStore.ts

import { create } from 'zustand';
import { asc, eq } from 'drizzle-orm';

import db from '@/db';
import { accounts, userProfile, type Account } from '@/db/schema';

interface WalletState {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
  privacyMode: boolean;
}

interface WalletActions {
  loadAccounts: () => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  initializePrivacyMode: (value: boolean) => void;
  setPrivacyMode: (value: boolean) => Promise<void>;
  togglePrivacyMode: () => Promise<void>;
  reloadAccounts: () => Promise<void>;
}

type WalletStore = WalletState & WalletActions;

const useWalletStore = create<WalletStore>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,
  privacyMode: false,

  loadAccounts: async () => {
    set({ isLoading: true, error: null });

    try {
      const [accountRows, profileRows] = await Promise.all([
        db
          .select()
          .from(accounts)
          .where(eq(accounts.is_active, 1))
          .orderBy(asc(accounts.display_order)),
        db.select().from(userProfile).limit(1),
      ]);

      const privacyMode =
        profileRows.length > 0 ? profileRows[0].privacy_mode === 1 : false;

      set({
        accounts: accountRows,
        privacyMode,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load accounts.';

      set({
        isLoading: false,
        error: message,
      });
    }
  },

  getAccountById: (id: number) => {
    return get().accounts.find((account) => account.id === id);
  },

  initializePrivacyMode: (value: boolean) => {
    set({ privacyMode: value });
  },

  setPrivacyMode: async (value: boolean) => {
    const previous = get().privacyMode;
    set({ privacyMode: value });

    try {
      const profileRows = await db.select().from(userProfile).limit(1);

      if (profileRows.length === 0) {
        throw new Error('User profile not found.');
      }

      await db
        .update(userProfile)
        .set({
          privacy_mode: value ? 1 : 0,
          updated_at: new Date().toISOString(),
        })
        .where(eq(userProfile.id, profileRows[0].id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update privacy mode.';

      set({
        privacyMode: previous,
        error: message,
      });
    }
  },

  togglePrivacyMode: async () => {
    const current = get().privacyMode;
    await get().setPrivacyMode(!current);
  },

  reloadAccounts: async () => {
    await get().loadAccounts();
  },
}));

export default useWalletStore;