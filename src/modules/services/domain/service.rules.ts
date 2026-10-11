import { type FarmLocation, type FarmRepository, farmOf } from '#modules/farms';
import { isPastDay } from '#shared/domain/dates';
import { type Result, invalid, ok } from '#shared/domain/result';
import type { OpenService, Service } from '../service.contract';
import { SERVICE_STATUS } from './service-status';

// Vaga aberta cujo último dia para candidaturas já passou. Continua Pending (o produtor pode
// renovar a validade ou cancelar), mas sai das vagas e não recebe candidaturas.
export function isExpired(service: Service, nowIso: string): boolean {
  return service.status === SERVICE_STATUS.PENDING && service.expires_at !== null && isPastDay(service.expires_at, nowIso);
}

// A validade é o último dia para candidaturas: não pode ficar no passado.
export function checkExpiry(expiresAt: string | null | undefined, nowIso: string): Result<null> {
  if (expiresAt && isPastDay(expiresAt, nowIso)) {
    return invalid('A validade precisa ser hoje ou uma data futura.');
  }
  return ok(null);
}

// Cidade/UF e fotos da fazenda do serviço (o endereço completo não é exposto ao trabalhador).
// O ponto no mapa só vai para o trabalhador aceito no serviço (`viewerWorkerId`).
export async function toOpenService(farms: FarmRepository, service: Service, viewerWorkerId?: number): Promise<OpenService> {
  const farm = await farmOf(farms, service);
  const location: FarmLocation = { city: farm.city, state: farm.state, photos: farm.photos.map((p) => p.url) };
  const isAssignee = viewerWorkerId !== undefined && service.worker_id === viewerWorkerId;
  if (isAssignee && farm.latitude !== null && farm.longitude !== null) {
    location.latitude = farm.latitude;
    location.longitude = farm.longitude;
  }
  return { ...service, farm: location };
}
