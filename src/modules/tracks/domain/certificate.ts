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

// Os dados impressos no certificado, cobertos pelo resumo (`data_hash`).
export type CertificateData = Pick<Certificate, 'code' | 'worker_name' | 'track_title' | 'workload_minutes' | 'completed_at'>;

// Calcula o resumo SHA-256 (hex) de certificateHashText, na emissão.
export interface CertificateHasher {
  hash(data: CertificateData): string;
}

// O texto resumido: JSON de [código, nome, trilha, carga horária em minutos, conclusão em ISO 8601], sem espaços,
// em UTF-8. Quem confere recalcula com os dados de GET /api/certificates/:code. Mudar o formato muda o resumo
// dos certificados novos; os já emitidos guardam o seu.
export function certificateHashText(data: CertificateData): string {
  return JSON.stringify([data.code, data.worker_name, data.track_title, data.workload_minutes, data.completed_at]);
}

export function toCertificate(record: CertificateRecord): Certificate {
  return {
    code: record.code,
    track_id: record.track_id,
    track_title: record.track_title,
    worker_name: record.worker_name,
    workload_minutes: record.workload_minutes,
    completed_at: record.completed_at,
    data_hash: record.data_hash
  };
}
