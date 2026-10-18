/* eslint-disable @typescript-eslint/no-explicit-any */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Enum mappers: Prisma ↔ Frontend ──────────────────────

const statusMap: Record<string, string> = {
  // Prisma → Frontend
  InProgress: 'In Progress',
  OnHold: 'On Hold',
  PartiallyPaid: 'Partially Paid',
  // Already matching
  Open: 'Open',
  Completed: 'Completed',
  Paid: 'Paid',
  Unpaid: 'Unpaid',
  Overpaid: 'Overpaid',
  Pending: 'Pending',
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Urgent: 'Urgent',
};

const reverseStatusMap: Record<string, string> = {
  // Frontend → Prisma
  'In Progress': 'InProgress',
  'On Hold': 'OnHold',
  'Partially Paid': 'PartiallyPaid',
  Open: 'Open',
  Completed: 'Completed',
  Paid: 'Paid',
  Unpaid: 'Unpaid',
  Overpaid: 'Overpaid',
  Pending: 'Pending',
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Urgent: 'Urgent',
};

export function mapEnum(prismaValue: string): string {
  return statusMap[prismaValue] ?? prismaValue;
}

export function unmapEnum(frontendValue: string): string {
  return reverseStatusMap[frontendValue] ?? frontendValue;
}

// ─── Nullable unitId mapping ──────────────────────────────

export function nullToEmpty(v: string | null | undefined): string {
  return v ?? '';
}

export function emptyToNull(v: string): string | null {
  return v === '' ? null : v;
}
