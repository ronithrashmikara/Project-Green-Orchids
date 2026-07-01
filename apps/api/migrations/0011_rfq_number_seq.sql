-- 0011_rfq_number_seq.sql
-- rfq.repository.js's nextRfqNumber() calls nextval('rfq_number_seq'), but this
-- sequence was never created (0009 added order/invoice/payment_number_seq but
-- missed rfq), so every RFQ submission 500s. Add the missing sequence.

CREATE SEQUENCE IF NOT EXISTS rfq_number_seq START 1;
