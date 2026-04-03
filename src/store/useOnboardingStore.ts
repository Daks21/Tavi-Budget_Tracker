import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IncomeType = 'regular' | 'irregular';

export type AccountType =
  | 'cash'
  | 'ewallet'
  | 'bank'
  | 'credit_card'
  | 'virtual_fund';

export interface OnboardingWallet {
  walletKey: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  iconKey: string;
}

// ---------------------------------------------------------------------------
// State and actions shape
// ---------------------------------------------------------------------------

interface OnboardingState {
  incomeType: IncomeType | null;
  walletsAdded: OnboardingWallet[];
  currentStep: number;

  setIncomeType: (type: IncomeType) => void;
  addWallet: (wallet: OnboardingWallet) => void;
  removeWallet: (walletKey: string) => void;
  setCurrentStep: (step: number) => void;
  resetOnboarding: () => void;
}

// ---------------------------------------------------------------------------
// Initial state (extracted so resetOnboarding can reuse it cleanly)
// ---------------------------------------------------------------------------

const initialState = {
  incomeType: null as IncomeType | null,
  walletsAdded: [] as OnboardingWallet[],
  currentStep: 1,
};

// ---------------------------------------------------------------------------
// Store
// No persist — state is transient. If the app is killed mid-onboarding,
// the user restarts onboarding from Screen 1. This is intentional.
// ---------------------------------------------------------------------------

const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setIncomeType: (type) =>
    set({ incomeType: type }),

  addWallet: (wallet) =>
    set((state) => ({
      walletsAdded: [...state.walletsAdded, wallet],
    })),

  removeWallet: (walletKey) =>
    set((state) => ({
      walletsAdded: state.walletsAdded.filter(
        (w) => w.walletKey !== walletKey
      ),
    })),

  setCurrentStep: (step) =>
    set({ currentStep: step }),

  resetOnboarding: () =>
    set({ ...initialState }),
}));

export default useOnboardingStore;