export type OnboardingStackParamList = {
  Welcome: undefined;
  PersonaSelect: undefined;
  AddWallet: { isFirstWallet: boolean };
  AddMoreWallets: undefined;
  FirstDashboard: undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Wallets: undefined;
  Log: undefined;
  Plan: undefined;
  More: undefined;
};

export type WalletStackParamList = {
  WalletList: undefined;
  WalletDetail: { accountId: number };
  AddWallet: undefined;
  EditWallet: { accountId: number };
  Transfer: { fromAccountId?: number };
  TransactionList: { accountId: number };
};

export type LogStackParamList = {
  QuickLog: { prefillCategoryId?: number; prefillAccountId?: number };
  BatchLog: undefined;
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: number };
  CalendarView: undefined;
};

export type PlanStackParamList = {
  BudgetOverview: undefined;
  BudgetCategoryDetail: { categoryId: number; month: number; year: number };
  ObligationList: undefined;
  ObligationDetail: { obligationId: number };
  AddObligation: undefined;
  SavingsGoalList: undefined;
  AddSavingsGoal: undefined;
  RecurringRules: undefined;
  AddRecurringRule: undefined;
};

export type MoreStackParamList = {
  Settings: undefined;
  NotificationSettings: undefined;
  BackupRestore: undefined;
  DataExport: undefined;
  About: undefined;
  ModuleActivation: undefined;
};

export type ModuleStackParamList = {
  LendingDashboard: undefined;
  BorrowerDetail: { borrowerId: number };
  AddBorrower: undefined;
  LoanDetail: { loanId: number };
  AddLoan: { borrowerId?: number };
  LogCollection: { loanId: number };
  PaluwaganGroup: { groupId: number };
  BuySellLedger: undefined;
  UtangTracker: undefined;
};

export type RootStackParamList = OnboardingStackParamList & RootTabParamList;