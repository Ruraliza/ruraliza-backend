// Catálogo de prestadores e convites de ponta a ponta pelo container: do catálogo da vaga ao convite aceito,
// com a candidatura "Convidado" e a conversa aberta para os dois.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inviteAcceptedMessage } from '#modules/chat';
import type { Container } from '../../src/container';
import { farmerWithFarm, openService, setup, unwrap, worker } from './support';

async function interested(c: Container, email: string, cpf: string, categories: string[] = ['Capina']): Promise<number> {
  const id = await worker(c, email, cpf);
  unwrap(await c.useCases.matching.savePreferences.execute({
    workerId: id, input: { categories, near: { latitude: -22.12, longitude: -43.21, radius_km: 30 }, alerts: false }
  }));
  return id;
}

describe('Catálogo e convites', () => {
  it('o convidado aceita: vira candidato "Convidado", a conversa abre e os dois escrevem', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await interested(c, 'w1@exemplo.com', '11144477735');
    await interested(c, 'w2@exemplo.com', '39053344705', ['Colheita']);

    const listed = unwrap(await c.useCases.matching.catalog.execute({ serviceId }));
    assert.deepEqual(listed.map((x) => [x.id, x.reasons]), [[w, ['Escolheu Capina', 'Até 5 km da fazenda']]]);

    const invite = unwrap(await c.useCases.hiring.inviteWorker.execute({ serviceId, workerId: w }));
    assert.deepEqual(unwrap(await c.useCases.matching.catalog.execute({ serviceId })), []); // convidado sai do catálogo

    const accepted = unwrap(await c.useCases.hiring.answerInvite.execute({ inviteId: invite.id, workerId: w, action: 'Accept' }));
    const chatId = accepted.chatId;
    assert.ok(chatId !== undefined);

    const [application] = unwrap(await c.useCases.hiring.listServiceApplications.execute({ serviceId }));
    assert.deepEqual([application?.worker_id, application?.invited], [w, true]);

    const asWorker = { farmerId: null, workerId: w };
    const asFarmer = { farmerId, workerId: null };
    const detail = unwrap(await c.useCases.chat.getChat.execute({ chatId, viewer: asWorker }));
    assert.deepEqual(detail.messages.map((m) => m.body), [inviteAcceptedMessage('w1@exemplo.com')]);
    unwrap(await c.useCases.chat.sendMessage.execute({ chatId, viewer: asWorker, body: 'Bom dia! Posso na segunda.' }));
    unwrap(await c.useCases.chat.sendMessage.execute({ chatId, viewer: asFarmer, body: 'Combinado.' }));
  });

  it('quem desliga o catálogo sai na hora e não pode mais ser convidado', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await interested(c, 'w1@exemplo.com', '11144477735');

    unwrap(await c.useCases.matching.savePreferences.execute({ workerId: w, input: { categories: ['Capina'], near: null, alerts: false, catalog: false } }));

    assert.deepEqual(unwrap(await c.useCases.matching.catalog.execute({ serviceId })), []);
    const result = await c.useCases.hiring.inviteWorker.execute({ serviceId, workerId: w });
    assert.equal(result.ok ? '' : result.message, 'Esta pessoa não está mais no catálogo desta vaga.');
  });

  it('cancelar a vaga expira os convites pendentes; remover o trabalhador apaga os convites dele', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await interested(c, 'w1@exemplo.com', '11144477735');
    const invite = unwrap(await c.useCases.hiring.inviteWorker.execute({ serviceId, workerId: w }));

    unwrap(await c.useCases.services.cancelService.execute({ serviceId }));
    assert.equal((await c.repos.invites.findById(invite.id))?.status, 'Expired');
    const late = await c.useCases.hiring.answerInvite.execute({ inviteId: invite.id, workerId: w, action: 'Accept' });
    assert.equal(late.ok ? '' : late.kind, 'conflict');

    unwrap(await c.useCases.workers.deleteWorker.execute({ workerId: w }));
    assert.deepEqual(await c.repos.invites.find({ worker_id: w }), []);
  });
});
