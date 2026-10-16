import type { UserRole } from '#modules/accounts';

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
// `whatsapp`: texto para o WhatsApp, só nos avisos que merecem (ex.: candidatura aceita); sai para quem
// ligou "Avisos no WhatsApp" e tem celular no cadastro, se a integração estiver configurada.
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  whatsapp?: string;
}

// Telas do frontend que as notificações abrem.
export const WORKER_APPLICATIONS_URL = 'trabalhador/candidaturas';
// Início do trabalhador (onde ficam as vagas recomendadas).
export const WORKER_HOME_URL = 'trabalhador';

export function farmerServiceUrl(serviceId: number): string {
  return `produtor/servicos/${serviceId}`;
}

// Detalhe da vaga para o trabalhador (onde ele acompanha e avalia o serviço).
export function workerJobUrl(serviceId: number): string {
  return `trabalhador/vagas/${serviceId}`;
}

// Conversa do serviço, no painel de quem recebe.
export function chatUrl(role: UserRole, chatId: number): string {
  return `${role === 'farmer' ? 'produtor' : 'trabalhador'}/conversas/${chatId}`;
}

// Perfil de quem recebe (ex.: o resultado da verificação de identidade).
export function profileUrl(role: UserRole): string {
  return `${role === 'farmer' ? 'produtor' : 'trabalhador'}/perfil`;
}

// Central de ajuda, no painel de quem recebe (ex.: o resultado de uma denúncia).
export function helpUrl(role: UserRole): string {
  return `${role === 'farmer' ? 'produtor' : 'trabalhador'}/ajuda`;
}

// 'gone': o serviço de push diz que a inscrição não existe mais (o usuário revogou/desinstalou).
export type PushDelivery = 'sent' | 'gone';

export interface PushSender {
  send(subscription: PushSubscriptionRecord, message: PushMessage): Promise<PushDelivery>;
}

// Telefone do perfil (DDD + número, só dígitos), para os avisos por WhatsApp. null = perfil não existe.
export type PhoneDirectory = (role: UserRole, profileId: number) => Promise<string | null>;

// Quem avisa o perfil de uma mudança: guarda na central de notificações, manda o push e, quando a
// mensagem pede e a pessoa quer, o WhatsApp. Não espera o envio: falha nunca afeta a operação.
export interface PushNotifier {
  notify(role: UserRole, profileId: number, message: PushMessage): void;
}
