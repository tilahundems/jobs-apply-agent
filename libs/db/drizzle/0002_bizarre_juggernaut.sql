CREATE TABLE `deadline_reminder` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text DEFAULT '__single_tenant__' NOT NULL,
	`job_post_id` text NOT NULL,
	`days_left` integer NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`job_post_id`) REFERENCES `job_post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deadline_reminder_job_uidx` ON `deadline_reminder` (`organization_id`,`job_post_id`);