CREATE TABLE `cooking_days` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`date` text NOT NULL,
	`answers` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
