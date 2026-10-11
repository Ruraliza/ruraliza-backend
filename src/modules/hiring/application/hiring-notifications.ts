import type { Service } from '#modules/services';
import { type ChangeFeed, serviceApplications, workerApplications } from '#shared/domain/changes';
import { type PushMessage, type PushNotifier, WORKER_APPLICATIONS_URL, farmerServiceUrl } from '../../../domain/push';

// Avisa a tela de candidaturas do serviço e a de cada trabalhador afetado.
export function publishApplicationChanges(changes: ChangeFeed, serviceId: number, workerIds: readonly number[]): void {
  changes.publish([serviceApplications(serviceId), ...workerIds.map(workerApplications)]);
}

export function rejectedMessage(service: Service): PushMessage {
  return { title: 'Candidatura recusada', body: `Sua candidatura em ${service.name} não foi aceita.`, url: WORKER_APPLICATIONS_URL };
}

export function notifyWithdrawal(push: PushNotifier, service: Service): void {
  push.notify('farmer', service.farmer_id, {
    title: 'Desistência',
    body: `Um trabalhador desistiu de ${service.name}.`,
    url: farmerServiceUrl(service.id)
  });
}
