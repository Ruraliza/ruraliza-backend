import type { Repository } from '#shared/domain/repository';
import type { Certificate } from '../track.contract';

// Certificado como fica guardado: os dados do momento da emissão, mais o trabalhador.
// TODO(db): tabela `certificates` com UNIQUE (code) e UNIQUE (track_id, worker_id).
export interface CertificateRecord extends Certificate {
  id: number;
  worker_id: number;
  issued_at: string;
}

export type CertificateRepository = Repository<CertificateRecord, 'code' | 'worker_id' | 'track_id'>;

// Gera os códigos de validação (aleatórios, legíveis e difíceis de adivinhar).
export interface CertificateCodes {
  create(): string;
}

export function toCertificate(record: CertificateRecord): Certificate {
  return {
    code: record.code,
    track_id: record.track_id,
    track_title: record.track_title,
    worker_name: record.worker_name,
    workload_minutes: record.workload_minutes,
    completed_at: record.completed_at
  };
}
