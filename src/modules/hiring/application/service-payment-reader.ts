import type { ServicePaymentReader } from '#modules/services';
import type { PaymentRepository } from '../domain/payment.repository';

// O pagamento do serviço como o módulo de vagas mostra ao trabalhador aceito (o container liga).
export function servicePaymentReader(payments: PaymentRepository): ServicePaymentReader {
  return {
    async paymentOf(serviceId: number) {
      const [payment] = await payments.find({ service_id: serviceId });
      return payment ? { value: payment.value, paid_at: payment.insertion_date } : null;
    }
  };
}
