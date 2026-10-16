import type { UserRole } from '#modules/accounts';
import { type ChangeFeed, profileNotifications } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { MAX_NOTIFICATIONS_PER_PROFILE, type NotificationRepository } from '../domain/notification';
import type { PushMessage } from '../domain/push';

export interface NotificationHistoryDeps {
  notifications: NotificationRepository;
  changes: ChangeFeed;
  clock: Clock;
}

// Guarda o aviso no histórico do perfil e avisa o sino aberto (SSE).
// Igual a um ainda não lido (mesmo título e mesma tela): vira um só, com o texto e a hora do mais
// recente e a contagem somada (ex.: 3 mensagens novas na mesma conversa). Passando do limite, os mais antigos saem.
export async function recordNotification(deps: NotificationHistoryDeps, role: UserRole, profileId: number, message: PushMessage): Promise<void> {
  const { notifications, changes, clock } = deps;
  const now = clock.now();
  const same = (await notifications.find({ role, profile_id: profileId, read: false, url: message.url })).find((n) => n.title === message.title);
  if (same) {
    await notifications.update({ ...same, body: message.body, count: same.count + 1, insertion_date: now });
  } else {
    await notifications.create({ role, profile_id: profileId, title: message.title, body: message.body, url: message.url, count: 1, read: false, insertion_date: now });
    const all = await notifications.find({ role, profile_id: profileId });
    const excess = all.length - MAX_NOTIFICATIONS_PER_PROFILE;
    if (excess > 0) {
      for (const old of all.sort((a, b) => a.id - b.id).slice(0, excess)) await notifications.delete(old.id);
    }
  }
  changes.publish([profileNotifications(role, profileId)]);
}

// Perfil removido: o histórico dele sai junto.
export async function removeNotificationsOf(notifications: NotificationRepository, role: UserRole, profileId: number): Promise<void> {
  for (const n of await notifications.find({ role, profile_id: profileId })) await notifications.delete(n.id);
}
