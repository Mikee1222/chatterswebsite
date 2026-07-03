/** Max attachments per VA content assignment (client + server enforced). */
export const VA_CONTENT_ASSIGNMENT_MAX_FILES = 30;

/** Per-file limit for Airtable `uploadAttachment` (see lib/airtable-upload-attachment.ts). */
export const VA_CONTENT_ASSIGNMENT_MAX_FILE_BYTES = 4 * 1024 * 1024;

export type ParsedAssignmentFile = {
  name: string;
  type: string;
  data: Uint8Array;
};

/** Read `files` (multi) or legacy single `file` from multipart form data. */
export function parseAssignmentFilesFromFormData(fd: FormData): ParsedAssignmentFile[] {
  const entries: File[] = [];
  for (const item of fd.getAll("files")) {
    if (item instanceof File && item.size > 0) entries.push(item);
  }
  if (entries.length === 0) {
    const single = fd.get("file");
    if (single instanceof File && single.size > 0) entries.push(single);
  }
  return entries.map((f) => ({
    name: f.name || "upload.bin",
    type: f.type || "application/octet-stream",
    data: new Uint8Array(), // filled async by caller
    _file: f,
  })) as (ParsedAssignmentFile & { _file: File })[];
}

export async function readAssignmentFilesFromFormData(fd: FormData): Promise<ParsedAssignmentFile[]> {
  const raw = parseAssignmentFilesFromFormData(fd);
  const out: ParsedAssignmentFile[] = [];
  for (const row of raw) {
    const f = (row as ParsedAssignmentFile & { _file: File })._file;
    const data = new Uint8Array(await f.arrayBuffer());
    out.push({
      name: row.name,
      type: row.type,
      data,
    });
  }
  return out;
}

export function validateAssignmentFileCount(count: number): string | null {
  if (count > VA_CONTENT_ASSIGNMENT_MAX_FILES) {
    return `Too many files (max ${VA_CONTENT_ASSIGNMENT_MAX_FILES}).`;
  }
  return null;
}

export function validateAssignmentFileSizes(files: ParsedAssignmentFile[]): string | null {
  for (const f of files) {
    if (f.data.byteLength > VA_CONTENT_ASSIGNMENT_MAX_FILE_BYTES) {
      return `"${f.name}" is too large (max ${VA_CONTENT_ASSIGNMENT_MAX_FILE_BYTES / (1024 * 1024)} MB per file).`;
    }
  }
  return null;
}
