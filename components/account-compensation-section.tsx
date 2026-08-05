"use client";

import * as React from "react";
import { Calendar, Download, FileText, Percent, Trash2, Upload } from "lucide-react";
import type { CompensationType, UserContractAttachment } from "@/types";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { SopFormSection } from "@/components/sop/sop-form-section";
import { selectOptionClass } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";

const COMPENSATION_TYPES: CompensationType[] = ["Percentage", "Flat Fee"];
const MAX_ATTACHMENT_MB = 4;

type Props = {
  defaultCompensationType?: CompensationType | "";
  defaultCompensationValue?: number | null;
  defaultCollaborationStartDate?: string;
  defaultCollaborationEndDate?: string;
  existingAttachments?: UserContractAttachment[];
  defaultOpen?: boolean;
};

export function AccountCompensationSection({
  defaultCompensationType = "",
  defaultCompensationValue = null,
  defaultCollaborationStartDate = "",
  defaultCollaborationEndDate = "",
  existingAttachments = [],
  defaultOpen = false,
}: Props) {
  const isSupabase = useIsSupabaseBackend();
  const [compensationType, setCompensationType] = React.useState<CompensationType | "">(
    defaultCompensationType
  );
  const [compensationValue, setCompensationValue] = React.useState(
    defaultCompensationValue != null && !Number.isNaN(defaultCompensationValue)
      ? String(defaultCompensationValue)
      : ""
  );
  const [collaborationStartDate, setCollaborationStartDate] = React.useState(
    defaultCollaborationStartDate.slice(0, 10)
  );
  const [collaborationEndDate, setCollaborationEndDate] = React.useState(
    defaultCollaborationEndDate.slice(0, 10)
  );
  const [keptAttachments, setKeptAttachments] = React.useState(existingAttachments);
  const [newFileNames, setNewFileNames] = React.useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = React.useState<UserContractAttachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isSupabase) return;
    const form = fileInputRef.current?.closest("form");
    if (!form) return;
    const onSubmit = (e: Event) => {
      if (uploading) {
        e.preventDefault();
        setUploadError("Wait for contract uploads to finish.");
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [isSupabase, uploading]);

  async function onFilesSelected(files: FileList | null) {
    const list = Array.from(files ?? []);
    setUploadError(null);
    setNewFileNames(list.map((f) => f.name));
    if (!isSupabase) return;
    if (list.length === 0) {
      setUploadedUrls([]);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadFilesToSupabaseStorage(list, "user-contract");
      setUploadedUrls(
        uploaded.map((u) => ({
          url: u.sbUrl,
          filename: u.filename,
        }))
      );
      setNewFileNames(uploaded.map((u) => u.filename));
    } catch (err) {
      setUploadedUrls([]);
      setNewFileNames([]);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <SopFormSection
      title="Compensation & Contract"
      description="Optional pay terms, contract files, and collaboration dates"
      defaultOpen={defaultOpen}
    >
      <FormField
        label="Compensation type"
        icon={<Percent />}
        htmlFor="compensation_type"
        description="How this user is compensated — leave blank if not applicable."
      >
        <FormSelect
          id="compensation_type"
          name="compensation_type"
          value={compensationType}
          onChange={(e) => {
            const next = e.target.value as CompensationType | "";
            setCompensationType(next);
            if (!next) setCompensationValue("");
          }}
        >
          <option value="" className={selectOptionClass}>
            — Select compensation type —
          </option>
          {COMPENSATION_TYPES.map((t) => (
            <option key={t} value={t} className={selectOptionClass}>
              {t}
            </option>
          ))}
        </FormSelect>
      </FormField>

      {compensationType === "Percentage" && (
        <FormField
          label="Percentage (%)"
          icon={<Percent />}
          htmlFor="compensation_value"
          required
        >
          <div className="relative">
            <FormInput
              id="compensation_value"
              name="compensation_value"
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              value={compensationValue}
              onChange={(e) => setCompensationValue(e.target.value)}
              placeholder="0–100"
              className="pr-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
              %
            </span>
          </div>
        </FormField>
      )}

      {compensationType === "Flat Fee" && (
        <FormField
          label="Flat Fee Amount (€)"
          icon={<Percent />}
          htmlFor="compensation_value"
          required
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              €
            </span>
            <FormInput
              id="compensation_value"
              name="compensation_value"
              type="number"
              min={0}
              step="0.01"
              required
              value={compensationValue}
              onChange={(e) => setCompensationValue(e.target.value)}
              placeholder="0.00"
              className="pl-8"
            />
          </div>
        </FormField>
      )}

      <FormField
        label="Contract attachments"
        icon={<FileText />}
        htmlFor="contract_attachments"
        description={`Upload contracts or related documents (PDF, images — max ${MAX_ATTACHMENT_MB}MB each).`}
      >
        <input
          type="hidden"
          name="kept_contract_attachments"
          value={JSON.stringify(keptAttachments)}
        />
        {isSupabase ? (
          <input
            type="hidden"
            name="contract_attachment_urls"
            value={JSON.stringify(uploadedUrls.map((a) => a.url))}
          />
        ) : null}
        <div className="space-y-3">
          {keptAttachments.length > 0 && (
            <ul className="space-y-2">
              {keptAttachments.map((att) => (
                <li
                  key={att.id ?? att.url}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                    {att.filename || "Contract file"}
                  </span>
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                      aria-label={`Download ${att.filename || "contract file"}`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setKeptAttachments((prev) =>
                        prev.filter((x) => (x.id ?? x.url) !== (att.id ?? att.url))
                      )
                    }
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-red-500/15 hover:text-red-300"
                    aria-label={`Remove ${att.filename || "contract file"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (uploading) return;
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            className={cn(
              "cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all",
              uploading
                ? "border-white/20 bg-white/[0.03] opacity-80"
                : newFileNames.length > 0
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-white/15 hover:border-pink-500/40 hover:bg-pink-500/5"
            )}
          >
            {uploading ? (
              <p className="text-sm font-medium text-white/70">Uploading…</p>
            ) : newFileNames.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-300/90">
                  {newFileNames.length} new file{newFileNames.length === 1 ? "" : "s"} selected
                </p>
                <ul className="text-xs text-white/50">
                  {newFileNames.map((name) => (
                    <li key={name} className="truncate">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-2 h-7 w-7 text-white/30" aria-hidden />
                <p className="text-sm text-white/45">Click to add files</p>
              </>
            )}
            <input
              ref={fileInputRef}
              id="contract_attachments"
              name={isSupabase ? undefined : "contract_attachments"}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => void onFilesSelected(e.target.files)}
            />
          </div>
          {uploadError ? <p className="text-xs text-red-300/90">{uploadError}</p> : null}
        </div>
      </FormField>

      <FormField
        label="Collaboration start date"
        icon={<Calendar />}
        htmlFor="collaboration_start_date"
      >
        <FormInput
          id="collaboration_start_date"
          name="collaboration_start_date"
          type="date"
          value={collaborationStartDate}
          onChange={(e) => setCollaborationStartDate(e.target.value)}
        />
      </FormField>

      <FormField
        label="Collaboration end date (optional — leave blank if ongoing)"
        icon={<Calendar />}
        htmlFor="collaboration_end_date"
      >
        <FormInput
          id="collaboration_end_date"
          name="collaboration_end_date"
          type="date"
          value={collaborationEndDate}
          onChange={(e) => setCollaborationEndDate(e.target.value)}
        />
      </FormField>
    </SopFormSection>
  );
}
