ALTER TABLE "Restaurant" ADD COLUMN "branding" JSONB, ADD COLUMN "brandingPromptDismissed" BOOLEAN NOT NULL DEFAULT false;
-- Preserve the established pilot appearance without prompting it again.
UPDATE "Restaurant" SET "brandingPromptDismissed" = true WHERE slug = 'birria-el-cachanilla';
