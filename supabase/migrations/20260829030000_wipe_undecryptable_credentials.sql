-- Wipe Password Library ciphertext encrypted with a lost key (CREDENTIALS_ENCRYPTION_KEY rotation).
-- Applied to production 2026-08-29: 107 credential_entries + 171 credential_access_log rows removed.
-- Hire credentials: none stored (0 encrypted_hire_password rows).

DELETE FROM public.credential_access_log;
DELETE FROM public.credential_entries;
