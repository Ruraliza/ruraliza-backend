import type { UserRole } from '#modules/accounts';
import { type ChangeFeed, profileNotifications } from '#shared/domain/changes';
import type { NotificationRepository } from '../domain/notification';
import { unreadCount } from './list-notifications.usecase';

export interface MarkNotificationsReadDeps {
  notifications: NotificationRepository;
  changes: ChangeFeed;
}

export interface MarkNotificationsReadInput {
  role: UserRole;
  profileId: number;
  ids?: readonly number[]; // ausente: todos
}

// Marca como lidos (os do próprio perfil; ids de outro perfil são ignorados). Devolve quantos faltam ler.
export class MarkNotificationsReadUseCase {
  constructor(private readonly deps: MarkNotificationsReadDeps) {}

  async execute({ role, profileId, ids }: MarkNotificationsReadInput): Promise<number> {
    const { notifications, changes } = this.deps;
    const mine = await notifications.find({ role, profile_id: profileId });
    const targets = mine.filter((n) => !n.read && (ids === undefined || ids.includes(n.id)));
    for (const n of targets) await notifications.update({ ...n, read: true });
    if (targets.length > 0) changes.publish([profileNotifications(role, profileId)]);
    return unreadCount(mine.map((n) => (targets.includes(n) ? { ...n, read: true } : n)));
  }
}
