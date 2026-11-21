import assert from 'node:assert/strict';
import { after } from 'node:test';
import { type Container, createContainer } from '../../src/container';
import type { Result } from '#shared/domain/result';
import { dropTestDatabases, testStorage } from '../support/postgres';

// Ponto de partida comum dos testes de integração: um container com relógio fixo e atalhos para os
// cenários mais usados. Os dados ficam em memória; com TEST_DATABASE_URL, num schema novo do PostgreSQL
// (os mesmos testes provam as duas persistências).

export const NOW = '2026-01-01T00:00:00.000Z';
export const PASSWORD = 'senha-forte-1';

export function setup(): Container {
  return createContainer({ clock: { now: () => NOW }, ...testStorage() });
}

// Vale para o arquivo de teste que importa este módulo: no fim dele, apaga os schemas criados.
after(dropTestDatabases);

// Falha o teste se o resultado não for sucesso; devolve o valor já tipado.
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`esperava sucesso, veio ${result.kind}: ${result.message}`);
  return result.value;
}

export async function farmerWithFarm(c: Container): Promise<{ farmerId: number; farmId: number }> {
  const { farmer } = unwrap(await c.useCases.farmers.registerFarmer.execute({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', password: PASSWORD }));
  const farm = unwrap(await c.useCases.farms.createFarm.execute({ farmerId: farmer.id, input: { address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 } }));
  return { farmerId: farmer.id, farmId: farm.id };
}

export async function worker(c: Container, email: string, cpf: string): Promise<number> {
  const { worker: w } = unwrap(await c.useCases.workers.registerWorker.execute({ email, name: email, phone: '1', cpf, password: PASSWORD, bio: null, certificates: null, courses: null, experience: null }));
  return w.id;
}

export async function openService(c: Container, farmerId: number, farmId: number): Promise<number> {
  const s = unwrap(await c.useCases.services.publishService.execute({ farmer_id: farmerId, farm_id: farmId, name: 'Capina', category: 'Capina', duration: 4, price: 150, price_unit: 'day' }));
  return s.id;
}

// A negociação do jeito do app: o produtor abre a conversa, o trabalhador propõe e o produtor aceita a proposta.
export async function agree(c: Container, serviceId: number, applicationId: number): Promise<void> {
  const service = await c.repos.services.findById(serviceId);
  const application = await c.repos.applications.findById(applicationId);
  if (!service || !application) assert.fail('hire: serviço ou candidatura não existe');
  const { hiring, chat } = c.useCases;
  const opened = unwrap(await chat.openChat.execute({ serviceId, applicationId })).chat;
  const proposal = unwrap(await hiring.propose.execute({
    chatId: opened.id, viewer: { farmerId: null, workerId: application.worker_id },
    terms: { amount: 150, unit: 'day', notes: null }
  }));
  unwrap(await hiring.answerProposal.execute({ chatId: opened.id, proposalId: proposal.id, viewer: { farmerId: service.farmer_id, workerId: null }, action: 'Accept' }));
}

// Contratação completa: a negociação e o aceite da candidatura. Devolve o resultado do aceite.
export async function hire(c: Container, serviceId: number, applicationId: number): ReturnType<Container['useCases']['hiring']['analyzeApplication']['execute']> {
  await agree(c, serviceId, applicationId);
  return c.useCases.hiring.analyzeApplication.execute({ serviceId, application_id: applicationId, action: 'Accept' });
}
