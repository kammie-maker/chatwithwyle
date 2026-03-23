import { sql } from "@vercel/postgres";

async function migrate() {
  console.log("Running Wyle database migration...");

  // conversations table
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New conversation',
      mode TEXT NOT NULL DEFAULT 'sales',
      interaction_type TEXT NOT NULL DEFAULT 'client',
      pinned BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ conversations table created");

  // messages table
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      interaction_mode TEXT DEFAULT 'client',
      sections_expanded TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ messages table created");

  // user_preferences table
  await sql`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      default_mode TEXT NOT NULL DEFAULT 'sales',
      default_interaction TEXT NOT NULL DEFAULT 'client',
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ user_preferences table created");

  // users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'pending',
      default_mode TEXT DEFAULT 'sales',
      default_interaction TEXT DEFAULT 'client',
      last_login TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ users table created");

  // Add tour_completed column (safe to run multiple times)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false`;
  console.log("✓ tour_completed column added");

  // indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(user_id, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin(to_tsvector('english', content))`;
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`;
  console.log("✓ indexes created");

  console.log("Migration complete.");
}

migrate().then(() => process.exit(0)).catch(err => { console.error("Migration failed:", err); process.exit(1); });
