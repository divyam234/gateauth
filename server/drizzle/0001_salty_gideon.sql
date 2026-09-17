ALTER TABLE "auth"."twoFactor" ADD COLUMN "failedVerificationCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "auth"."twoFactor" ADD COLUMN "lockedUntil" timestamp with time zone;