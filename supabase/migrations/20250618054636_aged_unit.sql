/*
  # Fix Authentication System - Final Clean Migration

  1. Changes
    - Drop all existing conflicting policies and functions
    - Create clean authentication system that works with both MetaMask and email users
    - Fix RLS policies to work with actual authentication flow
    - Remove unused tables and functions

  2. Security
    - Proper wallet-based authentication
    - Clean RLS policies
    - Secure message and conversation access
*/

-- Drop all existing policies and functions to start completely fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Drop unused tables
DROP TABLE IF EXISTS signals CASCADE;

-- Drop all existing functions
DROP FUNCTION IF EXISTS get_user_wallet_address() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_on_message() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_last_message() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_signals() CASCADE;
DROP FUNCTION IF EXISTS normalize_address(text) CASCADE;

-- Create the correct authentication function
CREATE OR REPLACE FUNCTION get_user_wallet_address()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- For MetaMask users: wallet address is stored as the user ID
    CASE 
      WHEN auth.email() LIKE '%@kraken.web3' THEN split_part(auth.email(), '@', 1)
      ELSE auth.uid()::text
    END
  );
$$;

-- Ensure tables have correct structure
ALTER TABLE profiles 
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN bio SET DEFAULT '',
  ALTER COLUMN avatar_url SET DEFAULT '';

ALTER TABLE conversations
  ALTER COLUMN last_message SET DEFAULT '',
  ALTER COLUMN group_name SET DEFAULT '',
  ALTER COLUMN group_avatar SET DEFAULT '';

ALTER TABLE messages
  ALTER COLUMN status SET DEFAULT 'sent',
  ALTER COLUMN error SET DEFAULT '',
  ALTER COLUMN retries SET DEFAULT 0,
  ALTER COLUMN encrypted SET DEFAULT false;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Create clean, working policies for profiles
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_policy"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (address = get_user_wallet_address());

CREATE POLICY "profiles_update_policy"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (address = get_user_wallet_address())
  WITH CHECK (address = get_user_wallet_address());

-- Create clean, working policies for conversations
CREATE POLICY "conversations_select_policy"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (get_user_wallet_address() = ANY(participants));

CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (get_user_wallet_address() = ANY(participants));

CREATE POLICY "conversations_update_policy"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (get_user_wallet_address() = ANY(participants))
  WITH CHECK (get_user_wallet_address() = ANY(participants));

-- Create clean, working policies for messages
CREATE POLICY "messages_select_policy"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    get_user_wallet_address() = sender OR 
    get_user_wallet_address() = receiver
  );

CREATE POLICY "messages_insert_policy"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (get_user_wallet_address() = sender);

CREATE POLICY "messages_update_policy"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (get_user_wallet_address() = sender)
  WITH CHECK (get_user_wallet_address() = sender);

-- Create clean, working policies for attachments
CREATE POLICY "attachments_select_policy"
  ON attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = attachments.message_id
      AND get_user_wallet_address() = ANY(c.participants)
    )
  );

CREATE POLICY "attachments_insert_policy"
  ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = attachments.message_id
      AND get_user_wallet_address() = ANY(c.participants)
    )
  );

-- Create improved trigger functions
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
  conv_id uuid;
BEGIN
  -- Find or create conversation
  IF NEW.conversation_id IS NULL THEN
    -- Try to find existing conversation between sender and receiver
    SELECT id INTO conv_id
    FROM conversations
    WHERE participants @> ARRAY[NEW.sender] 
      AND participants @> ARRAY[NEW.receiver]
      AND array_length(participants, 1) = 2
    LIMIT 1;
    
    -- If no conversation exists, create one
    IF conv_id IS NULL THEN
      INSERT INTO conversations (participants, last_message, last_message_time, is_group)
      VALUES (ARRAY[NEW.sender, NEW.receiver], NEW.content, NEW.created_at, false)
      RETURNING id INTO conv_id;
    END IF;
    
    NEW.conversation_id = conv_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message = NEW.content,
    last_message_time = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
DROP TRIGGER IF EXISTS messages_conversation_trigger ON messages;
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON messages;

CREATE TRIGGER messages_conversation_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Ensure storage bucket exists with proper policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Clean storage policies
DROP POLICY IF EXISTS "attachments_bucket_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_bucket_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_bucket_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_bucket_delete_policy" ON storage.objects;

CREATE POLICY "attachments_bucket_select_policy"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "attachments_bucket_insert_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "attachments_bucket_update_policy"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "attachments_bucket_delete_policy"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');