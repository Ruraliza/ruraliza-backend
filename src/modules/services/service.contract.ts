import type { Farm, FarmLocation } from '#modules/farms';
import type { MessageResponse } from '#shared/contracts/api';

// Status em inglês na API; a tradução acontece só na UI.
export type ServiceStatus = 'Pending' | 'In Progress' | 'Completed' | 'Rejected' | 'Cancelled';

export interface Service {
  id: number;
  farmer_id: number;
  farm_id: number;
  payment_id: number | null; // o pagamento (simulado) que concluiu o serviço
  worker_id: number | null;
  proposal_id: number | null; // a proposta aceita que valeu no aceite
  agreement: ServiceAgreement | null; // o combinado (só para o produtor e o trabalhador aceito; null para os outros)
  name: string;
  description: string | null; // detalhes do serviço (o que fazer, o que levar, horário)
  category: string;
  duration: number; // horas estimadas
  price: number | null; // estimativa do produtor em R$ por `price_unit`; null nas vagas antigas ("a combinar")
  price_unit: PriceUnit | null;
  expires_at: string | null; // último dia (AAAA-MM-DD) para receber candidaturas; null = sem prazo
  status: ServiceStatus;
  completed_at: string | null; // quando o produtor liberou o pagamento (e o serviço foi concluído)
  insertion_date: string;
}

// Unidade do valor: a da estimativa da vaga e a das propostas.
export type PriceUnit = 'hour' | 'day' | 'meter' | 'hectare' | 'fixed'; // fixed: empreitada (valor fechado)

// O combinado entre produtor e trabalhador, por proposta na conversa. O pagamento é pelo app, no fim do serviço.
export interface AgreementTerms {
  amount: number; // R$, maior que 0, por `unit`
  unit: PriceUnit;
  notes: string | null; // até 300 caracteres
}

// Cópia da proposta aceita, guardada no aceite (não muda mais).
export interface ServiceAgreement extends AgreementTerms {
  agreed_at: string; // quando a proposta foi aceita
}

// GET /categories/groups: os tipos de serviço por grupo (services.category guarda o serviço, não o grupo)
export interface CategoryGroup {
  name: string;
  services: string[];
}

// POST /farmers/services
export interface ServiceInput {
  farmer_id: number;
  farm_id: number;
  name: string;
  description?: string | null;
  category: string;
  duration: number; // horas estimadas
  price: number; // estimativa em R$, maior que 0 (o valor final é combinado na conversa)
  price_unit: PriceUnit;
  expires_at?: string | null;
}

// PATCH /farmers/services/:id (só enquanto Pending; o produtor não muda)
export type ServiceUpdate = Partial<Omit<ServiceInput, 'farmer_id'>>;

// Resposta de publicar, editar e cancelar (e base das respostas de aceite e pagamento).
export interface ServiceResponse extends MessageResponse {
  service: Service;
}

// GET /farmers/services/:id
export interface ServiceWithFarm extends Service {
  farm: Farm;
}

// GET /farmers/:id/services
export interface FarmerServiceItem extends ServiceWithFarm {
  applications_pending: number;
}

// A estimativa da vaga (o ponto de partida da primeira proposta).
export interface ServiceEstimate {
  price: number;
  price_unit: PriceUnit;
}

// O pagamento liberado, como o trabalhador aceito o vê no serviço dele.
export interface ServicePayment {
  value: number; // R$, o total informado pelo produtor
  paid_at: string;
}

// GET /workers/services, /workers/services/:id, /workers/:id/services
export interface OpenService extends Service {
  farm: FarmLocation;
  payment: ServicePayment | null; // só para o trabalhador aceito, depois do pagamento
}

// GET /workers/services: filtros das vagas abertas (todos opcionais, combinados com E).
export type JobSort = 'recent' | 'duration_asc' | 'duration_desc' | 'rating';

export interface JobFilters {
  q?: string; // busca no nome, na descrição, na categoria e na cidade (sem acento/maiúscula)
  category?: string;
  category_group?: string; // qualquer serviço do grupo (GET /categories/groups)
  min_hours?: number;
  max_hours?: number;
  from?: string; // publicado a partir de (AAAA-MM-DD)
  to?: string; // publicado até (AAAA-MM-DD)
  min_rating?: number; // só fazendas com média publicada a partir desta nota (1 a 5)
  sort?: JobSort; // 'rating': fazendas mais bem avaliadas primeiro
  worker_id?: number; // oculta vagas em que este trabalhador já foi recusado
}
