// Trabalhadores com a identidade conferida pela equipe (módulo de verificação; o container liga).
export interface WorkerVerificationReader {
  verifiedWorkers(workerIds: readonly number[]): Promise<ReadonlySet<number>>;
}

export const NO_VERIFIED_WORKERS: WorkerVerificationReader = { verifiedWorkers: () => Promise.resolve(new Set()) };
