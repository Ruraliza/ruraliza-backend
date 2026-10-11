import { type Result, notFound, ok } from '#shared/domain/result';
import { type CertificateRepository, toCertificate } from '../domain/certificate';
import type { Certificate } from '../track.contract';

// Validação pública: quem tem o código confere nome, trilha, carga horária e data.
export class GetCertificateUseCase {
  constructor(private readonly deps: { certificates: CertificateRepository }) {}

  async execute({ code }: { code: string }): Promise<Result<Certificate>> {
    const [found] = await this.deps.certificates.find({ code: code.trim().toUpperCase() });
    return found ? ok(toCertificate(found)) : notFound('Certificado não encontrado. Confira o código.');
  }
}
