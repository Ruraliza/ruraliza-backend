import type { OpenAPIV3 } from 'openapi-types';
import { CATEGORIES } from '../constants/categories';
import { APPLICATION_STATUS, PAYMENT_STATUS, SERVICE_STATUS } from '../constants/status';

// Schemas OpenAPI do contrato (src/contracts). Entidades usam additionalProperties: false
// para que o smoke test acuse qualquer campo não documentado nas respostas.
type Schema = OpenAPIV3.SchemaObject;
type Properties = Record<string, Schema | OpenAPIV3.ReferenceObject>;

// Nomes dos schemas. `schemas` abaixo precisa ter exatamente estes (o `satisfies` acusa falta ou sobra),
// e `ref()` só aceita estes, então um $ref quebrado não compila.
export type SchemaName =
  | 'ServiceStatus' | 'ApplicationStatus' | 'PaymentStatus' | 'AnalyzeAction'
  | 'ApiError' | 'MessageResponse' | 'HealthResponse' | 'MapsConfig' | 'CategoryList'
  | 'Farmer' | 'Worker' | 'Farm' | 'FarmPhoto' | 'FarmLocation'
  | 'Service' | 'ServiceWithFarm' | 'FarmerServiceItem' | 'OpenService'
  | 'ServiceApplication' | 'ApplicationWithWorker' | 'ApplicationWithService' | 'Payment'
  | 'FarmerInput' | 'FarmerUpdate' | 'WorkerInput' | 'WorkerUpdate' | 'FarmInput' | 'FarmUpdate'
  | 'ServiceInput' | 'ServiceUpdate' | 'AnalyzeInput' | 'WorkerActionInput'
  | 'FarmerResponse' | 'WorkerResponse' | 'FarmResponse' | 'ServiceResponse'
  | 'ApplicationResponse' | 'AnalyzeResponse' | 'PaymentResponse';

const id: Schema = { type: 'integer', minimum: 1, example: 1 };
const nullableId: Schema = { type: 'integer', minimum: 1, nullable: true, example: null };
const isoDate: Schema = { type: 'string', format: 'date-time', example: '2026-09-28T12:00:00.000Z' };
const photoUrl: Schema = {
  type: 'string',
  nullable: true,
  example: '/api/images/3f2c1b9e-8d7a-4c1e-9b1a-2f6e5d4c3b2a.webp',
  description: 'Foto de perfil (WebP, no máximo 1000px). null quando não há foto. Relativa à API.'
};
const lastDay: Schema = {
  type: 'string',
  format: 'date',
  nullable: true,
  example: '2026-10-31',
  description: 'Último dia (horário de Brasília) para receber candidaturas. null = sem prazo. Vencida, a vaga sai da busca e não aceita candidaturas, mas continua Pending: dá para renovar a data ou cancelar.'
};
const description: Schema = { type: 'string', nullable: true, maxLength: 2000, example: 'Colheita manual de café. Levar luvas e chapéu; almoço por conta da fazenda.' };
const ref = (name: SchemaName): OpenAPIV3.ReferenceObject => ({ $ref: `#/components/schemas/${name}` });

function object(properties: Properties, required: readonly string[], description?: string): Schema {
  return {
    type: 'object',
    properties,
    required: [...required],
    additionalProperties: false,
    ...(description === undefined ? {} : { description })
  };
}

// Corpos de entrada: campos extras são ignorados ou recusados pela própria rota (ver descrição).
function input(properties: Properties, required: readonly string[], description: string): Schema {
  return { type: 'object', properties, required: [...required], description };
}

// --- Propriedades reaproveitadas ---

const latitude: Schema = { type: 'number', minimum: -90, maximum: 90, example: -22.1165, description: 'Graus decimais.' };
const longitude: Schema = { type: 'number', minimum: -180, maximum: 180, example: -43.2092, description: 'Graus decimais.' };

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

const serviceProps: Properties = {
  id,
  farmer_id: id,
  farm_id: id,
  payment_id: nullableId,
  worker_id: { ...nullableId, description: 'Trabalhador aceito (null enquanto Pending).' },
  name: { type: 'string', example: 'Colheita de café' },
  description,
  category: { type: 'string', example: 'Colheita' },
  duration: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 16, description: 'Horas de trabalho.' },
  price: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 900, description: 'Valor total em R$.' },
  expires_at: lastDay,
  status: ref('ServiceStatus'),
  insertion_date: isoDate
};
const serviceRequired = ['id', 'farmer_id', 'farm_id', 'payment_id', 'worker_id', 'name', 'description', 'category', 'duration', 'price', 'expires_at', 'status', 'insertion_date'];

const applicationProps: Properties = {
  id,
  service_id: id,
  worker_id: id,
  status: ref('ApplicationStatus'),
  auto_rejected: { type: 'boolean', description: 'Recusada pelo aceite de outro candidato; volta a Pending se o aceito desistir.' },
  insertion_date: isoDate
};
const applicationRequired = ['id', 'service_id', 'worker_id', 'status', 'insertion_date'];

const cpf: Schema = {
  type: 'string',
  example: '52998224725',
  description: '11 dígitos, só números. Completo no GET do próprio perfil; mascarado (***.982.247-**) em listas e respostas embutidas.'
};

// Campos editáveis dos dois perfis (o cpf só entra no cadastro).
const profileEditableProps: Properties = {
  email: { type: 'string', format: 'email', example: 'ana@exemplo.com', description: 'Guardado em minúsculas. Único por tipo de perfil.' },
  name: { type: 'string', example: 'Ana Produtora' },
  phone: { type: 'string', example: '24999990000', description: 'Com DDD, só números.' }
};
const profileInputProps: Properties = {
  ...profileEditableProps,
  cpf: { ...cpf, description: '11 dígitos com dígitos verificadores válidos. Único por tipo de perfil.' }
};

const optionalText: Schema = { type: 'string', nullable: true };

export const schemas = {
  // --- Status ---
  ServiceStatus: { type: 'string', enum: Object.values(SERVICE_STATUS), example: 'Pending' },
  ApplicationStatus: { type: 'string', enum: Object.values(APPLICATION_STATUS), example: 'Pending' },
  PaymentStatus: { type: 'string', enum: Object.values(PAYMENT_STATUS) },
  AnalyzeAction: { type: 'string', enum: ['Accept', 'Reject'] },

  // --- Respostas genéricas ---
  ApiError: object({ error: { type: 'string', example: 'Serviço não encontrado.' } }, ['error'], 'Formato de todo erro da API.'),
  MessageResponse: object({ message: { type: 'string', example: 'Farmer deleted successfully!' } }, ['message']),
  HealthResponse: object({ message: { type: 'string' } }, ['message']),
  MapsConfig: object(
    {
      api_key: { type: 'string', example: 'AIza…', description: 'Chave do Google Maps Platform (restrita por referrer no Google Cloud).' },
      map_id: { type: 'string', example: 'DEMO_MAP_ID', description: 'Map ID para o alfinete arrastável (Advanced Marker).' }
    },
    ['api_key', 'map_id'],
    'Configuração do Google Maps para o frontend.'
  ),
  CategoryList: { type: 'array', items: { type: 'string', enum: [...CATEGORIES] }, example: [...CATEGORIES] },

  // --- Entidades ---
  Farmer: object(
    {
      id,
      email: { type: 'string', format: 'email', example: 'produtor@exemplo.com' },
      name: { type: 'string', example: 'João Produtor' },
      farms: { type: 'array', items: { type: 'integer' }, example: [1, 2], description: 'IDs das fazendas ativas.' },
      phone: { type: 'string', example: '24999999999' },
      cpf,
      photo_url: photoUrl,
      insertion_date: isoDate
    },
    ['id', 'email', 'name', 'farms', 'phone', 'cpf', 'photo_url', 'insertion_date']
  ),
  Worker: object(
    {
      id,
      email: { type: 'string', format: 'email', example: 'trabalhador@exemplo.com' },
      name: { type: 'string', example: 'Maria Trabalhadora' },
      bio: { ...optionalText, maxLength: 500, example: 'Trabalho com colheita de café há 5 anos. Disponível nos fins de semana.' },
      certificates: { ...optionalText, example: 'Certificado de Tratorista' },
      courses: { ...optionalText, example: 'NR-31 (SENAR, 2024)' },
      experience: { ...optionalText, example: '5 anos' },
      phone: { type: 'string', example: '24988888888' },
      cpf,
      photo_url: photoUrl,
      insertion_date: isoDate
    },
    ['id', 'email', 'name', 'bio', 'certificates', 'courses', 'experience', 'phone', 'cpf', 'photo_url', 'insertion_date']
  ),
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
      longitude: { ...longitude, description: 'Só para o trabalhador aceito no serviço.' }
    },
    ['city', 'state', 'photos'],
    'Local da fazenda exposto ao trabalhador (sem o endereço completo; o ponto no mapa só vai para o trabalhador aceito).'
  ),
  Service: object(serviceProps, serviceRequired),
  ServiceWithFarm: object({ ...serviceProps, farm: ref('Farm') }, [...serviceRequired, 'farm']),
  FarmerServiceItem: object(
    { ...serviceProps, farm: ref('Farm'), applications_pending: { type: 'integer', minimum: 0, example: 2 } },
    [...serviceRequired, 'farm', 'applications_pending']
  ),
  OpenService: object({ ...serviceProps, farm: ref('FarmLocation') }, [...serviceRequired, 'farm']),
  ServiceApplication: object(applicationProps, applicationRequired),
  ApplicationWithWorker: object(
    { ...applicationProps, worker: ref('Worker') },
    [...applicationRequired, 'worker'],
    'O CPF do trabalhador vem mascarado.'
  ),
  ApplicationWithService: object({ ...applicationProps, service: ref('OpenService') }, [...applicationRequired, 'service']),
  Payment: object(
    {
      id,
      service_id: id,
      farmer_id: id,
      worker_id: id,
      value: { type: 'number', example: 900 },
      status: ref('PaymentStatus'),
      insertion_date: isoDate
    },
    ['id', 'service_id', 'farmer_id', 'worker_id', 'value', 'status', 'insertion_date'],
    'Pagamento simulado: nenhum dinheiro é movimentado.'
  ),

  // --- Entradas ---
  FarmerInput: input(profileInputProps, ['email', 'name', 'phone', 'cpf'], 'Cadastro de produtor.'),
  FarmerUpdate: input(
    profileEditableProps,
    [],
    'Edição parcial: envie só o que muda. Enviar `id` ou `cpf` resulta em 400.'
  ),
  WorkerInput: input(
    {
      ...profileInputProps,
      bio: { ...optionalText, maxLength: 500, description: 'Breve apresentação. Vazio vira null.' },
      certificates: { ...optionalText, maxLength: 1000, example: 'NR-31, curso de tratorista', description: 'Vazio vira null.' },
      courses: { ...optionalText, maxLength: 1000, example: 'Operação de trator (SENAR)', description: 'Vazio vira null.' },
      experience: { ...optionalText, maxLength: 1000, example: '5 anos em colheita de café', description: 'Vazio vira null.' }
    },
    ['email', 'name', 'phone', 'cpf'],
    'Cadastro de trabalhador.'
  ),
  WorkerUpdate: input(
    {
      ...profileEditableProps,
      bio: { ...optionalText, maxLength: 500, description: 'null limpa o campo.' },
      certificates: { ...optionalText, maxLength: 1000, description: 'null limpa o campo.' },
      courses: { ...optionalText, maxLength: 1000, description: 'null limpa o campo.' },
      experience: { ...optionalText, maxLength: 1000, description: 'null limpa o campo.' }
    },
    [],
    'Edição parcial: envie só o que muda. Enviar `id` ou `cpf` resulta em 400.'
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
  ServiceInput: input(
    {
      farmer_id: id,
      farm_id: id,
      name: { type: 'string', example: 'Colheita de café' },
      description: { ...description, description: 'Opcional. Vazio vira null.' },
      category: { type: 'string', example: 'Colheita', description: 'Uma das categorias de GET /api/categories.' },
      duration: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 16, description: 'Horas.' },
      price: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 900, description: 'R$.' },
      expires_at: { ...lastDay, description: 'Opcional: último dia para candidaturas (hoje ou futuro).' }
    },
    ['farmer_id', 'farm_id', 'name', 'category', 'duration', 'price'],
    'Publicação de serviço. A fazenda precisa ser ativa e do mesmo produtor.'
  ),
  ServiceUpdate: input(
    {
      farm_id: id,
      name: { type: 'string' },
      description: { ...description, description: 'null ou vazio remove a descrição.' },
      category: { type: 'string' },
      duration: { type: 'number', exclusiveMinimum: true, minimum: 0 },
      price: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 1200 },
      expires_at: { ...lastDay, description: 'Nova validade (hoje ou futuro); null remove o prazo. Renova uma vaga vencida.' }
    },
    [],
    'Edição parcial. Enviar `farmer_id`, `worker_id`, `payment_id` ou `status` resulta em 400.'
  ),
  AnalyzeInput: input(
    { application_id: id, action: ref('AnalyzeAction') },
    ['application_id', 'action'],
    'Accept: o serviço passa a In Progress e as demais candidaturas pendentes são recusadas.'
  ),
  WorkerActionInput: input({ worker_id: id }, ['worker_id'], 'Trabalhador que executa a ação.'),

  // --- Respostas das escritas ---
  FarmerResponse: object({ message: { type: 'string', example: 'Farmer created successfully!' }, farmer: ref('Farmer') }, ['message', 'farmer']),
  WorkerResponse: object({ message: { type: 'string', example: 'Worker created successfully!' }, worker: ref('Worker') }, ['message', 'worker']),
  FarmResponse: object({ message: { type: 'string', example: 'Farm registered successfully!' }, farm: ref('Farm') }, ['message', 'farm']),
  ServiceResponse: object({ message: { type: 'string', example: 'Service requested successfully!' }, service: ref('Service') }, ['message', 'service']),
  ApplicationResponse: object(
    { message: { type: 'string', example: 'Application sent successfully!' }, application: ref('ServiceApplication') },
    ['message', 'application']
  ),
  AnalyzeResponse: object(
    {
      message: { type: 'string', example: 'Worker accepted successfully. Service is now in progress!' },
      application: ref('ServiceApplication'),
      service: { allOf: [ref('Service')], description: 'Só no Accept.' }
    },
    ['message', 'application']
  ),
  PaymentResponse: object(
    { message: { type: 'string', example: 'Payment released and service completed successfully!' }, service: ref('Service'), payment: ref('Payment') },
    ['message', 'service', 'payment']
  )
} satisfies Record<SchemaName, Schema>;

export { ref };
