import type { Farm, FarmLocation } from '#modules/farms';
import type { MessageResponse } from '#shared/contracts/api';

// Status em inglês na API; a tradução acontece só na UI.
export type ServiceStatus = 'Pending' | 'In Progress' | 'Completed' | 'Rejected' | 'Cancelled';

export interface Service {
  id: number;
  farmer_id: number;
  farm_id: number;
  payment_id: number | null;
  worker_id: number | null;
  name: string;
  description: string | null; // detalhes do serviço (o que fazer, o que levar, horário)
  category: string;
  duration: number; // horas
  price: number; // R$
  expires_at: string | null; // último dia (AAAA-MM-DD) para receber candidaturas; null = sem prazo
  status: ServiceStatus;
  insertion_date: string;
}

// POST /farmers/services
export interface ServiceInput {
  farmer_id: number;
  farm_id: number;
  name: string;
  description?: string | null;
  category: string;
  duration: number;
  price: number;
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

// GET /workers/services, /workers/services/:id, /workers/:id/services
export interface OpenService extends Service {
  farm: FarmLocation;
}

// GET /workers/services: filtros das vagas abertas (todos opcionais, combinados com E).
export type JobSort = 'recent' | 'price_desc' | 'price_asc' | 'duration_asc' | 'duration_desc' | 'rating';

export interface JobFilters {
  q?: string; // busca no nome, na descrição, na categoria e na cidade (sem acento/maiúscula)
  category?: string;
  min_hours?: number;
  max_hours?: number;
  from?: string; // publicado a partir de (AAAA-MM-DD)
  to?: string; // publicado até (AAAA-MM-DD)
  min_rating?: number; // só fazendas com média publicada a partir desta nota (1 a 5)
  sort?: JobSort; // 'rating': fazendas mais bem avaliadas primeiro
  worker_id?: number; // oculta vagas em que este trabalhador já foi recusado
}
