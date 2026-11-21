import type { Migration } from '#shared/infra/postgres/migrate';

// Catálogo de prestadores e convites.
//
// - job_preferences.catalog: aparecer no catálogo das vagas das categorias escolhidas. Começa ligado,
//   inclusive para quem já tem preferências salvas (quem não tem linha usa o padrão da API, também ligado);
// - applications.invited: a candidatura nasceu de um convite aceito ("Convidado" na lista de candidatos);
// - invites: o convite do produtor a um trabalhador do catálogo, um por vaga e trabalhador;
// - catalog_notices: o aviso único do catálogo para quem já tinha conta. Uma linha por trabalhador que existe
//   agora, com sent_at NULL; a subida da API reserva as pendentes (UPDATE ... RETURNING) e manda o aviso.
//   Contas criadas depois não ganham linha: veem o aviso no cadastro.
const sql = `
ALTER TABLE job_preferences ADD COLUMN catalog boolean NOT NULL DEFAULT true;
ALTER TABLE applications ADD COLUMN invited boolean NOT NULL DEFAULT false;

CREATE TABLE invites (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id integer NOT NULL,
  farmer_id integer NOT NULL,
  worker_id integer NOT NULL,
  status text NOT NULL CHECK (status IN ('Pending', 'Accepted', 'Declined', 'Expired')),
  insertion_date timestamptz NOT NULL,
  answered_at timestamptz,
  UNIQUE (service_id, worker_id)
);
CREATE INDEX invites_worker ON invites (worker_id, status);
CREATE INDEX invites_farmer_id ON invites (farmer_id);

CREATE TABLE catalog_notices (
  worker_id integer PRIMARY KEY REFERENCES workers ON DELETE CASCADE,
  sent_at timestamptz
);
INSERT INTO catalog_notices (worker_id) SELECT id FROM workers ON CONFLICT DO NOTHING;
`;

export const catalogAndInvites: Migration = { id: '004-catalog-and-invites', sql };
