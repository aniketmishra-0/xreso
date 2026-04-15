CREATE TABLE IF NOT EXISTS `advanced_track_resource_tags` (
	`resource_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `advanced_track_resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `advanced_track_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` integer NOT NULL,
	`topic_id` integer,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`resource_type` text DEFAULT 'link' NOT NULL,
	`content_url` text NOT NULL,
	`thumbnail_url` text,
	`premium_only` integer DEFAULT true NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`save_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `advanced_tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `advanced_track_topics`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `advanced_track_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`level` text DEFAULT 'Beginner' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `advanced_tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `advanced_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`premium` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `advanced_tracks_slug_unique` ON `advanced_tracks` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `advanced_tracks_name_unique` ON `advanced_tracks` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `advanced_track_topics_track_slug_unique` ON `advanced_track_topics` (`track_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `advanced_track_resource_tags_resource_tag_unique` ON `advanced_track_resource_tags` (`resource_id`,`tag`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `advanced_track_resources_track_idx` ON `advanced_track_resources` (`track_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `advanced_track_resources_topic_idx` ON `advanced_track_resources` (`topic_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `advanced_track_resources_status_idx` ON `advanced_track_resources` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `advanced_track_topics_track_idx` ON `advanced_track_topics` (`track_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`note_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`gradient` text,
	`note_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `note_tags` (
	`note_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`author_credit` text NOT NULL,
	`thumbnail_url` text,
	`file_url` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size_bytes` integer DEFAULT 0 NOT NULL,
	`source_url` text,
	`license_type` text DEFAULT 'CC-BY-4.0' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`bookmark_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`reporter_id` text,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`avatar` text,
	`bio` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text,
	`ip_hash` text,
	`viewed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `advanced_tracks` (`slug`, `name`, `description`, `premium`, `status`, `sort_order`)
VALUES
	('kubernetes', 'Kubernetes', 'Container orchestration, production scaling, and cluster operations.', 1, 'active', 0),
	('devops', 'DevOps', 'Automation, CI/CD, infrastructure, and delivery reliability.', 1, 'active', 1),
	('system-design', 'System Design', 'Scalable architecture patterns and system tradeoffs.', 1, 'active', 2);
--> statement-breakpoint
INSERT OR IGNORE INTO `advanced_track_topics` (`track_id`, `slug`, `name`, `description`, `level`, `sort_order`)
SELECT at.id, seed.slug, seed.name, seed.description, seed.level, seed.sort_order
FROM `advanced_tracks` at
JOIN (
	SELECT 'kubernetes' AS track_slug, 'k8s-fundamentals' AS slug, 'Cluster Fundamentals' AS name, 'Pods, deployments, and rollout strategy.' AS description, 'Beginner' AS level, 0 AS sort_order
	UNION ALL SELECT 'kubernetes', 'k8s-observability', 'Observability', 'Production logs, metrics, tracing, and probes.', 'Advanced', 1
	UNION ALL SELECT 'devops', 'linux-shell', 'Linux and Shell', 'Linux CLI, permissions, shell scripting, and process tools.', 'Beginner', 0
	UNION ALL SELECT 'devops', 'ansible-automation', 'Ansible Automation', 'Playbooks, roles, and idempotent infra tasks.', 'Intermediate', 1
	UNION ALL SELECT 'system-design', 'requirements-capacity', 'Capacity Planning', 'Estimating scale and sizing architecture choices.', 'Beginner', 0
	UNION ALL SELECT 'system-design', 'resilience-observability', 'Reliability and Observability', 'SLIs, alerts, and resilience engineering.', 'Advanced', 1
) seed ON seed.track_slug = at.slug;
