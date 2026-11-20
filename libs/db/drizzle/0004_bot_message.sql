CREATE TABLE `bot_message` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text DEFAULT '__single_tenant__' NOT NULL,
	`chat_id` text NOT NULL,
	`message_id` integer NOT NULL,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bot_message_chat_idx` ON `bot_message` (`chat_id`,`sent_at`);