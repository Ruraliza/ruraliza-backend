import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import type { Invite } from '../hiring.contract';
import { NO_HIRING_EVENTS } from '../domain/hiring-events';
import { MAX_INVITES_PER_SERVICE } from '../domain/hiring.rules';
import { FARMER_ID, type HiringTestbed, NOW, givenApplication, givenService, givenWorker, hiringTestbed } from '../testing/hiring-fixtures';
import { AnalyzeApplicationUseCase } from './analyze-application.usecase';
import { AnswerInviteUseCase } from './answer-invite.usecase';
import { hiringJobEvents } from './hiring-job-events';
import { InviteWorkerUseCase } from './invite-worker.usecase';
import { ListWorkerInvitesUseCase } from './list-worker-invites.usecase';

const kindOf = (result: { ok: boolean; kind?: string }): string => (result.ok ? 'ok' : result.kind ?? '');

describe('Convites do catálogo', () => {
  let t: HiringTestbed;
  let invite: InviteWorkerUseCase;
  let answer: AnswerInviteUseCase;
  let list: ListWorkerInvitesUseCase;
  let opened: number[];

  beforeEach(async () => {
    t = hiringTestbed();
    // A fazenda 1, a de todas as vagas do givenService.
    await t.farms.create({ farmer_id: FARMER_ID, address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: -22.11, longitude: -43.2, photos: [], insertion_date: NOW });
    opened = [];
    t.events = {
      ...NO_HIRING_EVENTS,
      inviteAccepted: (_service, application) => { opened.push(application.id); return Promise.resolve(77); }
    };
    invite = new InviteWorkerUseCase(t);
    answer = new AnswerInviteUseCase(t);
    list = new ListWorkerInvitesUseCase(t);
  });

  async function invited(): Promise<{ inv: Invite; workerId: number; serviceId: number }> {
    const service = await givenService(t);
    const worker = await givenWorker(t);
    t.catalogListed.add(worker.id);
    const inv = unwrap(await invite.execute({ serviceId: service.id, workerId: worker.id }));
    return { inv, workerId: worker.id, serviceId: service.id };
  }

  it('convida quem está no catálogo e avisa o trabalhador com as horas e a estimativa', async () => {
    const { inv, workerId, serviceId } = await invited();

    assert.deepEqual(inv, { id: inv.id, service_id: serviceId, farmer_id: FARMER_ID, worker_id: workerId, status: 'Pending', insertion_date: NOW, answered_at: null });
    const [push] = t.pushes;
    assert.equal(push?.role, 'worker');
    assert.equal(push.message.title, 'Convite para Capina');
    assert.match(push.message.body, /convidou você: 4 horas, estimativa de R\$\s200,00 pela empreitada\.$/);
    assert.equal(push.message.url, 'trabalhador/convites');
  });

  it('fora do catálogo, repetido, recusado antes ou acima do limite: 409', async () => {
    const service = await givenService(t);
    const outside = await givenWorker(t, 'Fora');
    assert.equal(kindOf(await invite.execute({ serviceId: service.id, workerId: outside.id })), 'conflict');

    const { inv, workerId, serviceId } = await invited();
    const again = await invite.execute({ serviceId, workerId });
    assert.equal(again.ok ? '' : again.message, 'Você já convidou esta pessoa para esta vaga.');
    await t.invites.update({ ...inv, status: 'Declined' });
    const afterDecline = await invite.execute({ serviceId, workerId });
    assert.equal(afterDecline.ok ? '' : afterDecline.message, 'Esta pessoa recusou o convite para esta vaga e não pode ser convidada de novo.');

    for (let i = 1; i < MAX_INVITES_PER_SERVICE; i++) {
      await t.invites.create({ service_id: serviceId, farmer_id: FARMER_ID, worker_id: 1000 + i, status: 'Pending', insertion_date: NOW, answered_at: null });
    }
    const extra = await givenWorker(t, 'Extra');
    t.catalogListed.add(extra.id);
    const overLimit = await invite.execute({ serviceId, workerId: extra.id });
    assert.equal(overLimit.ok ? '' : overLimit.message, `Você já mandou ${MAX_INVITES_PER_SERVICE} convites para esta vaga, o limite por vaga.`);
  });

  it('vaga fechada ou vencida não recebe convite', async () => {
    const worker = await givenWorker(t);
    t.catalogListed.add(worker.id);
    for (const service of [await givenService(t, { status: 'Cancelled' }), await givenService(t, { expires_at: '2026-09-29' })]) {
      assert.equal(kindOf(await invite.execute({ serviceId: service.id, workerId: worker.id })), 'conflict');
    }
    assert.deepEqual(await t.invites.find(), []);
  });

  it('aceitar cria a candidatura `invited`, abre a conversa e avisa o produtor; só uma vez', async () => {
    const { inv, workerId } = await invited();
    t.pushes.length = 0;

    const outcome = unwrap(await answer.execute({ inviteId: inv.id, workerId, action: 'Accept' }));

    assert.equal(outcome.invite.status, 'Accepted');
    assert.equal(outcome.invite.answered_at, NOW);
    assert.deepEqual([outcome.application?.status, outcome.application?.invited], ['Pending', true]);
    assert.equal(outcome.chatId, 77);
    assert.deepEqual(opened, [outcome.application?.id]);
    assert.deepEqual(t.pushes.map((p) => [p.role, p.message.title, p.message.url]), [['farmer', 'Maria aceitou seu convite', 'produtor/conversas/77']]);

    const twice = await answer.execute({ inviteId: inv.id, workerId, action: 'Decline' });
    assert.equal(twice.ok ? '' : twice.message, 'Este convite já foi respondido.');
  });

  it('só o convidado responde', async () => {
    const { inv, workerId } = await invited();
    assert.equal(kindOf(await answer.execute({ inviteId: inv.id, workerId: workerId + 1, action: 'Accept' })), 'forbidden');
    assert.equal(kindOf(await answer.execute({ inviteId: inv.id, workerId: null, action: 'Accept' })), 'forbidden');
    assert.equal(kindOf(await answer.execute({ inviteId: 999, workerId, action: 'Accept' })), 'not_found');
  });

  it('aceitar com recusa anterior falha sem criar nada', async () => {
    const { inv, workerId, serviceId } = await invited();
    const service = await t.services.findById(serviceId);
    const worker = await t.workers.findById(workerId);
    if (!service || !worker) throw new Error('cenário');
    await givenApplication(t, service, worker, 'Rejected');

    const result = await answer.execute({ inviteId: inv.id, workerId, action: 'Accept' });

    assert.equal(result.ok ? '' : result.message, 'Sua candidatura a este serviço foi recusada e você não pode se candidatar novamente.');
    assert.equal((await t.invites.findById(inv.id))?.status, 'Pending');
    assert.equal((await t.applications.find({ service_id: serviceId })).length, 1);
    assert.deepEqual(opened, []);
  });

  it('recusar avisa o produtor sem criar candidatura', async () => {
    const { inv, workerId, serviceId } = await invited();
    t.pushes.length = 0;

    const outcome = unwrap(await answer.execute({ inviteId: inv.id, workerId, action: 'Decline' }));

    assert.deepEqual([outcome.invite.status, outcome.invite.answered_at, outcome.application], ['Declined', NOW, undefined]);
    assert.deepEqual(await t.applications.find({ service_id: serviceId }), []);
    assert.deepEqual(t.pushes.map((p) => [p.role, p.message.title]), [['farmer', 'Convite recusado']]);
  });

  it('vencida a vaga, o convite pendente aparece e fica Expired, e responder dá 409 sem criar nada', async () => {
    const { inv, workerId, serviceId } = await invited();
    const service = await t.services.findById(serviceId);
    if (!service) throw new Error('cenário');
    await t.services.update({ ...service, expires_at: '2026-10-01' });
    t.setNow('2026-10-03T15:00:00.000Z');

    const [listed] = unwrap(await list.execute({ workerId }));
    assert.equal(listed?.status, 'Expired');
    assert.equal(listed.service.id, serviceId);
    const result = await answer.execute({ inviteId: inv.id, workerId, action: 'Accept' });
    assert.equal(result.ok ? '' : result.message, 'Este convite expirou: a vaga não está mais aberta.');
    assert.deepEqual(await t.applications.find(), []);
  });

  it('os pendentes expiram quando outro é aceito e quando a vaga é cancelada', async () => {
    const { inv, serviceId } = await invited();
    const service = await t.services.findById(serviceId);
    const other = await givenWorker(t, 'Joao');
    if (!service) throw new Error('cenário');
    const application = await givenApplication(t, service, other);
    await t.proposals.create({
      application_id: application.id, service_id: service.id, farmer_id: FARMER_ID, worker_id: other.id, amount: 100, unit: 'day', notes: null,
      proposed_by: 'farmer', status: 'Accepted', insertion_date: NOW, answered_at: NOW
    });
    unwrap(await new AnalyzeApplicationUseCase(t).execute({ serviceId, application_id: application.id, action: 'Accept' }));
    assert.equal((await t.invites.findById(inv.id))?.status, 'Expired');

    const second = await invited();
    const cancelled = await t.services.findById(second.serviceId);
    if (!cancelled) throw new Error('cenário');
    await hiringJobEvents(t).jobCancelled({ ...cancelled, status: 'Cancelled' });
    assert.equal((await t.invites.findById(second.inv.id))?.status, 'Expired');
  });

  it('lista os pendentes primeiro', async () => {
    const worker = await givenWorker(t);
    t.catalogListed.add(worker.id);
    const first = unwrap(await invite.execute({ serviceId: (await givenService(t)).id, workerId: worker.id }));
    const second = unwrap(await invite.execute({ serviceId: (await givenService(t)).id, workerId: worker.id }));
    unwrap(await answer.execute({ inviteId: second.id, workerId: worker.id, action: 'Decline' }));

    assert.deepEqual(unwrap(await list.execute({ workerId: worker.id })).map((i) => [i.id, i.status]), [[first.id, 'Pending'], [second.id, 'Declined']]);
  });
});
