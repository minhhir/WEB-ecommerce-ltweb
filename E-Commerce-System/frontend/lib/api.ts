import { ApiResponse } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponse<T> & { error?: string };

  if (!response.ok) {
    const message = payload.error || payload.message || "Request failed";
    throw new Error(message);
  }

  return payload.data;
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
};
