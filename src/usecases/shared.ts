import type { FarmLocation, OpenService, Service } from '../contracts';
import { SERVICE_STATUS } from '../constants/status';
import { isPastDay } from '#shared/domain/dates';
import { type FarmRepository, farmOf } from '#modules/farms';
import { type Result, conflict, ok } from '#shared/domain/result';

// --- Perfis (produtor e trabalhador) ---

// Só o que a checagem de unicidade precisa (FarmerRepository e WorkerRepository cumprem).
interface ProfileLookup {
  find(criteria: { email?: string; cpf?: string }): Promise<{ id: number }[]>;
}

// Unicidade de e-mail/CPF entre perfis do MESMO tipo. Sem `currentId`: cadastro (confere e-mail e CPF).
// Com `currentId`: edição (só o e-mail muda, e o próprio perfil não conta).
export async function checkProfileUnique(
  profiles: ProfileLookup,
  email: string | undefined,
  cpf: string | undefined,
  currentId?: number
): Promise<Result<null>> {
  if (email !== undefined) {
    const sameEmail = await profiles.find({ email });
    if (sameEmail.some((p) => p.id !== currentId)) {
      return conflict('Já existe um cadastro com este e-mail.');
    }
  }
  if (cpf !== undefined) {
    const sameCpf = await profiles.find({ cpf });
    if (sameCpf.length > 0) {
      return conflict('Já existe um cadastro com este CPF.');
    }
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

// --- Serviços ---

// Vaga aberta cujo último dia para candidaturas já passou. Continua Pending (o produtor pode
// renovar a validade ou cancelar), mas sai das vagas e não recebe candidaturas.
export function isExpired(service: Service, nowIso: string): boolean {
  return service.status === SERVICE_STATUS.PENDING && service.expires_at !== null && isPastDay(service.expires_at, nowIso);
}
