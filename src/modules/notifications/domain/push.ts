import type { UserRole } from '../../../contracts';

// Inscrição de um navegador/aparelho para receber push, ligada à conta (vale para os dois perfis).
// TODO(db): restrição UNIQUE (endpoint).
export interface PushSubscriptionRecord {
  id: number;
  account_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  insertion_date: string;
}

// O que aparece na notificação. `url` é relativa ao app (sem / no início, ex.: 'produtor/servicos/12'),
// porque o frontend é publicado num subcaminho; o clique abre o app nessa tela.
export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

// Telas do frontend que as notificações abrem.
export const WORKER_APPLICATIONS_URL = 'trabalhador/candidaturas';

export function farmerServiceUrl(serviceId: number): string {
  return `produtor/servicos/${serviceId}`;
}

// 'gone': o serviço de push diz que a inscrição não existe mais (o usuário revogou/desinstalou).
export type PushDelivery = 'sent' | 'gone';

export interface PushSender {
  send(subscription: PushSubscriptionRecord, message: PushMessage): Promise<PushDelivery>;
}

// Quem avisa o perfil de uma mudança. Não espera o envio: falha de push nunca afeta a operação.
export interface PushNotifier {
  notify(role: UserRole, profileId: number, message: PushMessage): void;
}
