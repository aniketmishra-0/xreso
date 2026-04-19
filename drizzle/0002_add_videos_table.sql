-- Create videos table
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`author_credit` text NOT NULL,
	`video_url` text NOT NULL,
	`video_type` text DEFAULT 'youtube' NOT NULL,
	`video_id` text NOT NULL,
	`thumbnail_url` text,
	`duration` text,
	`license_type` text DEFAULT 'CC-BY-4.0' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
);

-- Create index for faster queries
CREATE INDEX `videos_category_id_idx` ON `videos`(`category_id`);
CREATE INDEX `videos_author_id_idx` ON `videos`(`author_id`);
CREATE INDEX `videos_status_idx` ON `videos`(`status`);
CREATE INDEX `videos_created_at_idx` ON `videos`(`created_at`);
