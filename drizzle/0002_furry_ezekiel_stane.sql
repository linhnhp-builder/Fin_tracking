ALTER TABLE `budget_limits` MODIFY COLUMN `periodStart` varchar(10);--> statement-breakpoint
ALTER TABLE `investment_transactions` MODIFY COLUMN `txDate` varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `transactionDate` varchar(10) NOT NULL;