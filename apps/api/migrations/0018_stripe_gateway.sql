-- 0018_stripe_gateway.sql
ALTER TABLE payment_gateway_transactions
  DROP CONSTRAINT IF EXISTS payment_gateway_transactions_gateway_check;

UPDATE payment_gateway_transactions
SET gateway = 'STRIPE',
    status_message = COALESCE(status_message, 'Migrated gateway label to Stripe')
WHERE gateway <> 'STRIPE';

ALTER TABLE payment_gateway_transactions
  ADD CONSTRAINT payment_gateway_transactions_gateway_check
  CHECK (gateway = 'STRIPE');
