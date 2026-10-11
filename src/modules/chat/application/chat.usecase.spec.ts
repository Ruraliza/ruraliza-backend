import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type ChatTestbed, type Hiring, chatTestbed, givenHiring } from '../testing/chat-fixtures';
import { HIRED_MESSAGE, chatHiringEvents } from './chat-hiring-events';
import { GetChatUseCase } from './get-chat.usecase';
import { ListChatsUseCase } from './list-chats.usecase';
import { MarkChatReadUseCase } from './mark-chat-read.usecase';
import { SendMessageUseCase } from './send-message.usecase';
import { SharePhoneUseCase } from './share-phone.usecase';

describe('conversa do serviço', () => {
  let t: ChatTestbed;
  let h: Hiring;
  let chatId: number;

  beforeEach(async () => {
    t = chatTestbed();
    h = await givenHiring(t);
    await chatHiringEvents(t).accepted(h.service);
    const [chat] = await t.chats.find({ service_id: h.service.id });
    chatId = chat?.id ?? 0;
  });

  it('abre no aceite com um aviso: não lido para o trabalhador, lido para o produtor (que aceitou)', async () => {
    const detail = unwrap(await new GetChatUseCase(t).execute({ chatId, viewer: h.asWorker }));

    assert.deepEqual(detail.messages.map((m) => [m.sender, m.body]), [['system', HIRED_MESSAGE]]);
    assert.deepEqual([detail.open, detail.unread, detail.farmer.name, detail.worker.phone], [true, 1, 'João Produtor', null]);
    assert.deepEqual((await new ListChatsUseCase(t).forFarmer({ farmerId: h.farmer.id })).map((c) => c.unread), [0]);
  });

  it('a mensagem chega para o outro lado (push e contador) e quem enviou já leu', async () => {
    unwrap(await new MarkChatReadUseCase(t).execute({ chatId, viewer: h.asWorker }));

    const { sent, masked } = unwrap(await new SendMessageUseCase(t).execute({ chatId, viewer: h.asWorker, body: 'Que horas começo?' }));

    assert.deepEqual([sent.sender, sent.body, masked], ['worker', 'Que horas começo?', false]);
    assert.deepEqual(t.pushes.at(-1), {
      role: 'farmer', profileId: h.farmer.id, message: { title: 'Nova mensagem de Maria', body: 'Que horas começo?', url: `produtor/conversas/${chatId}` }
    });
    const [farmerView] = await new ListChatsUseCase(t).forFarmer({ farmerId: h.farmer.id });
    const [workerView] = await new ListChatsUseCase(t).forWorker({ workerId: h.worker.id });
    assert.deepEqual([farmerView?.unread, workerView?.unread, farmerView?.last_message?.body], [1, 0, 'Que horas começo?']);
  });

  it('telefone escrito na mensagem sai oculto até os dois liberarem o WhatsApp', async () => {
    const send = new SendMessageUseCase(t);

    const before = unwrap(await send.execute({ chatId, viewer: h.asWorker, body: 'Me chama no 24 98888-7766' }));
    assert.deepEqual([before.sent.body, before.masked], ['Me chama no [número oculto]', true]);

    const share = new SharePhoneUseCase(t);
    const half = unwrap(await share.execute({ chatId, viewer: h.asWorker, share: true }));
    assert.deepEqual([half.worker_shares_phone, half.worker.phone, half.farmer.phone], [true, null, null]);
    assert.equal(t.pushes.at(-1)?.message.title, 'Pedido de WhatsApp');

    const both = unwrap(await share.execute({ chatId, viewer: h.asFarmer, share: true }));
    assert.deepEqual([both.farmer.phone, both.worker.phone], ['24999990000', '24988887766']);

    const after = unwrap(await send.execute({ chatId, viewer: h.asWorker, body: 'Me chama no 24 98888-7766' }));
    assert.deepEqual([after.sent.body, after.masked], ['Me chama no 24 98888-7766', false]);
  });

  it('quem não participa não abre a conversa', async () => {
    const result = await new GetChatUseCase(t).execute({ chatId, viewer: { farmerId: 99, workerId: 99 } });

    assert.equal(result.ok ? 'ok' : result.kind, 'forbidden');
  });

  it('fecha na desistência: não aceita mais mensagens nem troca de WhatsApp', async () => {
    await chatHiringEvents(t).withdrawn({ ...h.service, status: 'Pending', worker_id: null }, h.worker.id);

    const send = await new SendMessageUseCase(t).execute({ chatId, viewer: h.asFarmer, body: 'Oi?' });
    const share = await new SharePhoneUseCase(t).execute({ chatId, viewer: h.asFarmer, share: true });
    const detail = unwrap(await new GetChatUseCase(t).execute({ chatId, viewer: h.asFarmer }));

    assert.deepEqual([send.ok ? 'ok' : send.kind, share.ok ? 'ok' : share.kind], ['conflict', 'conflict']);
    assert.deepEqual([detail.open, detail.messages.at(-1)?.body], [false, 'Maria desistiu do serviço. A conversa foi encerrada.']);
  });

  it('depois do pagamento fica aberta por mais 7 dias', async () => {
    await chatHiringEvents(t).paid({ ...h.service, status: 'Completed' });
    const send = new SendMessageUseCase(t);

    t.setNow('2026-10-07T14:59:00.000Z');
    assert.equal((await send.execute({ chatId, viewer: h.asFarmer, body: 'Obrigado!' })).ok, true);

    t.setNow('2026-10-07T15:00:00.000Z');
    const late = await send.execute({ chatId, viewer: h.asFarmer, body: 'Oi?' });
    assert.equal(late.ok ? 'ok' : late.kind, 'conflict');
  });

  it('se a mesma pessoa for aceita de novo, a conversa reabre com o histórico', async () => {
    const events = chatHiringEvents(t);
    await events.withdrawn(h.service, h.worker.id);
    await events.accepted(h.service);

    const chats = await t.chats.find({ service_id: h.service.id });
    const detail = unwrap(await new GetChatUseCase(t).execute({ chatId, viewer: h.asFarmer }));
    assert.deepEqual([chats.length, detail.open, detail.messages.length], [1, true, 3]);
  });
});
