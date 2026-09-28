import type { Farm, FarmLocation } from './farm';
import type { ServiceStatus } from './status';

export interface Service {
  id: number;
  farmer_id: number;
  farm_id: number;
  payment_id: number | null;
  worker_id: number | null;
  name: string;
  category: string;
  duration: number; // horas
  price: number; // R$
  status: ServiceStatus;
  insertion_date: string;
}

// POST /farmers/services
export interface ServiceInput {
  farmer_id: number;
  farm_id: number;
  name: string;
  category: string;
  duration: number;
  price: number;
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
