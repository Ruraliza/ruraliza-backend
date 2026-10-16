import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { adjustableClock, recordingChangeFeed } from '#shared/testing/recorders';
import { MAX_NOTIFICATIONS_PER_PROFILE } from '../domain/notification';
import type { PushMessage } from '../domain/push';
import { createInMemoryNotificationRepository } from '../infra/in-memory-notification.repository';
import { ListNotificationsUseCase } from './list-notifications.usecase';
import { MarkNotificationsReadUseCase } from './mark-notifications-read.usecase';
import { type NotificationHistoryDeps, recordNotification, removeNotificationsOf } from './notification-history';

const applied = (service: string): PushMessage => ({ title: 'Nova candidatura', body: `Alguém se candidatou a ${service}.`, url: 'produtor/servicos/1' });

describe('Central de notificações', () => {
  let deps: NotificationHistoryDeps & { clock: ReturnType<typeof adjustableClock>; changes: ReturnType<typeof recordingChangeFeed> };
  let list: ListNotificationsUseCase;
  let markRead: MarkNotificationsReadUseCase;

  beforeEach(() => {
    deps = { notifications: createInMemoryNotificationRepository(), changes: recordingChangeFeed(), clock: adjustableClock('2026-10-01T10:00:00.000Z') };
    list = new ListNotificationsUseCase(deps);
    markRead = new MarkNotificationsReadUseCase(deps);
  });

  it('guarda cada aviso no perfil certo, o mais recente primeiro, e avisa o sino aberto', async () => {
    await recordNotification(deps, 'farmer', 1, applied('Capina'));
    deps.clock.set('2026-10-01T11:00:00.000Z');
    await recordNotification(deps, 'farmer', 1, { title: 'Desistência', body: 'Um trabalhador desistiu de Capina.', url: 'produtor/servicos/1' });
    await recordNotification(deps, 'worker', 1, { title: 'Você foi aceito!', body: 'Capina', url: 'trabalhador/candidaturas' });

    const page = await list.execute({ role: 'farmer', profileId: 1 });

    assert.deepEqual(page.items.map((n) => n.title), ['Desistência', 'Nova candidatura']);
    assert.equal(page.unread, 2);
    assert.deepEqual(deps.changes.published.at(-1), ['worker:1:notifications']);
  });

  it('avisos iguais ainda não lidos viram um só, com o texto mais recente e a contagem', async () => {
    await recordNotification(deps, 'farmer', 1, applied('Capina'));
    deps.clock.set('2026-10-01T12:00:00.000Z');
    await recordNotification(deps, 'farmer', 1, applied('Capina de novo'));

    const [item] = (await list.execute({ role: 'farmer', profileId: 1 })).items;

    assert.deepEqual([item?.count, item?.body, item?.insertion_date], [2, 'Alguém se candidatou a Capina de novo.', '2026-10-01T12:00:00.000Z']);
    assert.equal((await list.execute({ role: 'farmer', profileId: 1 })).unread, 2);
  });

  it('depois de lido, o próximo aviso igual começa um grupo novo', async () => {
    await recordNotification(deps, 'farmer', 1, applied('Capina'));
    await markRead.execute({ role: 'farmer', profileId: 1 });
    await recordNotification(deps, 'farmer', 1, applied('Capina'));

    const page = await list.execute({ role: 'farmer', profileId: 1 });

    assert.deepEqual(page.items.map((n) => [n.count, n.read]), [[1, false], [1, true]]);
    assert.equal(page.unread, 1);
  });

  it('marca só os ids pedidos do próprio perfil e devolve quantos faltam', async () => {
    await recordNotification(deps, 'farmer', 1, applied('Capina'));
    await recordNotification(deps, 'farmer', 1, { title: 'Desistência', body: 'x', url: 'produtor/servicos/2' });
    await recordNotification(deps, 'farmer', 2, applied('Roçada'));
    const [mine] = (await list.execute({ role: 'farmer', profileId: 1 })).items;
    const [other] = (await list.execute({ role: 'farmer', profileId: 2 })).items;

    const unread = await markRead.execute({ role: 'farmer', profileId: 1, ids: [mine?.id ?? 0, other?.id ?? 0] });

    assert.equal(unread, 1);
    assert.equal((await list.execute({ role: 'farmer', profileId: 2 })).unread, 1);
  });

  it('guarda no máximo 100 por perfil e apaga o histórico de um perfil removido', async () => {
    for (let i = 0; i < MAX_NOTIFICATIONS_PER_PROFILE + 3; i++) {
      await recordNotification(deps, 'worker', 7, { title: `Aviso ${i}`, body: '-', url: `trabalhador/vagas/${i}` });
    }
    const kept = await deps.notifications.find({ role: 'worker', profile_id: 7 });
    assert.equal(kept.length, MAX_NOTIFICATIONS_PER_PROFILE);
    assert.equal(kept.some((n) => n.title === 'Aviso 0'), false);

    await removeNotificationsOf(deps.notifications, 'worker', 7);
    assert.deepEqual(await deps.notifications.find({ role: 'worker', profile_id: 7 }), []);
  });
});
