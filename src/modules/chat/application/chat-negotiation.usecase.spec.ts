import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type ChatTestbed, type Negotiation, chatTestbed, givenNegotiation, givenOtherApplicant } from '../testing/chat-fixtures';
import { CANCELLED_MESSAGE, NOT_CHOSEN_MESSAGE, REJECTED_MESSAGE, REOPENED_MESSAGE, chatHiringEvents } from './chat-hiring-events';
import { GetChatUseCase } from './get-chat.usecase';
import { OPENED_MESSAGE, OpenChatUseCase } from './open-chat.usecase';
import { SendMessageUseCase } from './send-message.usecase';
import { SharePhoneUseCase } from './share-phone.usecase';

const kind = (r: { ok: boolean; kind?: string }): string => (r.ok ? 'ok' : (r.kind ?? ''));

describe('conversa antes do aceite (negociação)', () => {
  let t: ChatTestbed;
  let n: Negotiation;
  let open: OpenChatUseCase;

  beforeEach(async () => {
    t = chatTestbed();
    n = await givenNegotiation(t);
    open = new OpenChatUseCase(t);
  });

  it('o produtor abre a partir da candidatura pendente; o trabalhador recebe push e os dois escrevem', async () => {
    const { chat, created } = unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id }));

    assert.deepEqual([created, chat.open, chat.hired, chat.worker_id, chat.unread], [true, true, false, n.worker.id, 0]);
    assert.deepEqual(t.pushes.at(-1), {
      role: 'worker', profileId: n.worker.id,
      message: { title: 'Conversa sobre sua candidatura', body: 'João quer conversar sobre Colheita de café.', url: `trabalhador/conversas/${chat.id}` }
    });
    const detail = unwrap(await new GetChatUseCase(t).execute({ chatId: chat.id, viewer: n.asWorker }));
    assert.deepEqual(detail.messages.map((m) => m.body), [OPENED_MESSAGE]);
    assert.deepEqual(detail.estimate, { price: 200, price_unit: 'fixed' });
    assert.equal((await new SendMessageUseCase(t).execute({ chatId: chat.id, viewer: n.asWorker, body: 'Posso na segunda.' })).ok, true);
  });

  it('abrir de novo devolve a mesma conversa', async () => {
    const first = unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id }));
    const again = unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id }));

    assert.deepEqual([again.created, again.chat.id], [false, first.chat.id]);
    assert.equal((await t.chats.find({ service_id: n.service.id })).length, 1);
  });

  it('só com candidatura pendente da própria vaga, e vaga aberta', async () => {
    const created = await t.services.create({
      farmer_id: n.farmer.id, farm_id: 1, payment_id: null, proposal_id: null, agreement: null, completed_at: null, price: 200, price_unit: 'fixed', worker_id: null, name: 'Outra vaga', description: null,
      category: 'Colheita', duration: 4, expires_at: null, status: 'Pending', insertion_date: n.service.insertion_date
    });
    assert.equal(kind(await open.execute({ serviceId: created.id, applicationId: n.application.id })), 'invalid');
    assert.equal(kind(await open.execute({ serviceId: n.service.id, applicationId: 999 })), 'not_found');

    await t.applications.update({ ...n.application, status: 'Rejected' });
    assert.equal(kind(await open.execute({ serviceId: n.service.id, applicationId: n.application.id })), 'conflict');
  });

  it('telefone e e-mail ficam ocultos e o WhatsApp não é liberado antes do aceite', async () => {
    const { chat } = unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id }));

    const sent = unwrap(await new SendMessageUseCase(t).execute({ chatId: chat.id, viewer: n.asWorker, body: 'Me chama no 24 98888-7766' }));
    const share = await new SharePhoneUseCase(t).execute({ chatId: chat.id, viewer: n.asWorker, share: true });

    assert.deepEqual([sent.sent.body, sent.masked], ['Me chama no [número oculto]', true]);
    assert.equal(kind(share), 'conflict');
    assert.equal((await t.chats.findById(chat.id))?.worker_shares_phone, false);
  });

  it('fecha quando o produtor recusa a candidatura', async () => {
    const { chat } = unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id }));

    await chatHiringEvents(t).rejected(n.service, n.worker.id);

    const detail = unwrap(await new GetChatUseCase(t).execute({ chatId: chat.id, viewer: n.asWorker }));
    assert.deepEqual([detail.open, detail.messages.at(-1)?.body], [false, REJECTED_MESSAGE]);
    assert.equal(kind(await new SendMessageUseCase(t).execute({ chatId: chat.id, viewer: n.asWorker, body: 'Oi?' })), 'conflict');
  });

  it('fecha a conversa dos outros quando um é aceito, e reabre quando o aceito desiste', async () => {
    const pedro = await givenOtherApplicant(t, n.service);
    const mariaChat = unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id })).chat;
    const pedroChat = unwrap(await open.execute({ serviceId: n.service.id, applicationId: pedro.application.id })).chat;
    const events = chatHiringEvents(t);

    await events.accepted({ ...n.service, status: 'In Progress', worker_id: n.worker.id }, [pedro.worker.id]);
    const asPedro = { farmerId: null, workerId: pedro.worker.id };
    let pedroView = unwrap(await new GetChatUseCase(t).execute({ chatId: pedroChat.id, viewer: asPedro }));
    assert.deepEqual([pedroView.open, pedroView.messages.at(-1)?.body], [false, NOT_CHOSEN_MESSAGE]);
    assert.equal(unwrap(await new GetChatUseCase(t).execute({ chatId: mariaChat.id, viewer: n.asWorker })).open, true);

    await events.withdrawn(n.service, n.worker.id, [pedro.worker.id]);
    pedroView = unwrap(await new GetChatUseCase(t).execute({ chatId: pedroChat.id, viewer: asPedro }));
    const mariaView = unwrap(await new GetChatUseCase(t).execute({ chatId: mariaChat.id, viewer: n.asWorker }));
    assert.deepEqual([pedroView.open, pedroView.messages.at(-1)?.body], [true, REOPENED_MESSAGE]);
    assert.deepEqual([mariaView.open, mariaView.messages.at(-1)?.body], [false, 'Maria desistiu. A conversa foi encerrada.']);
  });

  it('fecha todas as conversas da vaga cancelada', async () => {
    const pedro = await givenOtherApplicant(t, n.service);
    unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id }));
    unwrap(await open.execute({ serviceId: n.service.id, applicationId: pedro.application.id }));

    await chatHiringEvents(t).jobCancelled({ ...n.service, status: 'Cancelled' });

    for (const chat of await t.chats.find({ service_id: n.service.id })) {
      const viewer = { farmerId: n.farmer.id, workerId: null };
      const detail = unwrap(await new GetChatUseCase(t).execute({ chatId: chat.id, viewer }));
      assert.deepEqual([detail.open, detail.messages.at(-1)?.body], [false, CANCELLED_MESSAGE]);
    }
  });

  it('conversa encerrada reabre quando o produtor abre de novo (o trabalhador se candidatou outra vez)', async () => {
    const first = unwrap(await open.execute({ serviceId: n.service.id, applicationId: n.application.id })).chat;
    await chatHiringEvents(t).withdrawn(n.service, n.worker.id, []);
    await t.applications.delete(n.application.id);
    const again = await t.applications.create({ invited: false, service_id: n.service.id, worker_id: n.worker.id, status: 'Pending', insertion_date: n.application.insertion_date });

    const reopened = unwrap(await open.execute({ serviceId: n.service.id, applicationId: again.id }));

    assert.deepEqual([reopened.created, reopened.chat.id, reopened.chat.open], [false, first.id, true]);
  });
});
