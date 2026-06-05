/** Client portal Airtable record types (B2B billing). */

export type ClientStatus = "active" | "inactive" | "suspended";

export type ClientRecord = {
  id: string;
  company_name: string;
  display_name: string;
  email: string;
  status: ClientStatus;
  client_percentage?: number;
  net_profit_goal?: number;
};

export type BillingCycleKind = "chatting_weekly" | "crm_monthly";

export type BillingCycleStatus =
  | "draft"
  | "announced"
  | "pending_review"
  | "confirmed_paid"
  | "overdue";

export type BillingCycleRecord = {
  id: string;
  client: string[];
  kind: BillingCycleKind;
  period_start: string;
  period_end: string;
  due_date: string;
  amount: number;
  currency: string;
  status: BillingCycleStatus;
  amount_due?: number;
  amount_crm?: number;
  total_fee_usd?: number;
  total_turnover_usd?: number;
  client_notified_at?: string;
  created_at?: string;
};

export type PaymentMethodType = "Bank" | "Crypto" | string;

export type PaymentMethodRecord = {
  id: string;
  type: PaymentMethodType;
  label: string;
  details: string;
  network?: string;
  is_available: boolean;
  scope: string;
  client?: string[];
  open_url?: string;
  fallback_url?: string;
  beneficiary?: string;
  iban?: string;
  bic?: string;
  wallet_address?: string;
};

export type PaymentSubmissionStatus = "pending_review" | "approved" | "rejected";

export type PaymentSubmissionRecord = {
  id: string;
  billing_cycle: string[];
  client: string[];
  selected_payment_method: string[];
  submitted_amount: number;
  submitted_currency: string;
  submitted_datetime: string;
  reference_id?: string;
  note?: string;
  proof_url?: string;
  proof_attachment?: Array<{ url: string; filename?: string }>;
  status: PaymentSubmissionStatus;
  admin_note?: string;
};

export type InvoiceRecord = {
  id: string;
  billing_cycle: string[];
  client: string[];
  invoice_number?: string;
  sent_to_email?: string;
  sent_at?: string;
  attachment?: Array<{ url: string; filename?: string }>;
  viewed_at?: string;
};

export type ModelRecord = {
  id: string;
  model_name: string;
  status: "active" | "inactive" | string;
  platform?: string;
};

export type ClientModelRecord = {
  id: string;
  client: string[];
  model: string[];
  model_name?: string;
};

export type CalendarEventRecord = {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  notes?: string;
  scope: "global" | "client" | string;
  client?: string[];
};

export type CreatePaymentSubmissionInput = {
  billing_cycle: string[];
  client: string[];
  selected_payment_method: string[];
  submitted_amount: number;
  submitted_currency: string;
  submitted_datetime: string;
  reference_id?: string;
  note?: string;
  proof_url?: string;
  status: PaymentSubmissionStatus;
};

export type BillingCycleWithSubmission = BillingCycleRecord & {
  latestSubmission: PaymentSubmissionRecord | null;
};

export type EnrichedInvoice = InvoiceRecord & {
  billingCycleInfo?: {
    kind: BillingCycleKind;
    period_start: string;
    period_end: string;
    due_date: string;
  } | null;
};
