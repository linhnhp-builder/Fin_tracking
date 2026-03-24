CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`intent` enum('RECORD','QUERY','MARKET','UNCLEAR'),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_prompt_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptKey` varchar(100) NOT NULL,
	`promptBody` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`isActive` boolean DEFAULT true,
	`changeNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` varchar(320),
	CONSTRAINT `ai_prompt_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`amount` decimal(15,0) NOT NULL,
	`spent` decimal(15,0) DEFAULT '0',
	`period` enum('daily','weekly','monthly','yearly') DEFAULT 'monthly',
	`colorStatus` enum('green','yellow','orange','red') DEFAULT 'green',
	`pctUsed` decimal(5,2) DEFAULT '0',
	`periodStart` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_limits_categoryId_unique` UNIQUE(`categoryId`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`icon` varchar(10) DEFAULT '💰',
	`colorHex` varchar(7) DEFAULT '#6B7280',
	`isTemplate` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	`isDeleted` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `investment_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`investmentId` int NOT NULL,
	`userId` int NOT NULL,
	`txType` enum('buy','sell','interest','withdrawal') NOT NULL,
	`quantity` decimal(15,4),
	`pricePerUnit` decimal(15,0),
	`amount` decimal(15,0) NOT NULL,
	`note` text,
	`txDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `investment_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `investments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`assetType` enum('gold','silver','savings','lending') NOT NULL,
	`quantity` decimal(15,4) DEFAULT '0',
	`unit` varchar(20) DEFAULT 'gram',
	`avgCost` decimal(15,0) DEFAULT '0',
	`totalInvested` decimal(15,0) DEFAULT '0',
	`status` enum('holding','sold','matured') DEFAULT 'holding',
	`metadata` json,
	`isDeleted` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetType` enum('gold','silver') NOT NULL,
	`source` varchar(50) DEFAULT 'SJC',
	`buyPrice` decimal(15,0),
	`sellPrice` decimal(15,0),
	`unit` varchar(20) DEFAULT 'luong',
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`categoryId` int NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`amount` decimal(15,0) NOT NULL,
	`amountDisplay` varchar(30) NOT NULL,
	`note` text,
	`locationName` varchar(200),
	`transactionDate` date NOT NULL,
	`source` enum('ai_chat','manual_ui','recurring') DEFAULT 'manual_ui',
	`aiRawInput` text,
	`isDeleted` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_conv_userId_idx` ON `ai_conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `ai_conv_sessionId_idx` ON `ai_conversations` (`sessionId`);--> statement-breakpoint
CREATE INDEX `ai_prompt_key_idx` ON `ai_prompt_configs` (`promptKey`,`isActive`);--> statement-breakpoint
CREATE INDEX `categories_userId_idx` ON `categories` (`userId`);--> statement-breakpoint
CREATE INDEX `inv_tx_investmentId_idx` ON `investment_transactions` (`investmentId`);--> statement-breakpoint
CREATE INDEX `investments_userId_idx` ON `investments` (`userId`);--> statement-breakpoint
CREATE INDEX `price_snapshots_asset_idx` ON `price_snapshots` (`assetType`,`fetchedAt`);--> statement-breakpoint
CREATE INDEX `transactions_userId_idx` ON `transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `transactions_categoryId_idx` ON `transactions` (`categoryId`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`transactionDate`);