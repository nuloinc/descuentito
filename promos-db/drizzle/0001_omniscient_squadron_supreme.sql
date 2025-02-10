CREATE TABLE `promotions` (
	`source` text NOT NULL,
	`json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DROP TABLE `foo`;