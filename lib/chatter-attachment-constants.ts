/**
 * Max screenshot size for rebill / tip / extra-revenue / VA phase-item flows.
 * Aligned with client payment-proof uploads (`lib/client-proof-upload.ts` = 10MB).
 * Storage bucket `attachments` allows 50MB; this is the app-level cap.
 */
export const CHATTER_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const CHATTER_ATTACHMENT_MAX_MB = CHATTER_ATTACHMENT_MAX_BYTES / (1024 * 1024);
