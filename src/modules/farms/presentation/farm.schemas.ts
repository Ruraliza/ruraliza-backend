import type { ReviewSchemaName } from '#modules/reviews';
import { type Properties, type RefTo, type Schema, id, input, isoDate, latitude, longitude, object, refTo } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI das fazendas (contrato em ../farm.contract.ts). Registrados em src/docs/schemas.ts.
export type FarmSchemaName = 'Farm' | 'FarmPhoto' | 'FarmLocation' | 'FarmInput' | 'FarmUpdate' | 'FarmResponse';

const ref: RefTo<FarmSchemaName> = refTo;
const reviewRef: RefTo<ReviewSchemaName> = refTo;

const farmProps: Properties = {
  id,
  farmer_id: id,
  address: { type: 'string', example: 'Estrada de Terra, Km 2' },
  city: { type: 'string', example: 'Três Rios' },
  state: { type: 'string', example: 'RJ', description: 'UF' },
  latitude: { ...latitude, nullable: true, description: 'Ponto marcado no mapa (null em fazendas cadastradas antes do mapa).' },
  longitude: { ...longitude, nullable: true },
  photos: { type: 'array', maxItems: 6, items: ref('FarmPhoto'), description: 'Até 6 fotos, na ordem de envio (a primeira é a capa).' },
  insertion_date: isoDate,
  deleted_at: { ...isoDate, description: 'Presente quando a fazenda foi removida (fica só no histórico dos serviços).' }
};
const farmRequired = ['id', 'farmer_id', 'address', 'city', 'state', 'latitude', 'longitude', 'photos', 'insertion_date'];

export const farmSchemas = {
  Farm: object(farmProps, farmRequired),
  FarmPhoto: object(
    {
      id: { type: 'string', example: '3f2c1b9e-8d7a-4c1e-9b1a-2f6e5d4c3b2a.webp', description: 'Usado para remover a foto.' },
      url: { type: 'string', example: '/api/images/3f2c1b9e-8d7a-4c1e-9b1a-2f6e5d4c3b2a.webp' }
    },
    ['id', 'url'],
    'Foto da fazenda (WebP, no máximo 1000px).'
  ),
  FarmLocation: object(
    {
      city: { type: 'string', example: 'Três Rios' },
      state: { type: 'string', example: 'RJ' },
      photos: { type: 'array', items: { type: 'string' }, example: ['/api/images/3f2c….webp'], description: 'URLs das fotos da fazenda (a primeira é a capa).' },
      latitude: { ...latitude, description: 'Só para o trabalhador aceito no serviço.' },
      longitude: { ...longitude, description: 'Só para o trabalhador aceito no serviço.' },
      reputation: { allOf: [reviewRef('FarmReputation')], description: 'Avaliações publicadas da fazenda (na busca e no detalhe da vaga).' },
      farmer_verified: { type: 'boolean', enum: [true], example: true, description: 'O produtor tem a identidade conferida pela equipe (só vem quando é verdade; na busca e no detalhe da vaga).' }
    },
    ['city', 'state', 'photos'],
    'Local da fazenda exposto ao trabalhador (sem o endereço completo; o ponto no mapa só vai para o trabalhador aceito).'
  ),

  FarmInput: input(
    {
      address: { type: 'string', example: 'Estrada Velha, Km 3' },
      city: { type: 'string', example: 'Três Rios' },
      state: { type: 'string', example: 'RJ' },
      latitude,
      longitude
    },
    ['address', 'city', 'state', 'latitude', 'longitude'],
    'Cadastro de fazenda com o ponto marcado no mapa.'
  ),
  FarmUpdate: input(
    {
      address: { type: 'string', example: 'Estrada Velha, Km 5' },
      city: { type: 'string' },
      state: { type: 'string' },
      latitude,
      longitude
    },
    [],
    'Edição parcial. Campos não podem ficar vazios; latitude e longitude vão sempre juntas; enviar `id` ou `farmer_id` resulta em 400.'
  ),

  FarmResponse: object({ message: { type: 'string', example: 'Farm registered successfully!' }, farm: ref('Farm') }, ['message', 'farm'])
} satisfies Record<FarmSchemaName, Schema>;
