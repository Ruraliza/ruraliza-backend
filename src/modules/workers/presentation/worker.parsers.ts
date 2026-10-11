import { WORKER_TEXTS, nullableText, optionalText, parseProfileInput, parseProfileUpdate, workerTextProblem } from '#modules/accounts';
import { type Result, invalid, ok } from '#shared/domain/result';
import type { Body } from '#shared/infra/http/body';
import type { NewWorker } from '../application/create-worker-profile.usecase';
import type { WorkerUpdate } from '../worker.contract';

// Formato dos corpos do cadastro e da edição do trabalhador (400): os campos comuns de perfil
// (src/modules/accounts) mais os textos do trabalhador.

export function parseWorkerInput(body: Body): Result<NewWorker> {
  const profile = parseProfileInput(body);
  if (!profile.ok) return profile;
  const worker: NewWorker = {
    ...profile.value,
    bio: optionalText(body['bio']),
    certificates: optionalText(body['certificates']),
    courses: optionalText(body['courses']),
    experience: optionalText(body['experience'])
  };
  const problem = workerTextProblem(worker);
  return problem ? invalid(problem) : ok(worker);
}

export function parseWorkerUpdate(body: Body): Result<WorkerUpdate> {
  const profile = parseProfileUpdate(body);
  if (!profile.ok) return profile;

  const update: WorkerUpdate = { ...profile.value };
  for (const [field] of WORKER_TEXTS) {
    if (body[field] !== undefined) update[field] = nullableText(body[field]);
  }
  const problem = workerTextProblem(update);
  return problem ? invalid(problem) : ok(update);
}
