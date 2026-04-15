ALTER TABLE `users` ADD `premium_access` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `premium_expires_at` text;
--> statement-breakpoint
UPDATE `users`
SET
	`premium_access` = 1,
	`premium_expires_at` = NULL
WHERE `role` IN ('admin', 'moderator');