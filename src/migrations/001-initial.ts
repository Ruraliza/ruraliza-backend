import type { Migration } from '#shared/infra/postgres/migrate';

// Esquema inicial: uma tabela por repositório de src/repositories.ts, com uma coluna por campo da
// entidade (os nomes são os dos `*.contract.ts` e dos `domain/` de cada módulo), mais os arquivos.
//
// Convenções:
// - id `integer` gerado pelo banco, em sequência a partir de 1 e nunca reaproveitado;
// - instante (ISO 8601 na API) em `timestamptz`; dia do calendário (AAAA-MM-DD) em `date`;
// - lista simples em `integer[]`/`text[]`; objeto e lista de objetos em `jsonb`;
// - as regras de "um só" que os casos de uso conferem antes de gravar viram UNIQUE: duas requisições
//   ao mesmo tempo não criam o duplicado (a segunda recebe 409).
// A limpeza de um perfil removido continua nos casos de uso (ProfileCleanup); só a conta e as mensagens
// de uma conversa têm chave estrangeira.
// As restrições de candidatura aceita e de pagamento contam com a transação da contratação
// (src/modules/hiring): sem ela, uma gravação pela metade deixaria o serviço sem poder ser pago.
const sql = `
CREATE TABLE farmers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  farms integer[] NOT NULL,
  phone text NOT NULL,
  cpf text NOT NULL UNIQUE,
  photo_url text,
  insertion_date timestamptz NOT NULL
);

CREATE TABLE workers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  bio text,
  certificates text,
  courses text,
  experience text,
  phone text NOT NULL,
  cpf text NOT NULL UNIQUE,
  photo_url text,
  resume_url text,
  insertion_date timestamptz NOT NULL
);

CREATE TABLE accounts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  reset_token_digest text,
  reset_expires_at timestamptz,
  farmer_id integer UNIQUE REFERENCES farmers ON DELETE SET NULL,
  worker_id integer UNIQUE REFERENCES workers ON DELETE SET NULL,
  last_role text NOT NULL CHECK (last_role IN ('farmer', 'worker')),
  terms_version text,
  terms_accepted_at timestamptz,
  preferences jsonb
);
CREATE INDEX accounts_reset_token_digest ON accounts (reset_token_digest) WHERE reset_token_digest IS NOT NULL;

CREATE TABLE system_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'tutor')),
  password_hash text NOT NULL,
  insertion_date timestamptz NOT NULL
);

CREATE TABLE farms (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  farmer_id integer NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  latitude double precision,
  longitude double precision,
  photos jsonb NOT NULL,
  insertion_date timestamptz NOT NULL,
  deleted_at timestamptz
);
CREATE INDEX farms_farmer_id ON farms (farmer_id);

CREATE TABLE services (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  farmer_id integer NOT NULL,
  farm_id integer NOT NULL,
  payment_id integer,
  worker_id integer,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  duration double precision NOT NULL,
  price double precision NOT NULL,
  expires_at date,
  status text NOT NULL,
  insertion_date timestamptz NOT NULL
);
CREATE INDEX services_farmer_id ON services (farmer_id);
CREATE INDEX services_farm_id ON services (farm_id);
CREATE INDEX services_worker_id ON services (worker_id);
CREATE INDEX services_status ON services (status);

CREATE TABLE applications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id integer NOT NULL,
  worker_id integer NOT NULL,
  status text NOT NULL,
  auto_rejected boolean,
  insertion_date timestamptz NOT NULL,
  UNIQUE (service_id, worker_id)
);
CREATE INDEX applications_worker_id ON applications (worker_id);
-- Um serviço tem no máximo uma candidatura aceita: dois aceites ao mesmo tempo não passam os dois.
CREATE UNIQUE INDEX applications_one_accepted ON applications (service_id) WHERE status = 'Accepted';

CREATE TABLE payments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id integer NOT NULL UNIQUE,
  farmer_id integer NOT NULL,
  worker_id integer NOT NULL,
  value double precision NOT NULL,
  status text NOT NULL,
  insertion_date timestamptz NOT NULL
);

CREATE TABLE worker_reviews (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id integer NOT NULL UNIQUE,
  farmer_id integer NOT NULL,
  worker_id integer NOT NULL,
  punctuality smallint NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
  effort smallint NOT NULL CHECK (effort BETWEEN 1 AND 5),
  quality smallint NOT NULL CHECK (quality BETWEEN 1 AND 5),
  comment text,
  insertion_date timestamptz NOT NULL,
  window_ends_at timestamptz NOT NULL,
  revealed boolean NOT NULL
);
CREATE INDEX worker_reviews_worker_id ON worker_reviews (worker_id);
CREATE INDEX worker_reviews_farmer_id ON worker_reviews (farmer_id);

CREATE TABLE farm_reviews (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id integer NOT NULL UNIQUE,
  farm_id integer NOT NULL,
  farmer_id integer NOT NULL,
  worker_id integer NOT NULL,
  infrastructure smallint NOT NULL CHECK (infrastructure BETWEEN 1 AND 5),
  conditions smallint NOT NULL CHECK (conditions BETWEEN 1 AND 5),
  as_described smallint NOT NULL CHECK (as_described BETWEEN 1 AND 5),
  comment text,
  insertion_date timestamptz NOT NULL,
  window_ends_at timestamptz NOT NULL,
  revealed boolean NOT NULL
);
CREATE INDEX farm_reviews_farm_id ON farm_reviews (farm_id);
CREATE INDEX farm_reviews_farmer_id ON farm_reviews (farmer_id);
CREATE INDEX farm_reviews_worker_id ON farm_reviews (worker_id);

CREATE TABLE chats (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id integer NOT NULL,
  farmer_id integer NOT NULL,
  worker_id integer NOT NULL,
  farmer_shares_phone boolean NOT NULL,
  worker_shares_phone boolean NOT NULL,
  farmer_read_up_to integer NOT NULL,
  worker_read_up_to integer NOT NULL,
  closes_at timestamptz,
  insertion_date timestamptz NOT NULL,
  UNIQUE (service_id, worker_id)
);
CREATE INDEX chats_farmer_id ON chats (farmer_id);
CREATE INDEX chats_worker_id ON chats (worker_id);

CREATE TABLE chat_messages (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id integer NOT NULL REFERENCES chats ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('farmer', 'worker', 'system')),
  body text NOT NULL,
  insertion_date timestamptz NOT NULL
);
CREATE INDEX chat_messages_chat_id ON chat_messages (chat_id, id);

CREATE TABLE push_subscriptions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id integer NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  insertion_date timestamptz NOT NULL
);
CREATE INDEX push_subscriptions_account_id ON push_subscriptions (account_id);

CREATE TABLE notifications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role text NOT NULL,
  profile_id integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL,
  count integer NOT NULL,
  read boolean NOT NULL,
  insertion_date timestamptz NOT NULL
);
CREATE INDEX notifications_profile ON notifications (role, profile_id, id);

CREATE TABLE tracks (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  categories text[] NOT NULL,
  tutor_ids integer[] NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'discontinued')),
  modules jsonb NOT NULL,
  last_item_id integer NOT NULL,
  created_by integer NOT NULL,
  insertion_date timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  published_at timestamptz
);

CREATE TABLE enrollments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  track_id integer NOT NULL,
  worker_id integer NOT NULL,
  completed_lesson_ids integer[] NOT NULL,
  last_lesson_id integer,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  UNIQUE (track_id, worker_id)
);
CREATE INDEX enrollments_worker_id ON enrollments (worker_id);

CREATE TABLE certificates (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  track_id integer NOT NULL,
  track_title text NOT NULL,
  worker_name text NOT NULL,
  workload_minutes integer NOT NULL,
  completed_at timestamptz NOT NULL,
  data_hash text NOT NULL,
  worker_id integer NOT NULL,
  issued_at timestamptz NOT NULL,
  UNIQUE (track_id, worker_id)
);
CREATE INDEX certificates_worker_id ON certificates (worker_id);

CREATE TABLE help_articles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  topic text NOT NULL,
  position integer NOT NULL,
  published boolean NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE reports (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_type text NOT NULL,
  target_id integer NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL,
  insertion_date timestamptz NOT NULL,
  reporter_role text NOT NULL,
  reporter_id integer NOT NULL,
  resolution_note text,
  reviewed_at timestamptz
);
CREATE INDEX reports_status ON reports (status, id);
CREATE INDEX reports_reporter ON reports (reporter_role, reporter_id);

CREATE TABLE verifications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role text NOT NULL,
  profile_id integer NOT NULL,
  document_type text NOT NULL,
  document_id text,
  status text NOT NULL,
  submitted_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  verified_name text,
  UNIQUE (role, profile_id)
);
CREATE INDEX verifications_status ON verifications (status);

CREATE TABLE job_preferences (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  worker_id integer NOT NULL UNIQUE,
  categories text[] NOT NULL,
  near jsonb,
  alerts boolean NOT NULL,
  last_digest_at timestamptz
);

CREATE TABLE job_alerts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  worker_id integer NOT NULL,
  service_id integer NOT NULL,
  sent_at timestamptz NOT NULL
);
CREATE INDEX job_alerts_worker ON job_alerts (worker_id, sent_at);
CREATE INDEX job_alerts_service_id ON job_alerts (service_id);

CREATE TABLE sponsors (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sponsor text NOT NULL,
  title text NOT NULL,
  text text,
  cta_label text NOT NULL,
  url text NOT NULL,
  image_url text,
  audience text NOT NULL CHECK (audience IN ('farmer', 'worker', 'all')),
  states text[] NOT NULL,
  categories text[] NOT NULL,
  starts_on date,
  ends_on date,
  active boolean NOT NULL,
  impressions integer NOT NULL,
  clicks integer NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Fotos, currículos e fotos de documento da verificação (ver src/shared/infra/postgres/pg-file-store.ts).
CREATE TABLE stored_files (
  store text NOT NULL,
  id text NOT NULL,
  content_type text NOT NULL,
  bytes bytea NOT NULL,
  insertion_date timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store, id)
);
`;

export const initialSchema: Migration = { id: '001-initial', sql };
