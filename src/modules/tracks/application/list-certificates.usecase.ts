import { type CertificateRepository, toCertificate } from '../domain/certificate';
import type { Certificate } from '../track.contract';

// Certificados do trabalhador, os mais recentes primeiro.
export class ListCertificatesUseCase {
  constructor(private readonly deps: { certificates: CertificateRepository }) {}

  async execute({ workerId }: { workerId: number }): Promise<Certificate[]> {
    return (await this.deps.certificates.find({ worker_id: workerId }))
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at) || b.id - a.id)
      .map(toCertificate);
  }
}
