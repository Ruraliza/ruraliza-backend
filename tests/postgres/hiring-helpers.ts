// Cenários de contratação para os testes do PostgreSQL (pelos casos de uso, como o app faz).
import assert from 'node:assert/strict';
import type { Container } from '../../src/container';

export const NOW = '2026-03-15T15:00:00.000Z';

// Produtor, fazenda, vaga, candidatura e a negociação na conversa (proposta aceita), pronta para o aceite.
export async function negotiatedService(c: Container): Promise<{ serviceId: number; applicationId: number; workerId: number }> {
  const { farmers, farms, workers, services, hiring } = c.useCases;
  const farmer = await farmers.registerFarmer.execute({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', password: 'senha-forte-1' });
  assert.ok(farmer.ok);
  const farm = await farms.createFarm.execute({ farmerId: farmer.value.farmer.id, input: { address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 } });
  assert.ok(farm.ok);
  const worker = await workers.registerWorker.execute({ email: 'rui@exemplo.com', name: 'Rui', phone: '1', cpf: '11144477735', password: 'senha-forte-1', bio: null, certificates: null, courses: null, experience: null });
  assert.ok(worker.ok);
  const service = await services.publishService.execute({ farmer_id: farmer.value.farmer.id, farm_id: farm.value.id, name: 'Capina', category: 'Manutenção', duration: 4, price: 150, price_unit: 'day' });
  assert.ok(service.ok);
  const application = await hiring.applyForService.execute({ serviceId: service.value.id, workerId: worker.value.worker.id });
  assert.ok(application.ok);
  // A negociação: o produtor abre a conversa, o trabalhador propõe e o produtor aceita a proposta (grava a proposta e o combinado).
  const chat = await c.useCases.chat.openChat.execute({ serviceId: service.value.id, applicationId: application.value.id });
  assert.ok(chat.ok);
  const proposal = await hiring.propose.execute({
    chatId: chat.value.chat.id, viewer: { farmerId: null, workerId: worker.value.worker.id },
    terms: { amount: 99.9, unit: 'hectare', notes: 'Sem almoço.' }
  });
  assert.ok(proposal.ok);
  assert.ok((await hiring.answerProposal.execute({
    chatId: chat.value.chat.id, proposalId: proposal.value.id, viewer: { farmerId: farmer.value.farmer.id, workerId: null }, action: 'Accept'
  })).ok);
  return { serviceId: service.value.id, applicationId: application.value.id, workerId: worker.value.worker.id };
}

// ...e o aceite: o serviço fica em andamento, com o combinado.
export async function acceptedService(c: Container): Promise<{ serviceId: number; workerId: number }> {
  const { serviceId, applicationId, workerId } = await negotiatedService(c);
  const accepted = await c.useCases.hiring.analyzeApplication.execute({ serviceId, application_id: applicationId, action: 'Accept' });
  assert.ok(accepted.ok);
  assert.deepEqual(accepted.value.service?.agreement, {
    amount: 99.9, unit: 'hectare', notes: 'Sem almoço.', agreed_at: NOW
  });
  return { serviceId, workerId };
}
