import type { UserRole } from '#modules/accounts';
import type { Repository } from '#shared/domain/repository';

// Aviso guardado no histórico de um perfil (ver ../notification.contract.ts).
// TODO(db): tabela `notifications (id, role, profile_id, title, body, url, count, read, insertion_date)`
// com índice (role, profile_id, id).
export interface NotificationRecord {
  id: number;
  role: UserRole;
  profile_id: number;
  title: string;
  body: string;
  url: string;
  count: number;
  read: boolean;
  insertion_date: string;
}

export type NotificationRepository = Repository<NotificationRecord, 'role' | 'profile_id' | 'read' | 'url'>;

// Quantos avisos cada perfil guarda (os mais antigos saem) e quantos a lista devolve.
export const MAX_NOTIFICATIONS_PER_PROFILE = 100;
export const NOTIFICATIONS_PAGE_SIZE = 50;
