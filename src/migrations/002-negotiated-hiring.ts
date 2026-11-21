import type { Migration } from '#shared/infra/postgres/migrate';

// Contratação negociada: o valor sai da vaga e é combinado na conversa, por propostas; o pagamento
// acontece por fora da plataforma.
//
// - services.price deixa de ser obrigatório (as vagas antigas guardam o valor; as novas, não).
// - a candidatura ganha uma mensagem opcional;
// - `proposals`: cada proposta de uma candidatura (valor, unidade, forma e momento do pagamento).
//   Uma só pendente e uma só aceita por candidatura; a aceita não muda mais;
// - o serviço aponta para a proposta aceita (`proposal_id`) e guarda uma cópia do combinado (`agreement`),
//   que não muda, para as listagens não precisarem juntar tabelas;
// - `completed_at` marca a conclusão (antes, era a data do pagamento simulado, copiada daqui);
//   `farmer_paid_at` e `worker_received_at` são o "paguei" e o "recebi", uma vez cada;
// - uma mensagem de conversa pode mostrar uma proposta (`chat_messages.proposal_id`).
// A tabela `payments` e a coluna `services.payment_id` ficam com os dados antigos, sem uso.
const sql = `
ALTER TABLE services ALTER COLUMN price DROP NOT NULL;
ALTER TABLE services
  ADD COLUMN proposal_id integer,
  ADD COLUMN agreement jsonb,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN farmer_paid_at timestamptz,
  ADD COLUMN worker_received_at timestamptz;
UPDATE services s SET completed_at = p.insertion_date
  FROM payments p
  WHERE p.service_id = s.id AND s.status = 'Completed';

ALTER TABLE applications ADD COLUMN message text;

CREATE TABLE proposals (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id integer NOT NULL,
  service_id integer NOT NULL,
  farmer_id integer NOT NULL,
  worker_id integer NOT NULL,
  amount double precision NOT NULL CHECK (amount > 0),
  unit text NOT NULL CHECK (unit IN ('hour', 'day', 'meter', 'hectare', 'fixed')),
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'cash', 'other')),
  payment_timing text NOT NULL CHECK (payment_timing IN ('daily', 'on_completion', 'other')),
  notes text,
  proposed_by text NOT NULL CHECK (proposed_by IN ('farmer', 'worker')),
  status text NOT NULL CHECK (status IN ('Pending', 'Accepted', 'Declined', 'Superseded')),
  insertion_date timestamptz NOT NULL,
  answered_at timestamptz
);
CREATE INDEX proposals_application_id ON proposals (application_id);
CREATE INDEX proposals_service_id ON proposals (service_id);
-- Duas propostas ao mesmo tempo não ficam as duas pendentes, nem duas aceitas na mesma candidatura.
CREATE UNIQUE INDEX proposals_one_pending ON proposals (application_id) WHERE status = 'Pending';
CREATE UNIQUE INDEX proposals_one_accepted ON proposals (application_id) WHERE status = 'Accepted';

ALTER TABLE chat_messages ADD COLUMN proposal_id integer;
`;

export const negotiatedHiring: Migration = { id: '002-negotiated-hiring', sql };
