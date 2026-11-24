DROP INDEX `deadline_reminder_job_uidx`;--> statement-breakpoint
ALTER TABLE `deadline_reminder` ADD `chat_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `deadline_reminder_job_chat_uidx` ON `deadline_reminder` (`organization_id`,`job_post_id`,`chat_id`);