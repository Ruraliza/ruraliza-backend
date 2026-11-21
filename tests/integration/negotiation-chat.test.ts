// A conversa da negociação de ponta a ponta pelo container: a mensagem da candidatura, a conversa que o
// produtor abre antes do aceite, e como ela fecha e reabre junto com a contratação e o cancelamento.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Container } from '../../src/container';
import { farmerWithFarm, hire, openService, setup, unwrap, worker } from './support';

async function chatOpen(c: Container, chatId: number, viewer: { farmerId: number | null; workerId: number | null }): Promise<boolean> {
  return unwrap(await c.useCases.chat.getChat.execute({ chatId, viewer })).open;
}

describe('Conversa na negociação', () => {
  it('a mensagem da candidatura chega ao produtor com o contato oculto', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w1@exemplo.com', '11144477735');

    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId, workerId: w, message: 'Colhi café 3 safras. Zap 24 98888-7766' }));

    const [listed] = unwrap(await c.useCases.hiring.listServiceApplications.execute({ serviceId }));
    assert.equal(listed?.message, 'Colhi café 3 safras. Zap [número oculto]');
  });

  it('fecha na recusa, no aceite de outro e no cancelamento, e reabre na desistência do aceito', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const [w1, w2, w3] = [
      await worker(c, 'w1@exemplo.com', '11144477735'),
      await worker(c, 'w2@exemplo.com', '39053344705'),
      await worker(c, 'w3@exemplo.com', '93541134780')
    ];
    const apply = async (workerId: number): Promise<number> => unwrap(await c.useCases.hiring.applyForService.execute({ serviceId, workerId })).id;
    const [a1, a2, a3] = [await apply(w1), await apply(w2), await apply(w3)];
    const open = async (applicationId: number): Promise<number> => unwrap(await c.useCases.chat.openChat.execute({ serviceId, applicationId })).chat.id;
    const [c1, c2, c3] = [await open(a1), await open(a2), await open(a3)];
    const asFarmer = { farmerId, workerId: null };

    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId, application_id: a3, action: 'Reject' }));
    assert.equal(await chatOpen(c, c3, asFarmer), false);

    unwrap(await hire(c, serviceId, a1));
    assert.deepEqual([await chatOpen(c, c1, asFarmer), await chatOpen(c, c2, asFarmer)], [true, false]);

    unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId, workerId: w1 }));
    assert.deepEqual([await chatOpen(c, c1, asFarmer), await chatOpen(c, c2, asFarmer), await chatOpen(c, c3, asFarmer)], [false, true, false]);

    unwrap(await c.useCases.services.cancelService.execute({ serviceId }));
    assert.equal(await chatOpen(c, c2, asFarmer), false);
  });

  it('a desistência da candidatura pendente encerra a conversa', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w1@exemplo.com', '11144477735');
    const applicationId = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId, workerId: w })).id;
    const chatId = unwrap(await c.useCases.chat.openChat.execute({ serviceId, applicationId })).chat.id;

    unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId, workerId: w }));

    assert.equal(await chatOpen(c, chatId, { farmerId: null, workerId: w }), false);
  });

  it('a proposta aparece na conversa; o aceite leva o combinado; o cancelamento encerra as pendentes', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const [w1, w2] = [await worker(c, 'w1@exemplo.com', '11144477735'), await worker(c, 'w2@exemplo.com', '39053344705')];
    const a1 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId, workerId: w1 })).id;
    const a2 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId, workerId: w2 })).id;
    const chatId = unwrap(await c.useCases.chat.openChat.execute({ serviceId, applicationId: a2 })).chat.id;
    const asWorker = { farmerId: null, workerId: w2 };

    const proposal = unwrap(await c.useCases.hiring.propose.execute({
      chatId, viewer: asWorker, terms: { amount: 120, unit: 'day', notes: null }
    }));
    const detail = unwrap(await c.useCases.chat.getChat.execute({ chatId, viewer: { farmerId, workerId: null } }));
    assert.deepEqual([detail.application_id, detail.proposals.map((p) => p.id), detail.messages.at(-1)?.proposal_id], [a2, [proposal.id], proposal.id]);
    assert.match(detail.messages.at(-1)?.body ?? '', /propôs R\$\s?120,00 por dia\.$/);

    const hired = unwrap(await hire(c, serviceId, a1)).service;
    assert.deepEqual([hired?.agreement?.amount, hired?.agreement?.unit], [150, 'day']);
    assert.equal((await c.repos.proposals.findById(proposal.id))?.status, 'Superseded'); // recusada pelo aceite

    unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId, workerId: w1 }));
    const back = await c.repos.services.findById(serviceId);
    assert.deepEqual([back?.proposal_id, back?.agreement], [null, null]);
    const again = unwrap(await c.useCases.hiring.propose.execute({
      chatId, viewer: asWorker, terms: { amount: 130, unit: 'day', notes: null }
    }));
    unwrap(await c.useCases.services.cancelService.execute({ serviceId }));
    assert.equal((await c.repos.proposals.findById(again.id))?.status, 'Superseded');
  });
});
