-- Split whales:view into view_own / view_all; strip agency whale/custom-manage from chatter.
-- Chatters: own only. Everyone else with whales:view or whales:manage gets view_all.

-- Chatter: explicit own-only grant set (no manage / view_all / custom-requests agency keys)
UPDATE roles
SET permissions = '[
  "shifts:start",
  "shifts:view",
  "whales:view_own",
  "custom-requests:view",
  "rewards:view",
  "sops:view",
  "sops:sign-off",
  "sops:quiz",
  "spin-wheel:view",
  "settings:view",
  "challenges:view",
  "chatter_program:view",
  "informations:view",
  "infloww_stats:view_own",
  "fines:view"
]',
updated_at = now()
WHERE role_id = 'chatter';

-- Virtual assistant: whales:view -> whales:view_all (keep other grants)
UPDATE roles
SET permissions = replace(permissions, '"whales:view"', '"whales:view_all"'),
updated_at = now()
WHERE role_id = 'virtual_assistant'
  AND permissions LIKE '%"whales:view"%'
  AND permissions NOT LIKE '%"whales:view_all"%';

-- Admin / manager / any other role: whales:view -> whales:view_all
UPDATE roles
SET permissions = replace(permissions, '"whales:view"', '"whales:view_all"'),
updated_at = now()
WHERE role_id <> 'chatter'
  AND permissions LIKE '%"whales:view"%'
  AND permissions NOT LIKE '%"whales:view_all"%'
  AND permissions NOT LIKE '%"whales:view_own"%';

-- Ensure anyone with whales:manage also has whales:view_all (except chatter already cleaned)
UPDATE roles
SET permissions = CASE
  WHEN permissions LIKE '%"whales:view_all"%' THEN permissions
  WHEN permissions LIKE '%[%' THEN regexp_replace(permissions, '\]$', ', "whales:view_all"]')
  ELSE permissions
END,
updated_at = now()
WHERE role_id <> 'chatter'
  AND permissions LIKE '%"whales:manage"%'
  AND permissions NOT LIKE '%"whales:view_all"%';
