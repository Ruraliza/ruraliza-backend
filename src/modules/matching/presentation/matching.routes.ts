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

// Em /api/workers (antes de '/:id').
export function matchingRoutes(matching: MatchingController, access: AccessPolicies): readonly RouteDef[] {
  return [
    route('get', '/:id/job-preferences', matching.getJobPreferences, matchingOperation({
      tag: TAGS.jobs,
      summary: 'Preferências de vaga',
      description: 'O que o trabalhador quer fazer, onde está e se quer avisos. Sem nada salvo: `{ categories: [], near: null, alerts: false }`.',
      params: [workerId],
      success: { status: 200, description: 'Preferências.', schema: 'JobPreferences' },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker()),

    route('put', '/:id/job-preferences', matching.saveJobPreferences, matchingOperation({
      tag: TAGS.jobs,
      summary: 'Salvar preferências de vaga',
      description:
        'Troca tudo. A região fica guardada com 2 casas decimais (cerca de 1 km). Com `alerts`, a pessoa recebe na hora as vagas novas ' +
        'que combinam (no máximo 3 por dia, nunca a mesma duas vezes) e, uma vez por semana, o resumo das recomendadas.',
      params: [workerId],
      body: 'JobPreferences',
      success: { status: 200, description: 'Preferências salvas.', schema: 'JobPreferencesResponse' },
      errors: { 400: 'Categoria desconhecida; região ou raio inválidos; `alerts` não é true/false.', 404: 'Trabalhador não encontrado.' }
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
}
