import type { ServicePayment } from '../service.contract';

// O pagamento (simulado) que concluiu o serviço, lido do módulo de contratação (o container liga).
// Só o trabalhador aceito o vê, junto do serviço dele.
export interface ServicePaymentReader {
  paymentOf(serviceId: number): Promise<ServicePayment | null>;
}
