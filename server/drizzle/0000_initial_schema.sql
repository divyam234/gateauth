CREATE SCHEMA "gatehouse";

CREATE TABLE "gatehouse"."access_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"allowed_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"allowed_email_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"allowed_ip_cidrs" text[] DEFAULT '{}'::text[] NOT NULL,
	"require_mfa" boolean DEFAULT false NOT NULL,
	"session_max_age_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_policies_session_max_age_seconds_check" CHECK ("gatehouse"."access_policies"."session_max_age_seconds" IS NULL OR "gatehouse"."access_policies"."session_max_age_seconds" >= 60)
);

CREATE TABLE "gatehouse"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);

CREATE TABLE "gatehouse"."apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"configId" text NOT NULL,
	"name" text,
	"start" text,
	"referenceId" text NOT NULL,
	"prefix" text,
	"key" text NOT NULL,
	"refillInterval" integer,
	"refillAmount" integer,
	"lastRefillAt" timestamp with time zone,
	"enabled" boolean,
	"rateLimitEnabled" boolean,
	"rateLimitTimeWindow" integer,
	"rateLimitMax" integer,
	"requestCount" integer,
	"remaining" integer,
	"lastRequest" timestamp with time zone,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"permissions" text,
	"metadata" text
);

CREATE TABLE "gatehouse"."application_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"hostname" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "gatehouse"."application_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"path_pattern" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_routes_application_id_path_pattern_unique" UNIQUE("application_id","path_pattern")
);

CREATE TABLE "gatehouse"."application_user_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"user_id" text NOT NULL,
	"effect" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_user_grants_application_id_user_id_unique" UNIQUE("application_id","user_id"),
	CONSTRAINT "application_user_grants_effect_check" CHECK ("gatehouse"."application_user_grants"."effect" IN ('allow', 'deny'))
);

CREATE TABLE "gatehouse"."applications" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon_url" text,
	"upstream_url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"health_check_path" text DEFAULT '/' NOT NULL,
	"last_health_status" text DEFAULT 'unknown' NOT NULL,
	"last_health_check_at" timestamp with time zone,
	"last_health_latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_last_health_status_check" CHECK ("gatehouse"."applications"."last_health_status" IN ('unknown', 'healthy', 'unhealthy'))
);

CREATE TABLE "gatehouse"."audit_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"application_id" text,
	"outcome" text DEFAULT 'success' NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"request_id" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"before_data" jsonb,
	"after_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_outcome_check" CHECK ("gatehouse"."audit_events"."outcome" IN ('success', 'failure', 'denied')),
	CONSTRAINT "audit_events_severity_check" CHECK ("gatehouse"."audit_events"."severity" IN ('info', 'warning', 'critical'))
);

CREATE TABLE "gatehouse"."auth_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "gatehouse"."passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"publicKey" text NOT NULL,
	"userId" text NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"createdAt" timestamp with time zone,
	"aaguid" text
);

CREATE TABLE "gatehouse"."rateLimit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"lastRequest" bigint NOT NULL,
	CONSTRAINT "rateLimit_key_unique" UNIQUE("key")
);

CREATE TABLE "gatehouse"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	"authMethod" text DEFAULT 'unknown' NOT NULL,
	"mfaVerifiedAt" timestamp with time zone,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "gatehouse"."twoFactor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" text NOT NULL,
	"verified" boolean
);

CREATE TABLE "gatehouse"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"twoFactorEnabled" boolean DEFAULT false,
	"role" text,
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "gatehouse"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "gatehouse"."webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"audit_event_id" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"response_status" integer,
	"response_body" text,
	"delivered_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "gatehouse"."webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret_ciphertext" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"events" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "gatehouse"."access_policies" ADD CONSTRAINT "access_policies_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "gatehouse"."applications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "gatehouse"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."application_domains" ADD CONSTRAINT "application_domains_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "gatehouse"."applications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."application_routes" ADD CONSTRAINT "application_routes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "gatehouse"."applications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."application_user_grants" ADD CONSTRAINT "application_user_grants_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "gatehouse"."applications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."application_user_grants" ADD CONSTRAINT "application_user_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "gatehouse"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."application_user_grants" ADD CONSTRAINT "application_user_grants_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "gatehouse"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "gatehouse"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "gatehouse"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "gatehouse"."audit_events" ADD CONSTRAINT "audit_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "gatehouse"."applications"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "gatehouse"."auth_settings" ADD CONSTRAINT "auth_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "gatehouse"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "gatehouse"."passkey" ADD CONSTRAINT "passkey_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "gatehouse"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "gatehouse"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."twoFactor" ADD CONSTRAINT "twoFactor_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "gatehouse"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "gatehouse"."webhooks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gatehouse"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_audit_event_id_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "gatehouse"."audit_events"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "access_policies_application_id_priority_idx" ON "gatehouse"."access_policies" USING btree ("application_id","enabled","priority");
CREATE INDEX "account_userId_idx" ON "gatehouse"."account" USING btree ("userId");
CREATE INDEX "apikey_configId_idx" ON "gatehouse"."apikey" USING btree ("configId");
CREATE INDEX "apikey_referenceId_idx" ON "gatehouse"."apikey" USING btree ("referenceId");
CREATE INDEX "apikey_key_idx" ON "gatehouse"."apikey" USING btree ("key");
CREATE UNIQUE INDEX "application_domains_hostname_unique" ON "gatehouse"."application_domains" USING btree ("hostname");
CREATE INDEX "application_domains_application_id_idx" ON "gatehouse"."application_domains" USING btree ("application_id");
CREATE INDEX "application_routes_application_id_idx" ON "gatehouse"."application_routes" USING btree ("application_id");
CREATE INDEX "application_user_grants_user_id_idx" ON "gatehouse"."application_user_grants" USING btree ("user_id");
CREATE UNIQUE INDEX "applications_slug_unique" ON "gatehouse"."applications" USING btree ("slug");
CREATE INDEX "audit_events_created_at_idx" ON "gatehouse"."audit_events" USING btree ("created_at" DESC NULLS LAST);
CREATE INDEX "audit_events_actor_user_id_idx" ON "gatehouse"."audit_events" USING btree ("actor_user_id");
CREATE INDEX "audit_events_application_id_idx" ON "gatehouse"."audit_events" USING btree ("application_id");
CREATE INDEX "audit_events_action_idx" ON "gatehouse"."audit_events" USING btree ("action");
CREATE INDEX "audit_events_outcome_severity_idx" ON "gatehouse"."audit_events" USING btree ("outcome","severity");
CREATE INDEX "audit_events_metadata_gin_idx" ON "gatehouse"."audit_events" USING gin ("metadata");
CREATE INDEX "passkey_userId_idx" ON "gatehouse"."passkey" USING btree ("userId");
CREATE INDEX "passkey_credentialID_idx" ON "gatehouse"."passkey" USING btree ("credentialID");
CREATE INDEX "session_userId_idx" ON "gatehouse"."session" USING btree ("userId");
CREATE INDEX "session_mfa_verified_at_idx" ON "gatehouse"."session" USING btree ("mfaVerifiedAt") WHERE "gatehouse"."session"."mfaVerifiedAt" IS NOT NULL;
CREATE INDEX "twoFactor_secret_idx" ON "gatehouse"."twoFactor" USING btree ("secret");
CREATE INDEX "twoFactor_userId_idx" ON "gatehouse"."twoFactor" USING btree ("userId");
CREATE INDEX "verification_identifier_idx" ON "gatehouse"."verification" USING btree ("identifier");
CREATE INDEX "webhook_deliveries_retry_idx" ON "gatehouse"."webhook_deliveries" USING btree ("next_attempt_at") WHERE "gatehouse"."webhook_deliveries"."delivered_at" IS NULL;
