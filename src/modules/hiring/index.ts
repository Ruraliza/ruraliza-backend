// API pública do módulo de contratação: o único arquivo que outros módulos enxergam (#modules/hiring).
export type * from './hiring.contract';
export type { ApplicationRepository } from './domain/application.repository';
export { type HiringEvents, NO_HIRING_EVENTS, type WorkerReputationReader } from './domain/hiring-events';
export { APPLICATION_STATUS, PAYMENT_STATUS } from './domain/hiring-status';
export type { PaymentRepository } from './domain/payment.repository';
export { createInMemoryApplicationRepository } from './infra/in-memory-application.repository';
export { createInMemoryPaymentRepository } from './infra/in-memory-payment.repository';
export type { HiringRoutes } from './presentation/hiring.routes';
export { type HiringSchemaName, hiringSchemas } from './presentation/hiring.schemas';
export { type HiringModuleDeps, type HiringUseCases, createHiringRoutes, createHiringUseCases } from './hiring.module';
