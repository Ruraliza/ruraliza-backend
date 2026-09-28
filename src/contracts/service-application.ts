import type { OpenService } from './service';
import type { ApplicationStatus } from './status';
import type { Worker } from './worker';

export interface ServiceApplication {
  id: number;
  service_id: number;
  worker_id: number;
  status: ApplicationStatus;
  auto_rejected?: boolean; // recusada pelo aceite de outro; volta a Pending se o aceito desistir
  insertion_date: string;
}

// GET /farmers/services/:id/applications (CPF do trabalhador mascarado)
export interface ApplicationWithWorker extends ServiceApplication {
  worker: Worker;
}

// GET /workers/:id/applications
export interface ApplicationWithService extends ServiceApplication {
  service: OpenService;
}

// PATCH /farmers/services/:id/analyze
export type AnalyzeAction = 'Accept' | 'Reject';

export interface AnalyzeInput {
  application_id: number;
  action: AnalyzeAction;
}

// POST /workers/services/:id/apply e PATCH /workers/services/:id/withdraw
export interface WorkerActionInput {
  worker_id: number;
}
