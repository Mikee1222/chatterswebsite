-- Infloww manual sales reassignment log
-- Source: GET /v1/transaction-perf/manual-assignment/details (organization scope)

create table if not exists infloww_sales_reassignments (
  id                      text primary key,
  transaction_id          text not null,
  transaction_perf_id     text not null default '',
  operation_type          text not null default '',
  operation_employee_id   text,
  operation_employee_name text,
  before_employee_id      text,
  before_employee_name    text,
  after_employee_id       text,
  after_employee_name     text,
  created_time            timestamptz,
  synced_at               timestamptz not null default now()
);

create index if not exists infloww_sales_reassignments_created_time_idx
  on infloww_sales_reassignments (created_time desc);

create index if not exists infloww_sales_reassignments_transaction_id_idx
  on infloww_sales_reassignments (transaction_id);
