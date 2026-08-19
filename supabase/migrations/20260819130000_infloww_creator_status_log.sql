-- infloww_creator_status_log: creator connection/bind/2FA status change history
-- from GET /v1/creator/status-change-log. Data available from 2026-06-01 onwards.

create table if not exists infloww_creator_status_log (
  id                     text        primary key,
  creator_infloww_id     text        not null,
  model_id               uuid        references modelss(id) on delete set null,
  status_before          text        not null default '',
  status_after           text        not null default '',
  operation_time         timestamptz not null,
  operation_employee_id  text,
  operation_employee_name text,
  synced_at              timestamptz not null default now()
);

create index if not exists infloww_creator_status_log_creator_idx
  on infloww_creator_status_log (creator_infloww_id, operation_time desc);

create index if not exists infloww_creator_status_log_model_idx
  on infloww_creator_status_log (model_id, operation_time desc);

create index if not exists infloww_creator_status_log_time_idx
  on infloww_creator_status_log (operation_time desc);
