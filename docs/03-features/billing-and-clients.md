# Billing & Clients

## Client portal

External clients log in with role `client`.

| | |
|--|--|
| **Routes** | `/client`, `/client/payments`, `/client/invoices`, `/client/content`, `/client/calendar`, etc. |
| **Permissions** | `payments:view`, `payments:submit`, `clients:view` |
| **Services** | `services/client-portal.ts`, `services/client-billing.ts` |

### Client tables

From `services/client-billing.ts` / `services/client-portal.ts`:

| Table | Purpose |
|-------|---------|
| `clients` | Client companies |
| `client_models` | Models under each client contract |
| `billing_cycles` | Weekly/monthly billing periods |
| `billing_cycle_revenues` | Per-model revenue lines per cycle |
| `payment_submissions` | Client payment proofs + review status |

**Important:** Revenue rows link to **`modelss`**, not legacy `models` table.

---

## Admin billing

| | |
|--|--|
| **Routes** | `/admin/billing`, `/admin/rebills-tips`, `/admin/submissions`, `/admin/partnership` |
| **Permissions** | `billing:view`, `billing:manage`, `payments:view`, `payments:manage`, `clients:view` |
| **Services** | `services/client-billing.ts`, `services/client-billing-notifications.ts` |

### Billing cycle flow

1. Admin creates/announces cycle → `billing_cycle_announced` notification
2. Client submits payment proof (Vercel Blob upload via `/api/client/upload-proof`)
3. Admin reviews at `/admin/submissions`
4. Reminders: `billing_due_reminder`, overdue status on revenue rows

### Earnings (admin-only)

| | |
|--|--|
| **Routes** | `/admin/earnings`, `/admin/earnings-config` (hidden from nav; route still works) |
| **Permissions** | `earnings:view`, `earnings:config` |
| **Service** | `services/earnings-config.ts` |
| **Table** | `earnings_config` |

---

## Payment methods & expense requests

| | |
|--|--|
| **Routes** | `/admin/payment-methods`, `/admin/expense-requests` |
| **Permission** | `payments:manage` |
| **Tables** | Model payment methods (see `scripts/setup-model-payment-fields.ts`), `model_expense_requests` |

---

## Partnership view

| | |
|--|--|
| **Route** | `/admin/partnership` |
| **Permission** | `clients:view` |

Cross-client analytics / partnership reporting.

---

## Fines & bonuses

Shared across roles at `/fines-bonuses`.

| | |
|--|--|
| **Service** | `services/fines-bonuses.ts` |
| **Table** | `fines_and_bonuses` |
| **Permissions** | `fines:view`, `fines:manage`, `fines:review` |

Sources: `chatter_submission`, `admin`, `spin_wheel`. Spin wheel bonuses use `spin_wheel_spins.created_at` for month attribution.

Review workflow requires `fines:review` for admin approval.

---

## Monthly targets

Admin home dashboard targets.

| | |
|--|--|
| **Service** | `services/monthly-targets.ts` |
| **Table** | `monthly_targets` |
| **Actions** | `app/actions/monthly-targets.ts` |

---

## Gotchas

1. **Payment proof uploads** require `BLOB_READ_WRITE_TOKEN` on Vercel
2. **Billing model links** must point to `modelss` records
3. **`revalidatePath`** after payment review must include client portal routes
4. Client session uses same JWT auth — role slug must be exactly `client`

---

## Related

- [04-integrations.md](../04-integrations.md) — Vercel Blob
- [models-and-content.md](./models-and-content.md) — client_models linkage
