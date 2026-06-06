"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import type {
  BillingCycleKind,
  BillingCycleRecord,
  BillingCycleRevenueRecord,
  PaymentMethodRecord,
  PaymentSubmissionRecord,
} from "@/types/client-portal";
import { getCycleAmountDue, getChattingWeeklyDueWindow } from "@/lib/client-portal-utils";
import { formatDateEuropean } from "@/lib/format";
import { canSubmitPayment } from "@/lib/billing-status";
import { SUPPORTED_SOLANA_TOKENS, type SolanaToken } from "@/lib/currency";
import { ROUTES } from "@/lib/routes";
import { ClientPaymentMethodCard } from "./payment-method-card";

type ProofFilePickerProps = {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxMb?: number;
};

function ProofFilePicker({
  value,
  onChange,
  accept = "image/*,application/pdf",
  maxMb = 10,
}: ProofFilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isAllowedType = (file: File) =>
    ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type);

  const openPicker = () => inputRef.current?.click();

  const setFileSafe = (file: File | null) => {
    if (!file) return onChange(null);
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`File too large. Maximum ${maxMb}MB.`);
      return;
    }
    if (!isAllowedType(file)) {
      alert("Invalid file type. Only images or PDF files are allowed.");
      return;
    }
    onChange(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => setFileSafe(e.target.files?.[0] ?? null)}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === "Enter" || e.key === "" ? openPicker() : null)}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0] ?? null;
          setFileSafe(file);
        }}
        className={[
          "w-full rounded-lg border bg-[#1a1a1a] px-4 py-2.5",
          "min-h-[56px] flex items-center justify-between gap-3",
          "transition-all duration-200",
          isDragging
            ? "border-pink-500/50 ring-2 ring-pink-500/20"
            : "border-[#2f2f2f] hover:border-pink-500/50 focus-within:border-pink-500/50 focus-within:ring-1 focus-within:ring-pink-500/20",
        ].join("")}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white/90">
            {value ? "File selected" : "Upload proof file"}
          </div>
          <div className="truncate text-xs text-gray-500">
            {value
              ? `${value.name} (${(value.size / 1024 / 1024).toFixed(2)}MB)`
              : "Click to choose or drag and drop"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-lg border border-[#2f2f2f] bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
              className="rounded-lg border border-[#2f2f2f] bg-white/5 px-3 py-1.5 text-xs font-semibold text-pink-400 transition-colors hover:bg-white/10"
            >
              Choose file
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Accepted: images or PDF. Maximum {maxMb}MB
      </p>
    </div>
  );
}

export type CycleRevenueBreakdownRow = Pick<
  BillingCycleRevenueRecord,
  "id" | "model" | "turnover_usd" | "fee_percent" | "fee_usd"
>;

type ServerDateStrings = {
  today: string;
  min: string;
  max: string;
};

type FxResponse = {
  rate?: number;
  updatedAt?: number;
};

type CryptoPriceResponse = {
  priceUsd?: number;
  updatedAt?: number;
};

type SubmitPaymentResponse = {
  success?: boolean;
  error?: string;
  alreadySubmitted?: boolean;
  submissionId?: string;
};

type AmountConversionInfo = {
  rate?: number;
  fromCurrency: string;
  toCurrency: string;
  updatedAt?: number;
};

type YouWillPayState = {
  amount: number;
  currency: string;
  eurEstimate?: { amount: number; rate: number };
  solPrice?: number;
  loading: boolean;
  error: string | null;
  convertedFromEur?: boolean;
};

type PaymentFormProps = {
  billingCycle: BillingCycleRecord | null;
  paymentMethods: PaymentMethodRecord[];
  kind: BillingCycleKind;
  latestSubmission?: PaymentSubmissionRecord | null;
  serverDateStrings: ServerDateStrings;
  cycleRevenues?: CycleRevenueBreakdownRow[];
  modelIdToName?: Record<string, string>;
};

export function PaymentForm({
  billingCycle,
  paymentMethods,
  kind,
  latestSubmission,
  serverDateStrings,
  cycleRevenues = [],
  modelIdToName = {},
}: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMeta, setSuccessMeta] = useState<{
    submissionId?: string;
    amount?: number;
    currency?: string;
    paymentDate?: string;
  } | null>(null);
  const [latestSubmissionState, setLatestSubmissionState] =
    useState<PaymentSubmissionRecord | null>(latestSubmission ?? null);
  const submissionStatus = latestSubmissionState?.status ?? null;
  const canSubmit = canSubmitPayment(billingCycle?.status, submissionStatus ?? undefined);
  const isLocked = !canSubmit;

  useEffect(() => {
    setLatestSubmissionState(latestSubmission ?? null);
    setSuccess(false);
    setSuccessMeta(null);
  }, [billingCycle?.id, latestSubmission]);

  const paymentMethodById = useMemo(() => {
    const map = new Map<string, PaymentMethodRecord>();
    paymentMethods.forEach((method) => {
      map.set(method.id, method);
    });
    return map;
  }, [paymentMethods]);

  const defaultPaymentMethodId = useMemo(() => {
    if (paymentMethods.length === 0) return "";
    const revolut = paymentMethods.find((m) => m.type.toLowerCase() === "revolut");
    if (revolut) return revolut.id;
    return paymentMethods[0].id;
  }, [paymentMethods]);

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>(() => {
    if (paymentMethods.length === 0) return "";
    const revolut = paymentMethods.find((m) => m.type.toLowerCase() === "revolut");
    if (revolut) return revolut.id;
    return paymentMethods[0].id;
  });

  useEffect(() => {
    if (defaultPaymentMethodId && !selectedPaymentMethodId) {
      setSelectedPaymentMethodId(defaultPaymentMethodId);
    }
  }, [defaultPaymentMethodId, selectedPaymentMethodId]);

  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  const [selectedCryptoToken, setSelectedCryptoToken] = useState<SolanaToken>("USDC");
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [amountConversionInfo, setAmountConversionInfo] = useState<AmountConversionInfo | null>(
    null
  );
  const [amountLoading, setAmountLoading] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [manualAmountEdit, setManualAmountEdit] = useState(false);
  const [manualAmountValue, setManualAmountValue] = useState<string>("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const dueAmount = billingCycle ? getCycleAmountDue(billingCycle) : 0;
  const cycleCurrency = (billingCycle?.currency ?? "USD").toString().toUpperCase();
  const [selectedBankCurrency, setSelectedBankCurrency] = useState<string>(cycleCurrency);

  const selectedPaymentMethod = useMemo(() => {
    if (!selectedPaymentMethodId) return undefined;
    return paymentMethodById.get(selectedPaymentMethodId);
  }, [selectedPaymentMethodId, paymentMethodById]);

  const isCryptoPayment = selectedPaymentMethod?.type?.toLowerCase() === "crypto";
  const isBankPayment = ["revolut", "zen", "wise", "bank"].includes(
    selectedPaymentMethod?.type?.toLowerCase() || ""
  );

  const submissionCurrency = useMemo(() => {
    if (!selectedPaymentMethod) {
      return cycleCurrency;
    }

    if (isBankPayment) {
      return selectedBankCurrency || cycleCurrency;
    }

    if (isCryptoPayment) {
      if (selectedCryptoToken === "USDC" || selectedCryptoToken === "USDT") {
        return "USD";
      }
      if (selectedCryptoToken === "SOL") {
        return "SOL";
      }
      return "USD";
    }

    return cycleCurrency;
  }, [
    selectedPaymentMethod,
    isBankPayment,
    isCryptoPayment,
    selectedCryptoToken,
    selectedBankCurrency,
    cycleCurrency,
  ]);

  const calculateAmount = useCallback(async () => {
    if (!billingCycle || !selectedPaymentMethod || dueAmount <= 0) {
      setCalculatedAmount(0);
      setAmountConversionInfo(null);
      setAmountLoading(false);
      setAmountError(null);
      return;
    }

    if (manualAmountEdit) {
      return;
    }

    setAmountLoading(true);
    setAmountError(null);

    try {
      if (isBankPayment) {
        if (selectedBankCurrency === cycleCurrency) {
          setCalculatedAmount(dueAmount);
          setAmountConversionInfo(null);
        } else {
          try {
            const fxResponse = await fetch(
              `/api/client/fx?base=${cycleCurrency}&quote=${selectedBankCurrency}`
            );
            if (fxResponse.ok) {
              const fxData = (await fxResponse.json()) as FxResponse;
              const converted = dueAmount * (fxData.rate || 1);
              setCalculatedAmount(converted);
              setAmountConversionInfo({
                rate: fxData.rate || 1,
                fromCurrency: cycleCurrency,
                toCurrency: selectedBankCurrency,
                updatedAt: fxData.updatedAt || Date.now(),
              });
            } else {
              throw new Error("FX conversion failed");
            }
          } catch {
            setCalculatedAmount(dueAmount);
            setAmountConversionInfo(null);
            setAmountError("Conversion unavailable");
          }
        }
        setAmountLoading(false);
        return;
      }

      if (isCryptoPayment) {
        let usdDue = dueAmount;

        if (cycleCurrency === "EUR") {
          try {
            const fxResponse = await fetch(`/api/client/fx?base=EUR&quote=USD`);
            if (fxResponse.ok) {
              const fxData = (await fxResponse.json()) as FxResponse;
              usdDue = dueAmount * (fxData.rate || 1);
              setAmountConversionInfo({
                rate: fxData.rate || 1,
                fromCurrency: "EUR",
                toCurrency: "USD",
                updatedAt: fxData.updatedAt || Date.now(),
              });
            } else {
              throw new Error("EUR to USD conversion failed");
            }
          } catch {
            setCalculatedAmount(dueAmount);
            setAmountConversionInfo(null);
            setAmountError("USD conversion unavailable");
            setAmountLoading(false);
            return;
          }
        } else {
          setAmountConversionInfo(null);
        }

        if (selectedCryptoToken === "USDC" || selectedCryptoToken === "USDT") {
          setCalculatedAmount(parseFloat(usdDue.toFixed(2)));
          setAmountLoading(false);
          return;
        }

        if (selectedCryptoToken === "SOL") {
          try {
            const priceResponse = await fetch(`/api/client/crypto-price?symbol=SOL`);
            if (priceResponse.ok) {
              const priceData = (await priceResponse.json()) as CryptoPriceResponse;
              const solAmount = usdDue / (priceData.priceUsd || 1);
              const rounded = parseFloat(solAmount.toFixed(6).replace(/\.?0+$/, ""));
              setCalculatedAmount(rounded);
            } else {
              throw new Error("SOL price fetch failed");
            }
          } catch {
            setCalculatedAmount(dueAmount);
            setAmountConversionInfo(null);
            setAmountError("SOL price unavailable");
          }
          setAmountLoading(false);
          return;
        }

        setCalculatedAmount(dueAmount);
        setAmountLoading(false);
        return;
      }

      setCalculatedAmount(dueAmount);
      setAmountLoading(false);
    } catch (err) {
      setCalculatedAmount(dueAmount);
      setAmountError(err instanceof Error ? err.message : "Calculation failed");
      setAmountLoading(false);
    }
  }, [
    billingCycle,
    selectedPaymentMethod,
    dueAmount,
    cycleCurrency,
    isBankPayment,
    isCryptoPayment,
    selectedBankCurrency,
    selectedCryptoToken,
    manualAmountEdit,
  ]);

  useEffect(() => {
    void calculateAmount();
  }, [calculateAmount]);

  const [youWillPay, setYouWillPay] = useState<YouWillPayState | null>(null);

  const calculateYouWillPay = useCallback(async () => {
    if (!billingCycle) {
      setYouWillPay(null);
      return;
    }
    if (dueAmount <= 0) {
      setYouWillPay({
        amount: 0,
        currency: cycleCurrency,
        loading: false,
        error: null,
      });
      return;
    }
    if (!selectedPaymentMethod) {
      setYouWillPay(null);
      return;
    }

    setYouWillPay({
      amount: 0,
      currency: cycleCurrency,
      loading: true,
      error: null,
    });

    try {
      if (isBankPayment) {
        const result: YouWillPayState = {
          amount: dueAmount,
          currency: cycleCurrency,
          loading: false,
          error: null,
        };

        if (cycleCurrency === "USD") {
          try {
            const fxResponse = await fetch(`/api/client/fx?base=USD&quote=EUR`);
            if (fxResponse.ok) {
              const fxData = (await fxResponse.json()) as FxResponse;
              result.eurEstimate = {
                amount: dueAmount * (fxData.rate || 1),
                rate: fxData.rate || 1,
              };
            } else {
              result.error = "EUR conversion unavailable";
            }
          } catch {
            result.error = "EUR conversion unavailable";
          }
        }

        setYouWillPay(result);
        return;
      }

      if (isCryptoPayment) {
        let usdDue = dueAmount;
        let convertedFromEur = false;

        if (cycleCurrency === "EUR") {
          try {
            const fxResponse = await fetch(`/api/client/fx?base=EUR&quote=USD`);
            if (fxResponse.ok) {
              const fxData = (await fxResponse.json()) as FxResponse;
              usdDue = dueAmount * (fxData.rate || 1);
              convertedFromEur = true;
            } else {
              setYouWillPay({
                amount: dueAmount,
                currency: cycleCurrency,
                loading: false,
                error: "USD conversion unavailable",
              });
              return;
            }
          } catch {
            setYouWillPay({
              amount: dueAmount,
              currency: cycleCurrency,
              loading: false,
              error: "USD conversion unavailable",
            });
            return;
          }
        }

        if (selectedCryptoToken === "USDC" || selectedCryptoToken === "USDT") {
          setYouWillPay({
            amount: usdDue,
            currency: selectedCryptoToken,
            loading: false,
            error: null,
            convertedFromEur,
          });
          return;
        }

        if (selectedCryptoToken === "SOL") {
          try {
            const priceResponse = await fetch(`/api/client/crypto-price?symbol=SOL`);
            if (priceResponse.ok) {
              const priceData = (await priceResponse.json()) as CryptoPriceResponse;
              const solAmount = usdDue / (priceData.priceUsd || 1);
              setYouWillPay({
                amount: solAmount,
                currency: "SOL",
                solPrice: priceData.priceUsd || 0,
                loading: false,
                error: null,
                convertedFromEur,
              });
            } else {
              setYouWillPay({
                amount: dueAmount,
                currency: cycleCurrency,
                loading: false,
                error: "SOL price unavailable",
              });
              return;
            }
          } catch {
            setYouWillPay({
              amount: dueAmount,
              currency: cycleCurrency,
              loading: false,
              error: "SOL price unavailable",
            });
            return;
          }
          return;
        }

        setYouWillPay({
          amount: dueAmount,
          currency: cycleCurrency,
          loading: false,
          error: "Unknown crypto token",
        });
      }
    } catch (err) {
      setYouWillPay({
        amount: dueAmount,
        currency: cycleCurrency,
        loading: false,
        error: err instanceof Error ? err.message : "Calculation failed",
      });
    }
  }, [
    billingCycle,
    selectedPaymentMethod,
    dueAmount,
    cycleCurrency,
    isBankPayment,
    isCryptoPayment,
    selectedCryptoToken,
  ]);

  useEffect(() => {
    void calculateYouWillPay();
  }, [calculateYouWillPay]);

  useEffect(() => {
    const savedToken = localStorage.getItem("selectedCryptoToken");
    if (savedToken && SUPPORTED_SOLANA_TOKENS.includes(savedToken as SolanaToken)) {
      setSelectedCryptoToken(savedToken as SolanaToken);
    }
    const savedBank = localStorage.getItem("selectedBankCurrency");
    if (savedBank && (savedBank === "USD" || savedBank === "EUR" || savedBank === cycleCurrency)) {
      setSelectedBankCurrency(savedBank);
    }
  }, [cycleCurrency]);

  useEffect(() => {
    if (isCryptoPayment) {
      localStorage.setItem("selectedCryptoToken", selectedCryptoToken);
    }
  }, [selectedCryptoToken, isCryptoPayment]);

  useEffect(() => {
    if (isBankPayment && selectedBankCurrency) {
      localStorage.setItem("selectedBankCurrency", selectedBankCurrency);
    }
  }, [selectedBankCurrency, isBankPayment]);

  useEffect(() => {
    const checkFormData = () => {
      if (typeof document !== "undefined") {
        const form = document.querySelector("form");
        if (form) {
          const formData = new FormData(form);
          const notes = formData.get("notes");
          const hasData =
            !!selectedPaymentMethodId ||
            !!proofFile ||
            !!proofUrl ||
            (typeof notes === "string" && notes.trim().length > 0);
          setHasUnsavedData(hasData);
        }
      }
    };

    if (typeof window !== "undefined") {
      const form = document.querySelector("form");
      if (form) {
        form.addEventListener("input", checkFormData);
        form.addEventListener("change", checkFormData);
        checkFormData();

        return () => {
          form.removeEventListener("input", checkFormData);
          form.removeEventListener("change", checkFormData);
        };
      }
    }
  }, [proofFile, proofUrl, selectedPaymentMethodId]);

  const handleProofFileChange = useCallback(async (file: File | null) => {
    setProofFile(file);
    setUploadError("");
    setProofUrl("");

    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/client/upload-proof", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed");
      }
      setProofUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setProofFile(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const proofReady = Boolean(proofUrl);

  useEffect(() => {
    if (!hasUnsavedData || success) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedData, success]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setSuccessMeta(null);

    if (isLocked) {
      if (submissionStatus === "pending_review") {
        setError("This billing cycle is already submitted and pending review.");
      }
      setLoading(false);
      return;
    }

    if (!billingCycle) {
      setError("No active billing cycle found");
      setLoading(false);
      return;
    }

    if (dueAmount <= 0) {
      setError("No amount due");
      setLoading(false);
      return;
    }

    if (!selectedPaymentMethod) {
      setError("Please select a payment method");
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const finalAmount = manualAmountEdit
      ? parseFloat(manualAmountValue || "0")
      : calculatedAmount;

    if (!finalAmount || finalAmount <= 0) {
      setError("Amount must be greater than 0");
      setLoading(false);
      return;
    }

    const dateValue = formData.get("datetime");
    let submittedIso: string | null = null;
    if (typeof dateValue === "string" && dateValue) {
      const date = new Date(dateValue);
      date.setHours(new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());
      submittedIso = date.toISOString();
    }

    const notesValue = formData.get("notes");
    const note = typeof notesValue === "string" && notesValue.trim() ? notesValue.trim() : undefined;

    if (!proofFile && !proofUrl) {
      setError("Please upload a proof file");
      setLoading(false);
      return;
    }

    if (uploading) {
      setError("Please wait for the proof file to finish uploading");
      setLoading(false);
      return;
    }

    const proofAttachment = proofUrl
      ? [{ url: proofUrl, filename: proofFile?.name }]
      : undefined;

    try {
      const res = await fetch("/api/client/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_cycle_id: billingCycle.id,
          payment_method_id: selectedPaymentMethod.id,
          amount: finalAmount,
          currency: submissionCurrency,
          datetime: submittedIso || new Date().toISOString(),
          note,
          proof_url: proofUrl,
          proof_attachment: proofAttachment,
        }),
      });

      const result = (await res.json()) as SubmitPaymentResponse;

      if (!res.ok || !result.success) {
        if (result.alreadySubmitted) {
          setLatestSubmissionState({
            ...(latestSubmissionState ?? {
              id: result.submissionId || "unknown",
              billing_cycle: [billingCycle.id],
              client: billingCycle.client,
              selected_payment_method: [selectedPaymentMethod.id],
              submitted_amount: finalAmount,
              submitted_currency: submissionCurrency,
              submitted_datetime: submittedIso || new Date().toISOString(),
              status: "pending_review",
            }),
            status: "pending_review",
          });
          setError("This billing cycle is already submitted and pending review.");
        } else {
          setError(result.error ?? "Submission failed");
        }
        setLoading(false);
        return;
      }

      const submissionId = result.submissionId ?? "unknown";
      setSuccessMeta({
        submissionId,
        amount: finalAmount,
        currency: submissionCurrency,
        paymentDate: submittedIso || undefined,
      });
      setLatestSubmissionState({
        id: submissionId,
        billing_cycle: [billingCycle.id],
        client: billingCycle.client,
        selected_payment_method: [selectedPaymentMethod.id],
        submitted_amount: finalAmount,
        submitted_currency: submissionCurrency,
        submitted_datetime: submittedIso || new Date().toISOString(),
        status: "pending_review",
        proof_url: proofUrl,
        proof_attachment: proofAttachment,
      });
      setSuccess(true);
      setHasUnsavedData(false);
      setProofFile(null);
      setProofUrl("");
      setUploadError("");
      e.currentTarget.reset();
    } catch (err) {
      console.error("[payment-form] Submit error:", err);
      setError("An unexpected error occurred. Please try again or contact support.");
    } finally {
      setLoading(false);
    }
  };

  if (!billingCycle) {
    return (
      <div className="glass-card rounded-2xl">
        <div className="py-12 text-center">
          <p className="mb-2 text-lg text-gray-300">No active billing cycle found.</p>
          <p className="text-sm text-gray-500">
            Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    const cyclePeriod =
      billingCycle.period_start && billingCycle.period_end
        ? `${formatDateEuropean(billingCycle.period_start)} → ${formatDateEuropean(billingCycle.period_end)}`
        : null;
    const details = [
      successMeta?.amount && successMeta?.currency
        ? { label: "Amount", value: `${successMeta.amount} ${successMeta.currency}` }
        : null,
      successMeta?.paymentDate
        ? { label: "Payment Date", value: formatDateEuropean(successMeta.paymentDate) }
        : null,
      successMeta?.submissionId
        ? { label: "Submission ID", value: successMeta.submissionId }
        : null,
      cyclePeriod ? { label: "Billing Cycle", value: cyclePeriod } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    const showDetails = details.length > 0;
    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL;
    const supportHref = supportUrl || (supportEmail ? `mailto:${supportEmail}` : null);
    const historyHref = successMeta?.submissionId
      ? `${ROUTES.client.paymentHistory}?highlight=${encodeURIComponent(successMeta.submissionId)}`
      : ROUTES.client.paymentHistory;

    return (
      <div className="glass-card rounded-2xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-white">Payment Proof Submitted</h2>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                  Submitted
                </span>
                <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs font-medium text-yellow-200">
                  Pending Review
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/80">
                Your proof has been received and queued for review. We&apos;ll update you as soon
                as it&apos;s processed.
              </p>

              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold tracking-wide text-gray-400">
                  Next Steps
                </div>
                <ul className="space-y-2 text-sm leading-relaxed text-white/75">
                  <li className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                    <span>We received your payment proof.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-yellow-300/80" />
                    <span>Our team will review it.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-pink-300/80" />
                    <span>You&apos;ll receive an invoice by email within 48 hours.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6">
                <div className="mb-3 text-xs font-semibold tracking-wide text-gray-400">Status</div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    <span className="text-emerald-200">Submitted</span>
                  </div>
                  <span className="h-px w-10 bg-white/10" />
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-300 ring-2 ring-yellow-300/20" />
                    <span className="text-yellow-200">Pending Review</span>
                  </div>
                  <span className="h-px w-10 bg-white/10" />
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    <span>Approved</span>
                  </div>
                </div>
              </div>

              {showDetails && (
                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <div className="mb-3 text-xs font-semibold tracking-wide text-gray-400">
                    Details
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    {details.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <span className="text-gray-400">{item.label}</span>
                        <span className="text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={historyHref}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-600 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(236,72,153,0.35)] transition-all hover:from-pink-500 hover:to-pink-500"
                >
                  View Submission
                </Link>
                <Link
                  href={ROUTES.client.home}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/10"
                >
                  Back to Home
                </Link>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                If you need to update your proof,{""}
                {supportHref ? (
                  <Link href={supportHref} className="text-gray-300 underline hover:text-white">
                    contact support
                  </Link>
                ) : (
                  <span className="text-gray-300">contact support</span>
                )}
                .
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8">
      <div className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">Current Amount Due</h2>
        <div className="mb-2 flex items-baseline gap-2">
          <p className="text-4xl font-bold tracking-tight text-white">
            {getCycleAmountDue(billingCycle)
              .toFixed(0)
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          </p>
          <span className="text-sm font-medium uppercase text-gray-500">
            {billingCycle.currency ?? "USD"}
          </span>
        </div>
        <p className="text-sm text-gray-400">
          {kind === "chatting_weekly" ? (
            (() => {
              const dueWindow = getChattingWeeklyDueWindow(billingCycle.period_end);
              return dueWindow
                ? `Due window: ${formatDateEuropean(dueWindow.dueStart)} – ${formatDateEuropean(dueWindow.dueEnd)}`
                : "Due: —";
            })()
          ) : (
            `Due: ${formatDateEuropean(billingCycle.due_date)}`
          )}
        </p>
        {kind === "chatting_weekly" && (
          <p className="mt-1 text-sm text-gray-400">
            Models:{""}
            {(() => {
              const ids = Array.from(
                new Set(
                  cycleRevenues
                    .map((r) => (Array.isArray(r.model) ? r.model[0] : undefined))
                    .filter((id): id is string => Boolean(id))
                )
              );
              const names = ids.map((id) => modelIdToName[id] ?? "—");
              return names.length === 0 ? "—" : names.join(", ");
            })()}
          </p>
        )}
        {kind === "crm_monthly" && dueAmount <= 0 && (
          <p className="mt-2 text-xs italic text-gray-500">
            No CRM expenses found for the selected month
          </p>
        )}
      </div>

      {kind === "chatting_weekly" && (
        <div className="mb-6 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
            Breakdown (This Cycle)
          </p>
          {cycleRevenues.length === 0 ? (
            <p className="text-sm text-gray-400">No model revenue entries for this cycle yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 text-right font-medium">Turnover USD</th>
                    <th className="px-3 py-2 text-right font-medium">Fee USD</th>
                  </tr>
                </thead>
                <tbody>
                  {cycleRevenues.map((r) => {
                    const modelId = Array.isArray(r.model) ? r.model[0] : undefined;
                    const modelName = modelId ? (modelIdToName[modelId] ?? "—") : "—";
                    const feeUsd =
                      r.fee_usd ?? (r.turnover_usd ?? 0) * ((r.fee_percent ?? 0) / 100);
                    return (
                      <tr key={r.id} className="border-b border-white/5 text-gray-200">
                        <td className="px-3 py-2">{modelName}</td>
                        <td className="px-3 py-2 text-right">
                          {(r.turnover_usd ?? 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {feeUsd.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-white/5 font-medium text-white">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">
                      {cycleRevenues
                        .reduce((s, r) => s + (r.turnover_usd ?? 0), 0)
                        .toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {cycleRevenues
                        .reduce(
                          (sum, r) =>
                            sum + (r.fee_usd ?? (r.turnover_usd ?? 0) * ((r.fee_percent ?? 0) / 100)),
                          0
                        )
                        .toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/20 p-4 text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {isLocked && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Clock className="h-5 w-5 text-yellow-300" />
              </div>
              <div className="space-y-1">
                <div
                  className={
                    submissionStatus === "pending_review"
                      ? "font-semibold"
                      : "text-lg font-semibold"
                  }
                >
                  {submissionStatus === "pending_review"
                    ? "This billing cycle is already submitted and pending review"
                    : "Payment Already Submitted"}
                </div>
                <div
                  className={
                    submissionStatus === "pending_review"
                      ? "text-sm text-yellow-200/80"
                      : "text-sm leading-relaxed text-white/70"
                  }
                >
                  {submissionStatus === "pending_review"
                    ? "Your submission is in review. You can follow updates in your payment history."
                    : "This billing cycle has been successfully settled. You can review the full status and timeline inside your Payment History."}
                </div>
                {submissionStatus && (
                  <div className="text-xs text-yellow-200/70">
                    Submission status: {submissionStatus.replace("_", "")}
                  </div>
                )}
                <Link
                  href={ROUTES.client.paymentHistory}
                  className={
                    submissionStatus === "pending_review"
                      ? "text-sm text-yellow-100 underline hover:text-white"
                      : "text-sm font-medium text-yellow-100 underline underline-offset-4 transition-colors hover:text-white"
                  }
                >
                  {submissionStatus === "pending_review"
                    ? "View payment history →"
                    : "View Payment History →"}
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="group">
          <label
            htmlFor="payment_method"
            className="mb-2 block text-sm font-medium text-gray-400 transition-colors group-focus-within:text-pink-400"
          >
            Payment Method *
          </label>
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-500/10 to-pink-500/10 opacity-0 blur-xl transition-opacity group-focus-within:opacity-100" />
            <select
              id="payment_method"
              name="payment_method_id"
              required
              value={selectedPaymentMethodId}
              onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
              className="relative w-full cursor-pointer appearance-none rounded-lg border border-[#2f2f2f] bg-[#1a1a1a] px-4 py-3 text-white transition-all duration-200 hover:border-[#3f3f3f] focus:border-pink-500/50 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238b5cf6' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 1rem center",
                paddingRight: "2.5rem",
              }}
            >
              <option value="">Select payment method</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id} className="bg-[#1a1a1a]">
                  {method.label} ({method.type})
                </option>
              ))}
            </select>
          </div>

          {selectedPaymentMethod && (
            <div className="mt-4 rounded-lg border border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-pink-500/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-300">You will pay</p>
                {youWillPay?.loading && (
                  <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
                )}
              </div>

              {isCryptoPayment && (
                <div className="mb-3">
                  <div className="mb-2 flex items-center gap-2">
                    <label htmlFor="crypto_token" className="block text-xs font-medium text-gray-400">
                      Select Token
                    </label>
                    <span className="rounded border border-pink-500/30 bg-pink-500/20 px-2 py-0.5 text-xs font-medium text-pink-400">
                      Solana Network
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      id="crypto_token"
                      value={selectedCryptoToken}
                      onChange={(e) => setSelectedCryptoToken(e.target.value as SolanaToken)}
                      className="relative w-full cursor-pointer appearance-none rounded-lg border border-[#2f2f2f] bg-[#1a1a1a] px-3 py-2 text-sm text-white transition-all duration-200 hover:border-[#3f3f3f] focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%238b5cf6' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 0.75rem center",
                        paddingRight: "2rem",
                      }}
                    >
                      {SUPPORTED_SOLANA_TOKENS.map((token) => (
                        <option key={token} value={token} className="bg-[#1a1a1a]">
                          {token}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                    <Info className="h-3 w-3" />
                    Only Solana network tokens are supported.
                  </p>
                  {selectedCryptoToken === "SOL" && (
                    <div className="mt-2 flex items-start gap-2 rounded border border-yellow-500/20 bg-yellow-500/10 p-2 text-xs text-yellow-400">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        SOL price is volatile. The amount may vary due to market fluctuations.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {youWillPay && !youWillPay.loading && (
                <>
                  <div className="mb-1 flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight text-white">
                      {youWillPay.currency === "SOL"
                        ? youWillPay.amount.toFixed(6).replace(/\.?0+$/, "")
                        : youWillPay.currency === "USDC" || youWillPay.currency === "USDT"
                          ? youWillPay.amount.toFixed(2)
                          : youWillPay.amount
                              .toFixed(2)
                              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </p>
                    <span className="text-sm font-medium uppercase text-gray-500">
                      {youWillPay.currency}
                    </span>
                  </div>

                  {youWillPay.convertedFromEur &&
                    (youWillPay.currency === "USDC" || youWillPay.currency === "USDT") && (
                      <p className="mb-2 text-xs text-gray-500">estimated in USD</p>
                    )}

                  {youWillPay.eurEstimate && (
                    <div className="mt-2 border-t border-pink-500/20 pt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gray-400">≈</span>
                        <span className="text-lg font-semibold text-white">
                          €
                          {youWillPay.eurEstimate.amount
                            .toFixed(2)
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        rate: 1 USD = {youWillPay.eurEstimate.rate.toFixed(4)} EUR
                      </p>
                    </div>
                  )}

                  {youWillPay.solPrice && (
                    <div className="mt-2 border-t border-pink-500/20 pt-2">
                      <p className="text-xs text-gray-500">
                        1 SOL = ${youWillPay.solPrice.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {youWillPay.error && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
                      <AlertCircle className="h-3 w-3" />
                      <span>{youWillPay.error}</span>
                    </div>
                  )}

                  <div className="mt-3 border-t border-pink-500/20 pt-2">
                    <button
                      type="button"
                      onClick={() => void calculateYouWillPay()}
                      disabled={youWillPay.loading}
                      className="flex items-center gap-1 text-xs text-pink-400 transition-colors hover:text-pink-300 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${youWillPay.loading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                </>
              )}

              {youWillPay?.loading && <p className="text-sm text-gray-400">Calculating...</p>}

              {!youWillPay && selectedPaymentMethod && dueAmount > 0 && (
                <p className="text-sm text-gray-400">Select a payment method to see amount</p>
              )}
              {!youWillPay && selectedPaymentMethod && dueAmount <= 0 && (
                <p className="text-sm text-gray-400 opacity-75">No amount due</p>
              )}
            </div>
          )}

          {paymentMethods.length > 0 && (
            <div className="mt-4 rounded-xl border border-[#2f2f2f] bg-gradient-to-br from-[#1a1a1a] to-[#151515] p-5 transition-all duration-200 hover:border-pink-500/30">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Available Payment Methods
              </p>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <ClientPaymentMethodCard key={method.id} method={method} />
                ))}
              </div>
            </div>
          )}
        </div>

        {billingCycle.model_turnover !== undefined &&
          billingCycle.model_turnover !== null &&
          billingCycle.model_turnover > 0 &&
          billingCycle.client_percentage_snapshot !== undefined &&
          billingCycle.client_percentage_snapshot !== null &&
          billingCycle.client_percentage_snapshot > 0 && (
            <div className="rounded-xl border border-[#2f2f2f] bg-gradient-to-br from-[#1a1a1a] to-[#151515] p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-300">Fee Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Turnover:</span>
                  <span className="font-medium text-white">
                    {billingCycle.model_turnover
                      .toFixed(2)
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}{""}
                    {cycleCurrency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Agency %:</span>
                  <span className="font-medium text-white">
                    {(billingCycle.client_percentage_snapshot * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[#2f2f2f] pt-2">
                  <span className="font-medium text-gray-300">Client pays:</span>
                  <span className="font-semibold text-white">
                    {dueAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} {cycleCurrency}
                  </span>
                </div>
              </div>
            </div>
          )}

        <div className="group">
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-400 transition-colors group-focus-within:text-pink-400"
            >
              Amount *
            </label>
            {manualAmountEdit && (
              <span className="rounded border border-yellow-500/30 bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                Manual Amount
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-500/10 to-pink-500/10 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100" />
            <input
              type="number"
              id="amount"
              name="amount"
              step="0.000001"
              min="0"
              required
              value={
                manualAmountEdit
                  ? manualAmountValue
                  : calculatedAmount > 0
                    ? calculatedAmount.toString()
                    : ""
              }
              onChange={(e) => {
                if (manualAmountEdit) {
                  setManualAmountValue(e.target.value);
                }
              }}
              readOnly={!manualAmountEdit}
              disabled={dueAmount <= 0}
              className={`relative w-full rounded-lg border border-[#2f2f2f] bg-[#1a1a1a] px-4 py-2.5 text-white placeholder-gray-500 transition-all duration-200 focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20 ${
                manualAmountEdit
                  ? "cursor-text hover:border-[#3f3f3f]"
                  : "cursor-not-allowed opacity-80"
              } ${dueAmount <= 0 ? "cursor-not-allowed opacity-50" : ""}`}
            />
            {amountLoading && !manualAmountEdit && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="manual_amount_edit"
              checked={manualAmountEdit}
              onChange={(e) => {
                setManualAmountEdit(e.target.checked);
                if (!e.target.checked) {
                  setManualAmountValue("");
                  void calculateAmount();
                } else {
                  setManualAmountValue(
                    calculatedAmount > 0 ? calculatedAmount.toString() : ""
                  );
                }
              }}
              disabled={dueAmount <= 0}
              className="h-4 w-4 rounded border-[#2f2f2f] bg-[#1a1a1a] text-pink-500 focus:ring-1 focus:ring-pink-500/20 focus:ring-offset-0"
            />
            <label htmlFor="manual_amount_edit" className="cursor-pointer text-xs text-gray-400">
              Edit amount manually
            </label>
          </div>

          {amountConversionInfo && !manualAmountEdit && (
            <p className="mt-2 text-xs text-gray-500">
              converted: {amountConversionInfo.fromCurrency}→{amountConversionInfo.toCurrency} @{""}
              {amountConversionInfo.rate?.toFixed(4)}
              {amountConversionInfo.updatedAt && (
                <> (updated {new Date(amountConversionInfo.updatedAt).toLocaleTimeString()})</>
              )}
            </p>
          )}

          {amountError && !manualAmountEdit && (
            <p className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle className="h-3 w-3" />
              <span>{amountError}</span>
            </p>
          )}

          {dueAmount <= 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span>No amount due</span>
            </p>
          )}
        </div>

        <div className="group">
          <label
            htmlFor="currency"
            className="mb-2 block text-sm font-medium text-gray-400 transition-colors group-focus-within:text-pink-400"
          >
            Currency *
          </label>
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-500/10 to-pink-500/10 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100" />
            <select
              id="currency"
              name="currency"
              required
              value={submissionCurrency}
              disabled={!isBankPayment}
              onChange={(e) => {
                if (isBankPayment) {
                  setSelectedBankCurrency(e.target.value);
                }
              }}
              className={`relative w-full appearance-none rounded-lg border border-[#2f2f2f] bg-[#1a1a1a] px-4 py-2.5 text-white transition-all duration-200 focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20 ${
                isBankPayment
                  ? "cursor-pointer hover:border-[#3f3f3f]"
                  : "cursor-not-allowed opacity-70"
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${isBankPayment ? "%238b5cf6": "%23999"}' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 1rem center",
                paddingRight: "2.5rem",
              }}
            >
              {isBankPayment ? (
                <>
                  {["USD", "EUR"].map((curr) => (
                    <option key={curr} value={curr} className="bg-[#1a1a1a]">
                      {curr}
                    </option>
                  ))}
                  {cycleCurrency !== "USD" && cycleCurrency !== "EUR" && (
                    <option value={cycleCurrency} className="bg-[#1a1a1a]">
                      {cycleCurrency}
                    </option>
                  )}
                </>
              ) : (
                <option value={submissionCurrency} className="bg-[#1a1a1a]">
                  {submissionCurrency}
                </option>
              )}
            </select>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {isBankPayment
              ? "Choose the currency you will send"
              : isCryptoPayment &&
                  (selectedCryptoToken === "USDC" || selectedCryptoToken === "USDT")
                ? "USDC/USDT paid as USD on Solana"
                : isCryptoPayment && selectedCryptoToken === "SOL"
                  ? "SOL paid as SOL on Solana"
                  : "Currency automatically set based on payment method"}
          </p>
        </div>

        <div className="group min-w-0 max-w-full">
          <label
            htmlFor="datetime"
            className="mb-2 block text-sm font-medium text-gray-400 transition-colors group-focus-within:text-pink-400"
          >
            Payment Date *
          </label>
          <div className="relative max-w-full min-w-0 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 z-0 rounded-lg bg-gradient-to-r from-pink-500/10 to-pink-500/10 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100"
              aria-hidden
            />
            <input
              type="date"
              id="datetime"
              name="datetime"
              required
              defaultValue={serverDateStrings.today}
              min={serverDateStrings.min}
              max={serverDateStrings.max}
              className="relative z-10 box-border w-full max-w-full min-w-0 cursor-pointer rounded-lg border border-[#2f2f2f] bg-[#1a1a1a] px-4 py-2.5 text-white transition-all duration-200 hover:border-[#3f3f3f] focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20 max-[390px]:px-3 max-[390px]:py-2 max-[390px]:text-base"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Select the date when you made the payment
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="mb-2 block text-sm font-medium text-gray-400">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full resize-none rounded-lg border border-[#2f2f2f] bg-[#1a1a1a] px-4 py-2.5 text-white placeholder-gray-500 transition-colors focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20"
          />
        </div>

        <div className="group">
          <label className="mb-2 block text-sm font-medium text-gray-400 transition-colors group-focus-within:text-pink-400">
            Proof File *
          </label>
          <ProofFilePicker
            value={proofFile}
            onChange={(file) => void handleProofFileChange(file)}
            accept="image/jpeg,image/png,image/webp,.pdf"
            maxMb={10}
          />
          {uploading && (
            <div className="mt-2 flex items-center gap-2 text-sm text-pink-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading proof file...</span>
            </div>
          )}
          {proofReady && proofFile && !uploading && (
            <div className="mt-2 flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{proofFile.name}</span>
            </div>
          )}
          {uploadError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{uploadError}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(false);
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || isLocked || uploading || !proofReady}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-900/30 transition-all hover:from-pink-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              "Submit Payment Proof"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
