-- 0010_email_verify_otp.sql
-- Email verification is switching from a link-token flow to an OTP-code flow.
-- The `users.status` CHECK constraint never had a PENDING value, which is why
-- `createUser` previously hardcoded status='ACTIVE' at registration and the
-- verification gate was cosmetic. Add PENDING so a new account genuinely
-- starts unverified and login can block it until the OTP is confirmed.

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%ACTIVE%LOCKED%SUSPENDED%INACTIVE%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('PENDING','ACTIVE','LOCKED','SUSPENDED','INACTIVE'));
