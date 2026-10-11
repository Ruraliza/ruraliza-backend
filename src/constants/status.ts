import type { ApplicationStatus, PaymentStatus } from '../contracts';

// Status em inglês na API; a tradução acontece só na UI. (SERVICE_STATUS fica em src/modules/services.)
export const APPLICATION_STATUS = Object.freeze({
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected'
} as const satisfies Record<string, ApplicationStatus>);

export const PAYMENT_STATUS = Object.freeze({
  COMPLETED: 'Completed'
} as const satisfies Record<string, PaymentStatus>);
