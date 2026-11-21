import type { AccessPolicies } from '#modules/auth';
import type { CoreSchemaName } from '#shared/infra/docs/core.schemas';
import { TAGS, operation, pathParam, queryParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { MatchingController } from './matching.controller';
import type { MatchingSchemaName } from './matching.schemas';

const matchingOperation = operation<MatchingSchemaName | CoreSchemaName>;
const workerId = pathParam('id', 'ID do trabalhador.');

const HOW =
  'Combinam as vagas da categoria que a pessoa escolheu, das trilhas que ela faz (a concluída pesa mais) ou, sem nada disso, ' +
  'das vagas em que já se candidatou; com "perto de mim", só as que ficam dentro do raio (em linha reta; o ponto da fazenda não sai da API).';

export interface MatchingRoutes {
  // Em /api/workers (antes de '/:id').
  worker: readonly RouteDef[];
  // Em /api/farmers, junto das rotas '/services/...'.
  farmer: readonly RouteDef[];
}

export function matchingRoutes(matching: MatchingController, access: AccessPolicies): MatchingRoutes {
  const worker = [
    route('get', '/:id/job-preferences', matching.getJobPreferences, matchingOperation({
      tag: TAGS.jobs,
      summary: 'Preferências de vaga',
      description:
        'O que o trabalhador quer fazer, onde está, se quer avisos e se aparece no catálogo de prestadores. ' +
        'Sem nada salvo: `{ categories: [], near: null, alerts: false, catalog: true }`.',
      params: [workerId],
      success: { status: 200, description: 'Preferências.', schema: 'JobPreferences' },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker()),

    route('put', '/:id/job-preferences', matching.saveJobPreferences, matchingOperation({
      tag: TAGS.jobs,
      summary: 'Salvar preferências de vaga',
      description:
        'Troca tudo. A região fica guardada com 2 casas decimais (cerca de 1 km). Com `alerts`, a pessoa recebe na hora as vagas novas ' +
        'que combinam (no máximo 3 por dia, nunca a mesma duas vezes) e, uma vez por semana, o resumo das recomendadas. ' +
        'Com `catalog` (começa ligado), o perfil aparece para os produtores que publicam vagas nas categorias escolhidas; desligado, ' +
        'sai na hora de todos os catálogos. Sem `catalog` no corpo, fica como estava.',
      params: [workerId],
      body: 'JobPreferences',
      success: { status: 200, description: 'Preferências salvas.', schema: 'JobPreferencesResponse' },
      errors: { 400: 'Categoria desconhecida; região ou raio inválidos; `alerts` ou `catalog` não são true/false.', 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker()),

    route('get', '/:id/recommended-jobs', matching.recommendedJobs, matchingOperation({
      tag: TAGS.jobs,
      summary: 'Vagas para você',
      description: `Vagas abertas que combinam com o trabalhador, da que mais combina para a que menos, com os motivos. ${HOW} ` +
        'Ficam de fora as vagas em que ele já se candidatou e as do próprio perfil de produtor.',
      params: [workerId, queryParam('limit', 'Quantas (1 a 30; padrão 10).', { type: 'integer', minimum: 1, maximum: 30 })],
      success: { status: 200, description: 'Vagas recomendadas.', schema: { listOf: 'RecommendedJob' } },
      errors: { 400: '`limit` inválido.', 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker())
  ];
  const farmer = [
    route('get', '/services/:id/catalog', matching.serviceCatalog, matchingOperation({
      tag: TAGS.farmerServices,
      summary: 'Catálogo de prestadores da vaga',
      description:
        'Trabalhadores com o catálogo ligado que escolheram a categoria da vaga, até 20, do que mais combina para o que menos, com os motivos ' +
        '(trilha na categoria, histórico, distância, nota e selo). Ficam de fora quem está fora do próprio raio de "perto de mim", o perfil de ' +
        'trabalhador do próprio produtor e quem já se candidatou, foi recusado ou foi convidado para a vaga. Só o que a lista de candidatos já ' +
        'mostra: sem CPF, telefone, e-mail ou localização (a distância vem só em faixas: até 5, 5 a 15, 15 a 30, 30 a 60 e mais de 60 km).',
      params: [pathParam('id', 'ID do serviço.')],
      success: { status: 200, description: 'Trabalhadores do catálogo.', schema: { listOf: 'CatalogWorker' } },
      errors: { 404: 'Serviço não encontrado.', 409: 'A vaga não está `Pending` ou passou do prazo.' }
    }), access.farmerOfService())
  ];
  return { worker, farmer };
}
