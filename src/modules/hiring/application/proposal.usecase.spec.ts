import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Service } from '#modules/services';
import { unwrap } from '#shared/testing/unwrap';
import type { NegotiationChat } from '../domain/hiring-events';
import type { ProposalInput, ServiceApplication } from '../hiring.contract';
import { FARMER_ID, type HiringTestbed, givenApplication, givenChat, givenProposal, givenService, givenWorker, hiringTestbed } from '../testing/hiring-fixtures';
import { AnswerProposalUseCase } from './answer-proposal.usecase';
import { ProposeUseCase } from './propose.usecase';

const terms: ProposalInput = { amount: 180, unit: 'day', notes: 'Me chama no 24 98888-7766' };
const kind = (r: { ok: boolean; kind?: string }): string => (r.ok ? 'ok' : (r.kind ?? ''));

describe('propostas na conversa', () => {
  let t: HiringTestbed;
  let propose: ProposeUseCase;
  let answer: AnswerProposalUseCase;
  let service: Service;
  let application: ServiceApplication;
  let chat: NegotiationChat;
  const asFarmer = { farmerId: FARMER_ID, workerId: null };
  let asWorker: { farmerId: null; workerId: number };

  beforeEach(async () => {
    t = hiringTestbed();
    propose = new ProposeUseCase(t);
    answer = new AnswerProposalUseCase(t);
    service = await givenService(t);
    const maria = await givenWorker(t);
    asWorker = { farmerId: null, workerId: maria.id };
    application = await givenApplication(t, service, maria);
    chat = givenChat(t, application);
  });

  it('qualquer lado propõe; as observações saem sem o telefone', async () => {
    const proposal = unwrap(await propose.execute({ chatId: chat.id, viewer: asWorker, terms }));

    assert.deepEqual(
      [proposal.proposed_by, proposal.status, proposal.amount, proposal.application_id, proposal.notes],
      ['worker', 'Pending', 180, application.id, 'Me chama no [número oculto]']
    );
    assert.equal(unwrap(await propose.execute({ chatId: chat.id, viewer: asFarmer, terms: { ...terms, notes: null } })).proposed_by, 'farmer');
  });

  it('a proposta nova substitui a pendente', async () => {
    const first = unwrap(await propose.execute({ chatId: chat.id, viewer: asWorker, terms }));
    const counter = unwrap(await propose.execute({ chatId: chat.id, viewer: asFarmer, terms: { ...terms, amount: 160 } }));

    assert.deepEqual((await t.proposals.find()).map((p) => [p.id, p.status]), [[first.id, 'Superseded'], [counter.id, 'Pending']]);
  });

  it('quem propôs não aceita a própria proposta; o outro lado aceita, e ela não muda mais', async () => {
    const proposal = unwrap(await propose.execute({ chatId: chat.id, viewer: asWorker, terms }));

    assert.equal(kind(await answer.execute({ chatId: chat.id, proposalId: proposal.id, viewer: asWorker, action: 'Accept' })), 'conflict');
    const accepted = unwrap(await answer.execute({ chatId: chat.id, proposalId: proposal.id, viewer: asFarmer, action: 'Accept' }));
    assert.deepEqual([accepted.status, accepted.answered_at], ['Accepted', t.clock.now()]);

    assert.equal(kind(await answer.execute({ chatId: chat.id, proposalId: proposal.id, viewer: asFarmer, action: 'Decline' })), 'conflict');
    assert.equal(kind(await propose.execute({ chatId: chat.id, viewer: asFarmer, terms })), 'conflict');
    assert.equal((await t.proposals.findById(proposal.id))?.status, 'Accepted');
  });

  it('recusar deixa a negociação seguir com uma proposta nova', async () => {
    const proposal = unwrap(await propose.execute({ chatId: chat.id, viewer: asFarmer, terms }));

    assert.equal(unwrap(await answer.execute({ chatId: chat.id, proposalId: proposal.id, viewer: asWorker, action: 'Decline' })).status, 'Declined');
    assert.equal(kind(await propose.execute({ chatId: chat.id, viewer: asWorker, terms })), 'ok');
  });

  it('só com a conversa aberta, a vaga aberta e a candidatura aguardando', async () => {
    t.openChats.set(chat.id, { ...chat, open: false });
    assert.equal(kind(await propose.execute({ chatId: chat.id, viewer: asWorker, terms })), 'conflict');
    t.openChats.set(chat.id, chat);

    await t.services.update({ ...service, status: 'Cancelled' });
    assert.equal(kind(await propose.execute({ chatId: chat.id, viewer: asWorker, terms })), 'conflict');
    await t.services.update(service);

    await t.applications.update({ ...application, status: 'Rejected' });
    assert.equal(kind(await propose.execute({ chatId: chat.id, viewer: asWorker, terms })), 'conflict');
  });

  it('quem não é da conversa não propõe nem responde; proposta de outra conversa não é encontrada', async () => {
    const stranger = { farmerId: 99, workerId: 98 };
    const proposal = await givenProposal(t, application, 'worker');
    const other = await givenApplication(t, await givenService(t), await givenWorker(t, 'Joao'));
    const otherChat = givenChat(t, other);

    assert.equal(kind(await propose.execute({ chatId: chat.id, viewer: stranger, terms })), 'forbidden');
    assert.equal(kind(await answer.execute({ chatId: chat.id, proposalId: proposal.id, viewer: stranger, action: 'Accept' })), 'forbidden');
    assert.equal(kind(await answer.execute({ chatId: otherChat.id, proposalId: proposal.id, viewer: asFarmer, action: 'Accept' })), 'not_found');
    assert.equal(kind(await propose.execute({ chatId: 999, viewer: asFarmer, terms })), 'not_found');
  });
});
