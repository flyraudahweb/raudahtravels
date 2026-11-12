import { useQuery } from "@tanstack/react-query";

export const ehajjPermissions = [
  "pilgrims",
  "operations",
  "finance",
  "documents",
] as const;
export type EhajjPermission = (typeof ehajjPermissions)[number];
export type EhajjProduct = {
  id: number;
  name: string;
  description: string;
  activity: string;
  edition: string;
  permissions: EhajjPermission[];
};

export async function ehajjRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch("/api/admin/ehajj" + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(result?.error || "EHajj could not complete this request.");
  return result as T;
}

export function useEhajjAccess(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ["ehajj", userId, "access"],
    queryFn: ({ signal }) =>
      ehajjRequest<{ allowed: boolean; manage: boolean }>("/access", {
        signal,
      }),
    enabled: !!userId && enabled,
    retry: false,
    gcTime: 0,
  });
}
