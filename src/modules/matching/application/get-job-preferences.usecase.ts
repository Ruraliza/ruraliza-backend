import { type Result, notFound, ok } from '#shared/domain/result';
import { toJobPreferences } from '../domain/job-preferences';
import type { JobPreferences } from '../matching.contract';
import { type MatchingDeps, findPreferences } from './matching-deps';

// Preferências de vaga do trabalhador (sem nada salvo: nenhuma categoria, sem região, sem avisos).
export class GetJobPreferencesUseCase {
  constructor(private readonly deps: MatchingDeps) {}

  async execute({ workerId }: { workerId: number }): Promise<Result<JobPreferences>> {
    if (!(await this.deps.workers.findById(workerId))) return notFound('Trabalhador não encontrado.');
    return ok(toJobPreferences(await findPreferences(this.deps, workerId)));
  }
}
