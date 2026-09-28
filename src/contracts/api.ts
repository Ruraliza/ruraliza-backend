import type { Farm } from './farm';
import type { Farmer } from './farmer';
import type { Payment } from './payment';
import type { Service } from './service';
import type { ServiceApplication } from './service-application';
import type { Worker } from './worker';

// Todo erro da API: status HTTP 400/404/409/500 com este corpo.
export interface ApiError {
  error: string;
}

// Escritas (POST/PATCH/DELETE) respondem { message, <entidade> }.
export interface MessageResponse {
  message: string;
}

export interface FarmerResponse extends MessageResponse {
  farmer: Farmer;
}

export interface WorkerResponse extends MessageResponse {
  worker: Worker;
}

export interface FarmResponse extends MessageResponse {
  farm: Farm;
}

export interface ServiceResponse extends MessageResponse {
  service: Service;
}

export interface ApplicationResponse extends MessageResponse {
  application: ServiceApplication;
}

// PATCH /farmers/services/:id/analyze: o aceite também devolve o serviço (agora In Progress).
export type AnalyzeResponse = ApplicationResponse | (ApplicationResponse & ServiceResponse);

export interface PaymentResponse extends ServiceResponse {
  payment: Payment;
}

export interface HealthResponse {
  message: string;
}
