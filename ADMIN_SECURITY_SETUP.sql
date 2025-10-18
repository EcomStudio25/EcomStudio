-- =====================================================
-- ADMIN PANEL SECURITY ENHANCEMENTS
-- Run these queries in Supabase SQL Editor
-- =====================================================

-- 1. CREATE ADMIN LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read logs
CREATE POLICY "Admin can read logs" ON public.admin_logs
  FOR SELECT USING (public.is_admin());

-- Admin can insert logs
CREATE POLICY "Admin can insert logs" ON public.admin_logs
  FOR INSERT WITH CHECK (true); -- Allow insert from server-side

-- =====================================================
-- 2. CREATE LOGGING FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_admin_id UUID;
  v_admin_email TEXT;
  v_log_id UUID;
BEGIN
  -- Get current admin info
  v_admin_id := auth.uid();

  SELECT email INTO v_admin_email
  FROM auth.users
  WHERE id = v_admin_id;

  -- Insert log
  INSERT INTO public.admin_logs (
    admin_id,
    admin_email,
    action,
    details
  ) VALUES (
    v_admin_id,
    v_admin_email,
    p_action,
    p_details
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREATE TRIGGERS FOR AUTO LOGGING
-- =====================================================

-- Log when admin updates settings
CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.log_admin_action(
    'UPDATE_PRICE_SETTINGS',
    jsonb_build_object(
      'setting_key', NEW.setting_key,
      'old_value', OLD.setting_value,
      'new_value', NEW.setting_value
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_settings_change ON public.admin_settings;
CREATE TRIGGER trigger_log_settings_change
  AFTER UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_settings_change();

-- Log when admin adds credits manually
CREATE OR REPLACE FUNCTION public.log_credit_addition()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Only log if action is from admin (manual addition)
  IF NEW.transaction_type = 'manual_credit_addition' AND v_admin_id IS NOT NULL THEN
    PERFORM public.log_admin_action(
      'ADD_MANUAL_CREDITS',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'amount', NEW.amount,
        'transaction_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_credit_addition ON public.transactions;
CREATE TRIGGER trigger_log_credit_addition
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_credit_addition();

-- Log when admin sends notifications
CREATE OR REPLACE FUNCTION public.log_notification_send()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_notification_count INTEGER;
BEGIN
  v_admin_id := auth.uid();

  -- Only log first notification of a batch (same message, same time)
  SELECT COUNT(*) INTO v_notification_count
  FROM public.notifications
  WHERE message = NEW.message
  AND created_at >= NOW() - INTERVAL '1 second';

  IF v_notification_count = 1 AND v_admin_id IS NOT NULL THEN
    PERFORM public.log_admin_action(
      'SEND_NOTIFICATION',
      jsonb_build_object(
        'message', NEW.message,
        'message_length', LENGTH(NEW.message)
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_notification_send ON public.notifications;
CREATE TRIGGER trigger_log_notification_send
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_notification_send();

-- =====================================================
-- 4. VIEW FOR RECENT ADMIN ACTIVITIES
-- =====================================================
CREATE OR REPLACE VIEW public.admin_activity_summary AS
SELECT
  al.id,
  al.admin_email,
  al.action,
  al.details,
  al.created_at,
  CASE al.action
    WHEN 'UPDATE_PRICE_SETTINGS' THEN '⚙️ Updated Price Settings'
    WHEN 'ADD_MANUAL_CREDITS' THEN '💰 Added Manual Credits'
    WHEN 'SEND_NOTIFICATION' THEN '📢 Sent Notification'
    ELSE al.action
  END as action_display
FROM public.admin_logs al
ORDER BY al.created_at DESC
LIMIT 100;

-- Grant access to admins
GRANT SELECT ON public.admin_activity_summary TO authenticated;

-- =====================================================
-- 5. CLEANUP OLD LOGS (Optional - Run periodically)
-- =====================================================
-- Delete logs older than 90 days
-- CREATE OR REPLACE FUNCTION public.cleanup_old_admin_logs()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM public.admin_logs
--   WHERE created_at < NOW() - INTERVAL '90 days';
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check if everything is set up correctly:

-- 1. Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'admin_logs'
) as admin_logs_table_exists;

-- 2. Check function exists
SELECT EXISTS (
  SELECT FROM pg_proc
  WHERE proname = 'log_admin_action'
) as log_function_exists;

-- 3. Check triggers exist
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE 'trigger_log_%';

-- 4. View recent logs (will be empty at first)
SELECT * FROM public.admin_activity_summary LIMIT 10;

-- =====================================================
-- DONE!
-- All admin actions will now be automatically logged.
-- =====================================================
