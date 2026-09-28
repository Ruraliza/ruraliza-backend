import type { PaymentStatus } from './status';

export interface Payment {
  id: number;
  service_id: number;
  farmer_id: number;
  worker_id: number;
  value: number;
  status: PaymentStatus;
  insertion_date: string;
}
