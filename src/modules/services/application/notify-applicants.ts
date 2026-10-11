import type { ApplicationRepository } from '#modules/hiring';
import { type ChangeFeed, serviceApplications, workerApplications } from '#shared/domain/changes';

// Avisa a tela de candidaturas do serviço e a de todos os candidatos dele
// (as candidaturas do trabalhador mostram nome, valor e cidade do serviço).
export async function notifyApplicants(
  deps: { applications: ApplicationRepository; changes: ChangeFeed },
  serviceId: number
): Promise<void> {
  const applicants = await deps.applications.find({ service_id: serviceId });
  deps.changes.publish([serviceApplications(serviceId), ...applicants.map((a) => workerApplications(a.worker_id))]);
}
