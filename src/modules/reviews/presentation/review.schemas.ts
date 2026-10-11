import { type Properties, type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';
import { MAX_REVIEW_COMMENT } from '../domain/review.rules';

// Schemas OpenAPI das avaliações (contrato em ../reviews.contract.ts). Registrados em src/docs/schemas.ts.
export type ReviewSchemaName =
  | 'WorkerReview' | 'FarmReview' | 'WorkerReviewInput' | 'FarmReviewInput'
  | 'WorkerReputation' | 'FarmReputation' | 'WorkerReviewItem' | 'FarmReviewItem'
  | 'WorkerReviewsPage' | 'FarmReviewsPage' | 'FarmerServiceReviews' | 'WorkerServiceReviews'
  | 'FarmerReviewResponse' | 'WorkerReviewResponse' | 'PendingReview';

const ref: RefTo<ReviewSchemaName> = refTo;

const score = (description: string): Schema => ({ type: 'integer', minimum: 1, maximum: 5, example: 5, description });
const average = (description: string): Schema => ({ type: 'number', minimum: 1, maximum: 5, nullable: true, example: 4.7, description });
const comment: Schema = { type: 'string', maxLength: MAX_REVIEW_COMMENT, nullable: true, example: 'Chegou cedo e caprichou na colheita.' };

const workerScores: Properties = {
  punctuality: score('Pontualidade: chegou e cumpriu o horário combinado.'),
  effort: score('Empenho durante o serviço.'),
  quality: score('Qualidade: o trabalho ficou bem feito.')
};
const farmScores: Properties = {
  infrastructure: score('Infraestrutura: ferramentas, equipamentos e instalações.'),
  conditions: score('Condições de trabalho: água, sombra, EPI e segurança.'),
  as_described: score('O serviço foi como o anúncio dizia.')
};

const workerReviewProps: Properties = { id, service_id: id, farmer_id: id, worker_id: id, ...workerScores, comment, insertion_date: isoDate };
const workerReviewRequired = ['id', 'service_id', 'farmer_id', 'worker_id', 'punctuality', 'effort', 'quality', 'comment', 'insertion_date'];
const farmReviewProps: Properties = { id, service_id: id, farm_id: id, farmer_id: id, worker_id: id, ...farmScores, comment, insertion_date: isoDate };
const farmReviewRequired = ['id', 'service_id', 'farm_id', 'farmer_id', 'worker_id', 'infrastructure', 'conditions', 'as_described', 'comment', 'insertion_date'];

const itemProps: Properties = {
  service_name: { type: 'string', example: 'Colheita de café' },
  category: { type: 'string', example: 'Colheita' },
  author: { type: 'string', example: 'Produtor em Três Rios, RJ', description: 'Quem avaliou, sem identificar a pessoa.' }
};
const itemRequired = ['service_name', 'category', 'author'];

const reputationBase: Properties = {
  average: average('Média geral (uma casa decimal); null sem avaliações publicadas.'),
  count: { type: 'integer', minimum: 0, example: 12 },
  score: { type: 'number', example: 4.52, description: 'Média ponderada pela quantidade de avaliações, para ordenar.' }
};

// Também aparecem como `nullable` em FarmerServiceReviews/WorkerServiceReviews (allOf + nullable não aceita null).
const workerReviewSchema = object(workerReviewProps, workerReviewRequired, 'O produtor avalia o trabalhador.');
const farmReviewSchema = object(farmReviewProps, farmReviewRequired, 'O trabalhador avalia a propriedade.');

function serviceReviews(given: Schema, received: Schema, description: string): Schema {
  return object(
    {
      can_review: { type: 'boolean', description: 'Serviço concluído, dentro do prazo e ainda sem a sua avaliação.' },
      window_ends_at: { ...isoDate, nullable: true, description: 'Fim do prazo para avaliar (14 dias depois do pagamento); null se o serviço não foi concluído.' },
      given: { ...given, nullable: true, description: 'A avaliação que você escreveu.' },
      received: { ...received, nullable: true, description: 'A avaliação que você recebeu, só depois de publicada.' },
      received_hidden: { type: 'boolean', description: 'A outra parte já avaliou; aparece quando você avaliar (ou o prazo acabar).' }
    },
    ['can_review', 'window_ends_at', 'given', 'received', 'received_hidden'],
    description
  );
}

export const reviewSchemas = {
  WorkerReview: workerReviewSchema,
  FarmReview: farmReviewSchema,
  WorkerReviewInput: input({ ...workerScores, comment }, ['punctuality', 'effort', 'quality'], 'Notas inteiras de 1 a 5 e comentário opcional.'),
  FarmReviewInput: input({ worker_id: id, ...farmScores, comment }, ['worker_id', 'infrastructure', 'conditions', 'as_described'], 'Notas inteiras de 1 a 5 e comentário opcional.'),
  WorkerReputation: object(
    {
      ...reputationBase,
      punctuality: average('Média de pontualidade.'),
      effort: average('Média de empenho.'),
      quality: average('Média de qualidade.')
    },
    ['average', 'count', 'score', 'punctuality', 'effort', 'quality'],
    'Só as avaliações publicadas contam.'
  ),
  FarmReputation: object(
    {
      ...reputationBase,
      infrastructure: average('Média de infraestrutura.'),
      conditions: average('Média de condições de trabalho.'),
      as_described: average('Média de "fiel ao anúncio".')
    },
    ['average', 'count', 'score', 'infrastructure', 'conditions', 'as_described'],
    'Só as avaliações publicadas contam.'
  ),
  WorkerReviewItem: object({ ...workerReviewProps, ...itemProps }, [...workerReviewRequired, ...itemRequired]),
  FarmReviewItem: object({ ...farmReviewProps, ...itemProps }, [...farmReviewRequired, ...itemRequired]),
  WorkerReviewsPage: object({ reputation: ref('WorkerReputation'), reviews: { type: 'array', items: ref('WorkerReviewItem') } }, ['reputation', 'reviews']),
  FarmReviewsPage: object({ reputation: ref('FarmReputation'), reviews: { type: 'array', items: ref('FarmReviewItem') } }, ['reputation', 'reviews']),
  FarmerServiceReviews: serviceReviews(workerReviewSchema, farmReviewSchema, 'Avaliações do serviço vistas pelo produtor.'),
  WorkerServiceReviews: serviceReviews(farmReviewSchema, workerReviewSchema, 'Avaliações do serviço vistas pelo trabalhador.'),
  FarmerReviewResponse: object({ message: { type: 'string', example: 'Review saved.' }, reviews: ref('FarmerServiceReviews') }, ['message', 'reviews']),
  WorkerReviewResponse: object({ message: { type: 'string', example: 'Review saved.' }, reviews: ref('WorkerServiceReviews') }, ['message', 'reviews']),
  PendingReview: object(
    {
      service_id: id,
      service_name: { type: 'string', example: 'Colheita de café' },
      category: { type: 'string', example: 'Colheita' },
      window_ends_at: isoDate,
      subject: { type: 'string', example: 'Maria Trabalhadora', description: 'Quem será avaliado: o trabalhador, ou "Fazenda em <cidade>, <UF>".' },
      photo_url: { type: 'string', nullable: true, example: null },
      received_hidden: { type: 'boolean', description: 'A outra parte já avaliou e espera a sua avaliação para publicar.' }
    },
    ['service_id', 'service_name', 'category', 'window_ends_at', 'subject', 'photo_url', 'received_hidden']
  )
} satisfies Record<ReviewSchemaName, Schema>;
