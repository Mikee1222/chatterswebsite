/**
 * POST a FormData body without setting Content-Type.
 * The browser (or fetch runtime) must add multipart/form-data with its own
 * boundary; a manually-set Content-Type without that boundary causes
 * "Failed to parse body as FormData" / "no boundary found in multipart body".
 */
export function postFormData(
  input: RequestInfo | URL,
  formData: FormData,
  init?: Omit<RequestInit, "body" | "method">
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.delete("Content-Type");
  headers.delete("content-type");
  return fetch(input, {
    ...init,
    method: "POST",
    body: formData,
    headers,
  });
}
