import type { AdminVerification } from '../verification.contract';
import { type VerificationDeps, toAdminVerification } from './verification-deps';

type Status = AdminVerification['status'];

// Fila da equipe: o envio mais antigo primeiro (quem espera há mais tempo); `status` filtra.
export class ListVerificationsUseCase {
  constructor(private readonly deps: VerificationDeps) {}

  async execute({ status }: { status?: Status | undefined } = {}): Promise<AdminVerification[]> {
    const records = await this.deps.verifications.find(status ? { status } : {});
    records.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at) || a.id - b.id);
    return Promise.all(records.map((record) => toAdminVerification(this.deps, record)));
  }
}
