import type { ServiceRepository } from '#modules/services';
import type { Transaction } from '#shared/domain/transaction';
import type { ApplicationRepository } from './application.repository';
import type { PaymentRepository } from './payment.repository';
import type { ProposalRepository } from './proposal.repository';

// O que o aceite, a recusa, a desistência, as propostas e o pagamento gravam juntos: ou tudo, ou nada.
export interface HiringStores {
  services: ServiceRepository;
  applications: ApplicationRepository;
  payments: PaymentRepository;
  proposals: ProposalRepository;
}

export type HiringTransaction = Transaction<HiringStores>;
