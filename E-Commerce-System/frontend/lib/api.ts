import { ApiResponse } from "@/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = new Headers(init?.headers ?? {});

  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const rawText = await response.text();
  let payload: Partial<ApiResponse<T>> & { error?: string } = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as Partial<ApiResponse<T>> & { error?: string };
    } catch {
      payload = { message: rawText };
    }
  }

  if (!response.ok) {
    const message = payload.error || payload.message || "Request failed";
    throw new Error(message);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data as T;
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T, B>(path: string, body: B) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patch: <T, B>(path: string, body: B) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  del: <T>(path: string) =>
    request<T>(path, {
      method: "DELETE",
    }),
  postFormData: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: "POST",
      body: formData,
    }),
};
