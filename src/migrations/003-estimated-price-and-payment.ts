import type { Migration } from '#shared/infra/postgres/migrate';

// Vaga com valor estimado e pagamento simulado de volta.
//
// - services.price volta a ser usado como estimativa do produtor, com a unidade em `price_unit` (as mesmas das
//   propostas). Continua sem NOT NULL: a obrigatoriedade nas vagas novas fica na API, e vaga antiga sem valor
//   aparece como "a combinar". Vaga antiga com valor e sem unidade fica `fixed`: o valor era o total da vaga;
// - as propostas não têm mais forma e momento do pagamento (o pagamento é pelo app, no fim do serviço).
//   As colunas deixam de ser obrigatórias, sem apagar o que já foi gravado;
// - o serviço volta a concluir pelo pagamento (`payments` e `services.payment_id`); `completed_at` passa a ser a
//   data do pagamento. `farmer_paid_at` e `worker_received_at` ficam no banco, sem uso.
const sql = `
ALTER TABLE services ADD COLUMN price_unit text CHECK (price_unit IN ('hour', 'day', 'meter', 'hectare', 'fixed'));
UPDATE services SET price_unit = 'fixed' WHERE price IS NOT NULL;

ALTER TABLE proposals ALTER COLUMN payment_method DROP NOT NULL;
ALTER TABLE proposals ALTER COLUMN payment_timing DROP NOT NULL;
`;

export const estimatedPriceAndPayment: Migration = { id: '003-estimated-price-and-payment', sql };
