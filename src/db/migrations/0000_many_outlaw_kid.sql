CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`category` text DEFAULT 'personal' NOT NULL,
	`wallet_key` text,
	`starting_balance` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'PHP' NOT NULL,
	`icon_key` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `borrowers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact` text,
	`referrer_id` integer,
	`referrer_share_pct` real,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`referrer_id`) REFERENCES `borrowers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`limit_amount` real NOT NULL,
	`rollover_enabled` integer DEFAULT 0 NOT NULL,
	`rollover_amount` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_budget_category_month_year` ON `budgets` (`category_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `buysell_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`buy_price` real NOT NULL,
	`sell_price` real,
	`buy_date` text NOT NULL,
	`sell_date` text,
	`profit` real,
	`linked_transaction_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`icon_key` text,
	`color_key` text,
	`is_custom` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loan_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_id` integer NOT NULL,
	`scheduled_date` text NOT NULL,
	`amount_due` real NOT NULL,
	`interest_portion` real DEFAULT 0 NOT NULL,
	`principal_portion` real DEFAULT 0 NOT NULL,
	`is_paid` integer DEFAULT 0 NOT NULL,
	`paid_date` text,
	`paid_amount` real,
	`linked_transaction_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_loanpay_loan_date` ON `loan_payments` (`loan_id`,`scheduled_date`,`is_paid`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_code` text NOT NULL,
	`borrower_id` integer NOT NULL,
	`principal` real NOT NULL,
	`interest_rate` real NOT NULL,
	`term_months` integer,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`funding_obligation_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`borrower_id`) REFERENCES `borrowers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`funding_obligation_id`) REFERENCES `obligations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loans_loan_code_unique` ON `loans` (`loan_code`);--> statement-breakpoint
CREATE TABLE `obligation_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`obligation_id` integer NOT NULL,
	`scheduled_date` text NOT NULL,
	`amount_due` real NOT NULL,
	`amount_paid` real,
	`paid_date` text,
	`is_paid` integer DEFAULT 0 NOT NULL,
	`linked_transaction_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`obligation_id`) REFERENCES `obligations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_obpay_obligation_date` ON `obligation_payments` (`obligation_id`,`scheduled_date`,`is_paid`);--> statement-breakpoint
CREATE TABLE `obligations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`principal_amount` real,
	`interest_rate` real,
	`monthly_payment` real NOT NULL,
	`start_date` text,
	`end_date` text,
	`next_due_date` text NOT NULL,
	`payment_frequency` text DEFAULT 'monthly' NOT NULL,
	`total_payments` integer,
	`payments_made` integer DEFAULT 0 NOT NULL,
	`current_balance` real,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paluwagan_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contribution_amount` real NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`total_members` integer NOT NULL,
	`user_role` text DEFAULT 'participant' NOT NULL,
	`start_date` text NOT NULL,
	`user_turn_position` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`category_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`amount` real NOT NULL,
	`frequency` text NOT NULL,
	`next_due_date` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `savings_contributions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`linked_transaction_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_amount` real NOT NULL,
	`target_date` text,
	`linked_account_id` integer,
	`icon_key` text,
	`is_complete` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`linked_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`category_id` integer,
	`account_id` integer NOT NULL,
	`destination_account_id` integer,
	`amount` real NOT NULL,
	`description` text,
	`notes` text,
	`reference_id` text,
	`entry_mode` text DEFAULT 'realtime' NOT NULL,
	`batch_period_start` text,
	`batch_period_end` text,
	`is_deleted` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_compound` ON `transactions` (`account_id`,`date`,`type`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_transactions_reference_id` ON `transactions` (`reference_id`);--> statement-breakpoint
CREATE TABLE `user_profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`income_type` text DEFAULT 'irregular' NOT NULL,
	`onboarding_done` integer DEFAULT 0 NOT NULL,
	`privacy_mode` integer DEFAULT 0 NOT NULL,
	`preferred_currency` text DEFAULT 'PHP' NOT NULL,
	`preferred_locale` text DEFAULT 'en-PH' NOT NULL,
	`payday_date` integer,
	`app_version` text,
	`notif_due_dates` integer DEFAULT 1 NOT NULL,
	`notif_budget_warn` integer DEFAULT 1 NOT NULL,
	`notif_weekly_sum` integer DEFAULT 1 NOT NULL,
	`notif_daily_log` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
