import type { ApplicationStatus, PaymentStatus, ServiceStatus } from '../contracts';

// Status em inglês na API; a tradução acontece só na UI.
export const SERVICE_STATUS = Object.freeze({
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
} as const satisfies Record<string, ServiceStatus>);

export const APPLICATION_STATUS = Object.freeze({
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected'
} as const satisfies Record<string, ApplicationStatus>);

export const PAYMENT_STATUS = Object.freeze({
  COMPLETED: 'Completed'
} as const satisfies Record<string, PaymentStatus>);

const SERVICE_STATUSES: readonly ServiceStatus[] = Object.values(SERVICE_STATUS);

export function isServiceStatus(value: unknown): value is ServiceStatus {
  return SERVICE_STATUSES.some((status) => status === value);
}

export function serviceStatusList(): string {
  return SERVICE_STATUSES.join(', ');
}
