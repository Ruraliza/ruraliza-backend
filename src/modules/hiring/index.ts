// API pública do módulo de contratação: o único arquivo que outros módulos enxergam (#modules/hiring).
export type * from './hiring.contract';
export type { ApplicationRepository } from './domain/application.repository';
export { type HiringEvents, NO_HIRING_EVENTS, type NegotiationChat, type NegotiationChats, type WorkerReputationReader } from './domain/hiring-events';
export { NO_VERIFIED_WORKERS, type WorkerVerificationReader } from './domain/worker-verification';
export { APPLICATION_STATUS, PAYMENT_STATUS, PROPOSAL_STATUS } from './domain/hiring-status';
export type { PaymentRepository } from './domain/payment.repository';
export { createInMemoryPaymentRepository } from './infra/in-memory-payment.repository';
export { createPgPaymentRepository } from './infra/pg-payment.repository';
export { servicePaymentReader } from './application/service-payment-reader';
export type { ProposalRepository } from './domain/proposal.repository';
export { createInMemoryProposalRepository } from './infra/in-memory-proposal.repository';
export { createPgProposalRepository } from './infra/pg-proposal.repository';
export { createInMemoryApplicationRepository } from './infra/in-memory-application.repository';
export { createPgApplicationRepository } from './infra/pg-application.repository';
export type { HiringRoutes } from './presentation/hiring.routes';
export { type HiringSchemaName, hiringSchemas } from './presentation/hiring.schemas';
export { type HiringModuleDeps, type HiringUseCases, createHiringRoutes, createHiringUseCases } from './hiring.module';
