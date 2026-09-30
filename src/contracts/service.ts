import type { Farm, FarmLocation } from './farm';
import type { ServiceStatus } from './status';

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
export type JobSort = 'recent' | 'price_desc' | 'price_asc' | 'duration_asc' | 'duration_desc';

export interface JobFilters {
  q?: string; // busca no nome, na descrição, na categoria e na cidade (sem acento/maiúscula)
  category?: string;
  min_hours?: number;
  max_hours?: number;
  from?: string; // publicado a partir de (AAAA-MM-DD)
  to?: string; // publicado até (AAAA-MM-DD)
  sort?: JobSort;
}
