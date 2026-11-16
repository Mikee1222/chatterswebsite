-- Non-destructive annotated mistake screenshots.
-- screenshot_annotated[i] = durable sb:// token for flattened annotated PNG of screenshot[i].
-- Empty string / missing slot = not annotated. Original screenshot[] is never modified.
-- RLS unchanged (service-role only). Apply manually after review — do not auto-apply.

alter table public.chatter_mistakes
  add column if not exists screenshot_annotated text[] not null default '{}';
