import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { JobPreferences, JobPreferencesResponse, RecommendedJob } from '../matching.contract';
import type { MatchingUseCases } from '../matching.module';
import { parseJobPreferences, parseRecommendationLimit } from './matching.parsers';

// HTTP das vagas para você: as preferências do trabalhador e as vagas recomendadas.
export interface MatchingController {
  getJobPreferences: Handler<JobPreferences, IdParams>;
  saveJobPreferences: Handler<JobPreferencesResponse, IdParams>;
  recommendedJobs: Handler<RecommendedJob[], IdParams>;
}

export function createMatchingController(matching: MatchingUseCases): MatchingController {
  // GET /api/workers/:id/job-preferences - O que o trabalhador quer fazer, onde e se quer avisos
  const getJobPreferences: Handler<JobPreferences, IdParams> = async (req, res) => {
    const result = await matching.getPreferences.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PUT /api/workers/:id/job-preferences - Troca as preferências
  const saveJobPreferences: Handler<JobPreferencesResponse, IdParams> = async (req, res) => {
    const input = parseJobPreferences(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await matching.savePreferences.execute({ workerId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Job preferences saved.', preferences: result.value });
  };

  // GET /api/workers/:id/recommended-jobs?limit= - Vagas que combinam com o trabalhador
  const recommendedJobs: Handler<RecommendedJob[], IdParams> = async (req, res) => {
    const limit = parseRecommendationLimit(req.query['limit']);
    if (!limit.ok) { sendFailure(res, limit); return; }
    const result = await matching.recommend.execute({ workerId: toId(req.params.id), limit: limit.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  return { getJobPreferences, saveJobPreferences, recommendedJobs };
}
