import type { UserRole } from '#modules/accounts';
import { type ChangeFeed, type ChangeListener, profileNotifications } from '#shared/domain/changes';
import { NOTIFICATIONS_PAGE_SIZE, type NotificationRecord, type NotificationRepository } from '../domain/notification';
import type { AppNotification, NotificationsPage } from '../notification.contract';

export interface ListNotificationsDeps {
  notifications: NotificationRepository;
  changes: ChangeFeed;
}

export function toAppNotification({ id, title, body, url, count, read, insertion_date }: NotificationRecord): AppNotification {
  return { id, title, body, url, count, read, insertion_date };
}

export function unreadCount(records: readonly NotificationRecord[]): number {
  return records.reduce((sum, n) => sum + (n.read ? 0 : n.count), 0);
}

// Central de notificações: os avisos mais recentes primeiro e quantos ainda não foram lidos.
export class ListNotificationsUseCase {
  constructor(private readonly deps: ListNotificationsDeps) {}

  async execute({ role, profileId }: { role: UserRole; profileId: number }): Promise<NotificationsPage> {
    const all = await this.deps.notifications.find({ role, profile_id: profileId });
    const recent = all.sort((a, b) => b.insertion_date.localeCompare(a.insertion_date) || b.id - a.id).slice(0, NOTIFICATIONS_PAGE_SIZE);
    return { unread: unreadCount(all), items: recent.map(toAppNotification) };
  }

  // Avisa quem está com o sino aberto (SSE) quando chega aviso novo ou algum é lido. Devolve o cancelamento.
  watch({ role, profileId, listener }: { role: UserRole; profileId: number; listener: ChangeListener }): () => void {
    return this.deps.changes.subscribe(profileNotifications(role, profileId), listener);
  }
}
