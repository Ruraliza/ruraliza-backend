import type { ApplicationStatus, PaymentStatus, ProposalStatus } from '../hiring.contract';

// Status em inglês na API; a tradução acontece só na UI.
export const APPLICATION_STATUS = Object.freeze({
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected'
} as const satisfies Record<string, ApplicationStatus>);

export const PAYMENT_STATUS = Object.freeze({
  COMPLETED: 'Completed'
} as const satisfies Record<string, PaymentStatus>);

export const PROPOSAL_STATUS = Object.freeze({
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  SUPERSEDED: 'Superseded'
} as const satisfies Record<string, ProposalStatus>);
