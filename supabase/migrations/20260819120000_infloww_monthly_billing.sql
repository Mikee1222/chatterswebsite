-- infloww_monthly_billing: agency-level monthly invoice data from Infloww
-- Synced once daily via /v1/invoice-data/monthly-billing (10 QPM rate limit).
create table if not exists infloww_monthly_billing (
  billing_id       text        primary key,
  invoice_id       text,
  billing_period   text        not null,  -- yyyy-MM e.g. "2026-01"
  currency         text        not null default 'USD',
  subscription     numeric(14,4) not null default 0,
  discount         numeric(14,4) not null default 0,
  igic             numeric(14,4) not null default 0,
  total            numeric(14,4) not null default 0,
  deductions       numeric(14,4) not null default 0,
  balance_due      numeric(14,4) not null default 0,
  paid             numeric(14,4) not null default 0,
  pending          numeric(14,4) not null default 0,
  synced_at        timestamptz  not null default now()
);

create index if not exists infloww_monthly_billing_period_idx
  on infloww_monthly_billing (billing_period desc);
