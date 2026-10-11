import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { isLatitude, isLongitude, missingFields, text } from '#shared/utils/validation';
import type { FarmInput, FarmUpdate } from '../farm.contract';

// Formato dos corpos das rotas de fazenda (400). Regras que dependem dos dados ficam nos casos de uso.

const FARM_FIELDS = ['address', 'city', 'state'] as const satisfies readonly (keyof FarmInput)[];
const FARM_COORDINATES = ['latitude', 'longitude'] as const satisfies readonly (keyof FarmInput)[];

const INVALID_COORDINATES = 'Latitude/longitude inválidas. Envie números em graus decimais (latitude entre -90 e 90, longitude entre -180 e 180).';

export function parseFarmInput(body: Body): Result<FarmInput> {
  const missing = missingFields(body, [...FARM_FIELDS, ...FARM_COORDINATES]);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const { latitude, longitude } = body;
  if (!isLatitude(latitude) || !isLongitude(longitude)) return invalid(INVALID_COORDINATES);

  return ok({ address: text(body['address']), city: text(body['city']), state: text(body['state']), latitude, longitude });
}

export function parseFarmUpdate(body: Body): Result<FarmUpdate> {
  if (body['id'] !== undefined || body['farmer_id'] !== undefined) {
    return invalid('Só é possível alterar endereço, cidade, estado e localização.');
  }

  const blank = FARM_FIELDS.filter((f) => body[f] !== undefined && !text(body[f]).trim());
  if (blank.length > 0) return invalid(`Estes campos não podem ficar vazios: ${blank.join(', ')}.`);

  const update: FarmUpdate = {};
  for (const field of FARM_FIELDS) {
    const value = body[field];
    if (value !== undefined) update[field] = text(value).trim();
  }

  // O ponto do mapa muda inteiro: latitude e longitude sempre juntas.
  const { latitude, longitude } = body;
  if (latitude !== undefined || longitude !== undefined) {
    if (latitude === undefined || longitude === undefined) return invalid('Envie latitude e longitude juntas.');
    if (!isLatitude(latitude) || !isLongitude(longitude)) return invalid(INVALID_COORDINATES);
    update.latitude = latitude;
    update.longitude = longitude;
  }
  return ok(update);
}
