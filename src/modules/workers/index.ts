// API pública do módulo de trabalhadores: o único arquivo que outros módulos enxergam (#modules/workers).
export type * from './worker.contract';
export type { NewWorker, NewWorkerProfile } from './application/create-worker-profile.usecase';
export type { WorkerRepository } from './domain/worker.repository';
export { createInMemoryWorkerRepository } from './infra/in-memory-worker.repository';
export { parseWorkerUpdate } from './presentation/worker.parsers';
export type { WorkerRoutes } from './presentation/worker.routes';
export { type WorkerSchemaName, workerSchema, workerSchemas } from './presentation/worker.schemas';
export { type WorkerUseCases, type WorkersModuleDeps, createWorkerRoutes, createWorkerUseCases } from './workers.module';
