-- Add password field to users table for traditional authentication
ALTER TABLE "users" ADD COLUMN "password" TEXT;

-- Make clerkId nullable since we'll support both Clerk and traditional auth
ALTER TABLE "users" ALTER COLUMN "clerk_id" DROP NOT NULL;

-- Update the unique constraint on clerkId to allow nulls
DROP INDEX IF EXISTS "users_clerk_id_key";
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id") WHERE "clerk_id" IS NOT NULL;