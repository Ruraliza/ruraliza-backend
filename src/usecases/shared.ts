import type { Farm, OpenService, Service } from '../contracts';
import { SERVICE_STATUS } from '../constants/status';
import { isPastDay } from '../domain/dates';
import type { FarmRepository } from '../domain/repositories';
import { type Result, conflict, ok, requireFound } from '../domain/result';

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

// --- Fazendas ---

// Fazenda removida pelo produtor continua guardada (deleted_at) para o histórico dos serviços,
// mas some das listas e não pode mais ser editada nem receber serviços.
export function isActiveFarm(farm: Farm): boolean {
  return farm.deleted_at === undefined;
}

export async function findActiveFarm(farms: FarmRepository, id: number): Promise<Farm | undefined> {
  const farm = await farms.findById(id);
  return farm && isActiveFarm(farm) ? farm : undefined;
}

// A fazenda de um serviço (mesmo arquivada) sempre existe enquanto o serviço existir.
export async function farmOf(farms: FarmRepository, service: Service): Promise<Farm> {
  return requireFound(await farms.findById(service.farm_id), `fazenda do serviço ${service.id}`);
}

// Cidade/UF e fotos da fazenda do serviço (o endereço completo não é exposto ao trabalhador).
export async function toOpenService(farms: FarmRepository, service: Service): Promise<OpenService> {
  const farm = await farmOf(farms, service);
  return { ...service, farm: { city: farm.city, state: farm.state, photos: farm.photos.map((p) => p.url) } };
}

// --- Serviços ---

// Vaga aberta cujo último dia para candidaturas já passou. Continua Pending (o produtor pode
// renovar a validade ou cancelar), mas sai das vagas e não recebe candidaturas.
export function isExpired(service: Service, nowIso: string): boolean {
  return service.status === SERVICE_STATUS.PENDING && service.expires_at !== null && isPastDay(service.expires_at, nowIso);
}
