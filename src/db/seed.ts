import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { categories } from './schema';
import type * as schema from './schema';

type DB = ExpoSQLiteDatabase<typeof schema>;

export async function seedDatabase(db: DB): Promise<void> {
  const existing = await db.select().from(categories).limit(1);

  if (existing.length > 0) {
    console.log('[Seed] Already seeded — skipping');
    return;
  }

  const now = new Date().toISOString();

  const expenseCategories = [
    { name: 'Food and Dining', type: 'expense', icon_key: 'food', is_custom: 0, is_active: 1, display_order: 1, created_at: now },
    { name: 'Groceries', type: 'expense', icon_key: 'groceries', is_custom: 0, is_active: 1, display_order: 2, created_at: now },
    { name: 'Transport', type: 'expense', icon_key: 'transport', is_custom: 0, is_active: 1, display_order: 3, created_at: now },
    { name: 'Utilities', type: 'expense', icon_key: 'utilities', is_custom: 0, is_active: 1, display_order: 4, created_at: now },
    { name: 'Rent and Housing', type: 'expense', icon_key: 'rent', is_custom: 0, is_active: 1, display_order: 5, created_at: now },
    { name: 'Load and Data', type: 'expense', icon_key: 'load', is_custom: 0, is_active: 1, display_order: 6, created_at: now },
    { name: 'Health and Medicine', type: 'expense', icon_key: 'health', is_custom: 0, is_active: 1, display_order: 7, created_at: now },
    { name: 'Shopping', type: 'expense', icon_key: 'shopping', is_custom: 0, is_active: 1, display_order: 8, created_at: now },
    { name: 'Personal Care', type: 'expense', icon_key: 'personal_care', is_custom: 0, is_active: 1, display_order: 9, created_at: now },
    { name: 'Entertainment', type: 'expense', icon_key: 'entertainment', is_custom: 0, is_active: 1, display_order: 10, created_at: now },
    { name: 'Education', type: 'expense', icon_key: 'education', is_custom: 0, is_active: 1, display_order: 11, created_at: now },
    { name: 'Family Support', type: 'expense', icon_key: 'family', is_custom: 0, is_active: 1, display_order: 12, created_at: now },
    { name: 'CC Payment', type: 'expense', icon_key: 'credit_card', is_custom: 0, is_active: 1, display_order: 13, created_at: now },
    { name: 'Loan Payment', type: 'expense', icon_key: 'loan', is_custom: 0, is_active: 1, display_order: 14, created_at: now },
    { name: 'Business Expense', type: 'expense', icon_key: 'business', is_custom: 0, is_active: 1, display_order: 15, created_at: now },
    { name: 'Miscellaneous', type: 'expense', icon_key: 'misc', is_custom: 0, is_active: 1, display_order: 16, created_at: now },
  ] as const;

  const incomeCategories = [
    { name: 'Salary', type: 'income', icon_key: 'salary', is_custom: 0, is_active: 1, display_order: 1, created_at: now },
    { name: 'Freelance Income', type: 'income', icon_key: 'freelance', is_custom: 0, is_active: 1, display_order: 2, created_at: now },
    { name: 'Business Income', type: 'income', icon_key: 'business_income', is_custom: 0, is_active: 1, display_order: 3, created_at: now },
    { name: 'Lending Collection', type: 'income', icon_key: 'lending', is_custom: 0, is_active: 1, display_order: 4, created_at: now },
    { name: 'Buy and Sell Profit', type: 'income', icon_key: 'buysell', is_custom: 0, is_active: 1, display_order: 5, created_at: now },
    { name: 'Remittance Received', type: 'income', icon_key: 'remittance', is_custom: 0, is_active: 1, display_order: 6, created_at: now },
    { name: 'Investment Return', type: 'income', icon_key: 'investment', is_custom: 0, is_active: 1, display_order: 7, created_at: now },
    { name: 'Other Income', type: 'income', icon_key: 'other_income', is_custom: 0, is_active: 1, display_order: 8, created_at: now },
  ] as const;

  try {
    await db.insert(categories).values([...expenseCategories, ...incomeCategories]);
    console.log('[Seed] Categories seeded successfully');
  } catch (error) {
    console.error('[Seed] Seeding failed:', error);
    throw error;
  }
}

export default seedDatabase;