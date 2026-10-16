// Central de notificações: o histórico de avisos de cada perfil (produtor ou trabalhador).
// Tudo o que vira notificação push também fica aqui, mesmo para quem não ativou o push no aparelho.

// Um aviso. `url` é a tela que ele abre, relativa ao app e sem / no início (ex.: 'produtor/servicos/12').
// `count`: avisos iguais (mesmo título e tela) ainda não lidos viram um só, com o texto do mais recente.
export interface AppNotification {
  id: number;
  title: string;
  body: string;
  url: string;
  count: number;
  read: boolean;
  insertion_date: string; // ISO 8601, do aviso mais recente do grupo
}

// GET /farmers/:id/notifications e /workers/:id/notifications: os mais recentes primeiro.
export interface NotificationsPage {
  unread: number;
  items: AppNotification[];
}

// POST .../notifications/read: sem `ids`, marca todos como lidos.
export interface NotificationsReadInput {
  ids?: number[];
}

export interface NotificationsReadResponse {
  message: string;
  unread: number;
}
