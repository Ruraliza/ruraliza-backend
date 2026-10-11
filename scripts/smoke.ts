// Smoke test do fluxo completo da API (em memória).
// Sobe o app numa porta livre, sem o seed, e percorre:
// produtor → fazenda → serviço → trabalhador → candidatura → aceite → pagamento,
// além dos principais casos 400/401/403/404/409 e da administração pelos usuários de sistema.
// Uso: npm run smoke
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApi } from '../app';
import { createContainer } from '../src/container';
import type {
  ApplicationResponse,
  ApplicationWithService,
  ApplicationWithWorker,
  Farm,
  FarmResponse,
  Farmer,
  FarmerResponse,
  FarmerServiceItem,
  FarmerSignupResponse,
  LoginResponse,
  MapsConfig,
  PushConfig,
  OpenService,
  PasswordResetRequestResponse,
  PaymentResponse,
  ServiceResponse,
  ServiceWithFarm,
  SessionResponse,
  SessionUser,
  SystemLoginResponse,
  SystemUser,
  SystemUserResponse,
  AdminUser,
  WorkerResponse,
  WorkerSignupResponse
} from '../src/contracts';
import { FRONTEND_ORIGIN } from '../src/config';
import { isRecord } from '../src/http/body';
import { createOpenApiChecker } from './openapi-check';

// Senha dos perfis cadastrados neste teste.
const PW = 'senha-do-smoke';

// API nova, sem seed, só para este teste.
const container = createContainer();
const { app, document } = createApi(container);
const checkAgainstOpenApi = createOpenApiChecker(document);

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface CallResult {
  status: number;
  body: unknown;
}

let baseUrl = '';
let passed = 0;

// Token de quem está agindo, enviado em Authorization por step/upload/openEvents.
// Troque com `actAs` quando outra pessoa passa a agir (null = sem sessão).
let currentToken: string | null = null;
function actAs(token: string | null): void {
  currentToken = token;
}
function authHeader(): Record<string, string> {
  return currentToken === null ? {} : { Authorization: `Bearer ${currentToken}` };
}

async function call(
  method: Method,
  path: string,
  body?: unknown,
  rawBody?: string,
  headers: Record<string, string> = {}
): Promise<CallResult> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...headers },
    body: rawBody ?? (body === undefined ? null : JSON.stringify(body))
  });
  const json: unknown = await res.json();
  return { status: res.status, body: json };
}

async function step<T = unknown>(
  title: string,
  method: Method,
  path: string,
  body: unknown,
  expectedStatus: number,
  check?: (body: T) => void,
  headers?: Record<string, string>
): Promise<T> {
  const res = await call(method, path, body, undefined, headers);
  assert.equal(res.status, expectedStatus, `${title}: esperado ${expectedStatus}, veio ${res.status} ${JSON.stringify(res.body)}`);
  if (expectedStatus >= 400) {
    assert.ok(isRecord(res.body) && typeof res.body['error'] === 'string', `${title}: resposta de erro sem { error }`);
  }
  // Toda resposta precisa bater com a documentação OpenAPI (rota, status e schema do corpo).
  const docProblem = checkAgainstOpenApi(method, `/api${path}`, res.status, res.body);
  assert.equal(docProblem, null, `${title}: ${docProblem ?? ''}`);
  // Já validado contra o schema documentado acima; aqui só é lido como o DTO `T` do contrato.
  const typed = res.body as T;
  if (check) check(typed);
  passed++;
  console.log(`  ok  ${String(res.status).padEnd(3)} ${method.padEnd(6)} ${path}  — ${title}`);
  return typed;
}

// Envia um arquivo como corpo (image/* ou application/pdf) e confere a resposta contra o OpenAPI.
async function upload<T = unknown>(
  title: string,
  path: string,
  bytes: Uint8Array | null,
  contentType: string,
  expectedStatus: number,
  check?: (body: T) => void
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...authHeader() },
    body: bytes === null ? null : Buffer.from(bytes)
  });
  const body: unknown = await res.json();
  assert.equal(res.status, expectedStatus, `${title}: esperado ${expectedStatus}, veio ${res.status} ${JSON.stringify(body)}`);
  const docProblem = checkAgainstOpenApi('POST', `/api${path}`, res.status, body);
  assert.equal(docProblem, null, `${title}: ${docProblem ?? ''}`);
  const typed = body as T;
  if (check) check(typed);
  passed++;
  console.log(`  ok  ${String(res.status).padEnd(3)} POST   ${path}  — ${title}`);
  return typed;
}

interface EventStream {
  expectEvent: (title: string, event: string) => Promise<void>;
  close: () => void;
}

// Abre um stream SSE (a resposta fica aberta até `close`) e espera os eventos um a um, na ordem.
// O token vai em ?access_token=, como faz o EventSource do navegador (que não envia cabeçalhos).
async function openEvents(title: string, path: string): Promise<EventStream> {
  const controller = new AbortController();
  const url = `${baseUrl}${path}?access_token=${encodeURIComponent(currentToken ?? '')}`;
  const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/event-stream' } });
  assert.equal(res.status, 200, `${title}: esperado 200, veio ${res.status}`);
  assert.match(res.headers.get('content-type') ?? '', /^text\/event-stream/, `${title}: Content-Type`);
  assert.ok(res.body, `${title}: sem corpo`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  passed++;
  console.log(`  ok  200 GET    ${path}  — ${title}`);

  let buffer = '';
  const readChunk = async (what: string): Promise<string> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${what}: nenhum evento em 2 s`)), 2000);
    });
    try {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) assert.fail(`${what}: o stream fechou`);
      return value;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async expectEvent(what, event) {
      const marker = `event: ${event}\n`;
      while (!buffer.includes(marker) || !buffer.includes('\n\n', buffer.indexOf(marker))) {
        buffer += await readChunk(what);
      }
      // Consome até o fim deste evento; os seguintes ficam para a próxima chamada.
      buffer = buffer.slice(buffer.indexOf('\n\n', buffer.indexOf(marker)) + 2);
      passed++;
      console.log(`  ok  SSE  event: ${event}  — ${what}`);
    },
    close: () => controller.abort()
  };
}

// Baixa uma imagem servida pela API e devolve largura/altura/formato reais.
async function download(title: string, url: string, expectedStatus = 200): Promise<{ width: number; height: number; format: string } | null> {
  const res = await fetch(`${baseUrl.replace(/\/api$/, '')}${url}`);
  assert.equal(res.status, expectedStatus, `${title}: esperado ${expectedStatus}, veio ${res.status}`);
  passed++;
  console.log(`  ok  ${String(res.status).padEnd(3)} GET    ${url.replace('/api', '')}  — ${title}`);
  if (expectedStatus !== 200) return null;
  assert.equal(res.headers.get('content-type'), 'image/webp');
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
  return { width: meta.width, height: meta.height, format: meta.format };
}

// Baixa um PDF servido pela API e confere que os bytes são os enviados.
async function downloadPdf(title: string, url: string, expectedStatus: number, expected?: Uint8Array): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/api$/, '')}${url}`);
  assert.equal(res.status, expectedStatus, `${title}: esperado ${expectedStatus}, veio ${res.status}`);
  if (expected) {
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), expected);
  }
  passed++;
  console.log(`  ok  ${String(res.status).padEnd(3)} GET    ${url.replace('/api', '')}  — ${title}`);
}

// Dia de hoje/amanhã/ontem no horário de Brasília (AAAA-MM-DD).
function brDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function run(): Promise<void> {
  console.log('\nFluxo principal');
  await step<string[]>('categorias', 'GET', '/categories', undefined, 200, (b) => assert.equal(b.length, 7));

  const { farmer, user: farmerSession, token: ana } = await step<FarmerSignupResponse>('cadastrar produtor', 'POST', '/farmers',
    { name: 'Ana Produtora', email: 'Ana@Exemplo.com', phone: '24999990000', cpf: '52998224725', password: PW }, 201,
    (b) => assert.equal(b.farmer.email, 'ana@exemplo.com'));
  actAs(ana);

  const { farm } = await step<FarmResponse>('cadastrar fazenda', 'POST', `/farmers/${farmer.id}/farms`,
    { address: 'Estrada Velha, Km 3', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 }, 201,
    (b) => assert.deepEqual([b.farm.latitude, b.farm.longitude], [-22.1165, -43.2092]));

  const { service } = await step<ServiceResponse>('publicar serviço', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Colheita de café', category: 'Colheita', duration: 16, price: 900 }, 201,
    (b) => assert.equal(b.service.status, 'Pending'));

  const { worker, user: workerSession, token: bruno } = await step<WorkerSignupResponse>('cadastrar trabalhador', 'POST', '/workers',
    { name: 'Bruno Tratorista', email: 'bruno@exemplo.com', phone: '24988880000', cpf: '98765432100', password: PW }, 201,
    (b) => assert.deepEqual([b.user.role, b.user.id, b.user.profiles], ['worker', b.worker.id, { farmer: null, worker: b.worker.id }]));
  const { worker: worker2, token: carla } = await step<WorkerSignupResponse>('cadastrar 2º trabalhador', 'POST', '/workers',
    { name: 'Carla Diarista', email: 'carla@exemplo.com', phone: '24977770000', cpf: '12345678909', password: PW }, 201);

  actAs(bruno);
  await step<OpenService[]>('vagas com cidade/UF', 'GET', '/workers/services?category=Colheita', undefined, 200,
    (b) => assert.deepEqual(b[0]?.farm, { city: 'Três Rios', state: 'RJ', photos: [] }));
  await step<OpenService>('detalhe da vaga sem o ponto no mapa', 'GET', `/workers/services/${service.id}?worker_id=${worker.id}`, undefined, 200,
    (b) => assert.equal(b.farm.latitude, undefined));

  const { application } = await step<ApplicationResponse>('candidatar-se', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker.id }, 201,
    (b) => assert.equal(b.application.status, 'Pending'));
  actAs(carla);
  const { application: application2 } = await step<ApplicationResponse>('2ª candidatura', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker2.id }, 201);

  actAs(ana);
  await step<ApplicationWithWorker[]>('listar candidaturas (CPF mascarado)', 'GET', `/farmers/services/${service.id}/applications`, undefined, 200, (b) => {
    assert.equal(b.length, 2);
    assert.equal(b[0]?.worker.cpf, '***.654.321-**');
  });
  await step<FarmerServiceItem[]>('serviços do produtor com pendentes', 'GET', `/farmers/${farmer.id}/services`, undefined, 200,
    (b) => assert.equal(b[0]?.applications_pending, 2));

  await step<ApplicationResponse & ServiceResponse>('aceitar trabalhador', 'PATCH', `/farmers/services/${service.id}/analyze`, { application_id: application.id, action: 'Accept' }, 200, (b) => {
    assert.equal(b.service.status, 'In Progress');
    assert.equal(b.service.worker_id, worker.id);
  });
  actAs(carla);
  await step<ApplicationWithService[]>('outra candidatura foi recusada', 'GET', `/workers/${worker2.id}/applications`, undefined, 200,
    (b) => assert.equal(b[0]?.status, 'Rejected'));
  actAs(bruno);
  await step<OpenService[]>('serviços do trabalhador com o ponto no mapa', 'GET', `/workers/${worker.id}/services`, undefined, 200, (b) => {
    assert.equal(b[0]?.id, service.id);
    assert.deepEqual([b[0].farm.latitude, b[0].farm.longitude], [-22.1165, -43.2092]);
  });
  await step<OpenService>('aceito vê o ponto no detalhe', 'GET', `/workers/services/${service.id}?worker_id=${worker.id}`, undefined, 200,
    (b) => assert.equal(b.farm.latitude, -22.1165));
  await step('worker_id de outro trabalhador', 'GET', `/workers/services/${service.id}?worker_id=${worker2.id}`, undefined, 403);
  await step('worker_id inválido no detalhe', 'GET', `/workers/services/${service.id}?worker_id=abc`, undefined, 400);
  actAs(carla);
  await step<OpenService>('outro trabalhador não vê o ponto', 'GET', `/workers/services/${service.id}?worker_id=${worker2.id}`, undefined, 200,
    (b) => assert.equal(b.farm.latitude, undefined));

  actAs(ana);
  await step<PaymentResponse>('liberar pagamento', 'POST', `/farmers/services/${service.id}/payment`, undefined, 200, (b) => {
    assert.equal(b.service.status, 'Completed');
    assert.equal(b.payment.value, 900);
    assert.equal(b.service.payment_id, b.payment.id);
  });
  await step<FarmerServiceItem[]>('filtrar concluídos', 'GET', `/farmers/${farmer.id}/services?status=Completed`, undefined, 200,
    (b) => assert.equal(b.length, 1));

  console.log('\nCasos de erro');
  await step('CPF inválido', 'POST', '/farmers', { name: 'X', email: 'x@exemplo.com', phone: '1', cpf: '12345678900', password: PW }, 400);
  await step('e-mail inválido', 'POST', '/workers', { name: 'X', email: 'x@', phone: '1', cpf: '11144477735', password: PW }, 400);
  await step('campo faltando', 'POST', '/farmers', { name: 'X', email: 'x@exemplo.com' }, 400);
  await step('e-mail duplicado', 'POST', '/farmers', { name: 'X', email: 'ana@exemplo.com', phone: '1', cpf: '11144477735', password: PW }, 409);
  await step('CPF duplicado', 'POST', '/farmers', { name: 'X', email: 'novo@exemplo.com', phone: '1', cpf: '52998224725', password: PW }, 409);
  await step('fazenda em nome de outro produtor', 'POST', '/farmers/999/farms', { address: 'a', city: 'b', state: 'MG', latitude: -22.1165, longitude: -43.2092 }, 403);

  await step('fazenda sem o ponto no mapa', 'POST', `/farmers/${farmer.id}/farms`, { address: 'a', city: 'b', state: 'MG' }, 400);
  await step('latitude fora da faixa', 'POST', `/farmers/${farmer.id}/farms`, { address: 'a', city: 'b', state: 'MG', latitude: 91, longitude: 0 }, 400);
  await step('longitude como texto', 'POST', `/farmers/${farmer.id}/farms`, { address: 'a', city: 'b', state: 'MG', latitude: 0, longitude: '-43' }, 400);

  const { farmer: other, token: outro } = await step<FarmerSignupResponse>('cadastrar outro produtor', 'POST', '/farmers',
    { name: 'Outro', email: 'outro@exemplo.com', phone: '1', cpf: '11144477735', password: PW }, 201);
  actAs(outro);
  await step('fazenda de outro produtor', 'POST', '/farmers/services',
    { farmer_id: other.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1 }, 400);
  await step('serviço de outro produtor', 'GET', `/farmers/services/${service.id}`, undefined, 403);
  await step('perfil de outro produtor', 'PATCH', `/farmers/${farmer.id}`, { name: 'Invasor' }, 403);
  actAs(bruno);
  await step('trabalhador no painel do produtor', 'GET', `/farmers/${farmer.id}`, undefined, 403);
  actAs(null);
  await step('sem token', 'GET', `/farmers/${farmer.id}`, undefined, 401);
  await step('vagas sem token', 'GET', '/workers/services', undefined, 401);
  await step('token inválido', 'GET', `/farmers/${farmer.id}`, undefined, 401, undefined, { Authorization: 'Bearer nao-e-um-token' });
  await step('token no lugar errado', 'GET', `/farmers/${farmer.id}?access_token=${ana}`, undefined, 401);
  const challenge = await fetch(`${baseUrl}/farmers/${farmer.id}`, { headers: { Origin: FRONTEND_ORIGIN } });
  assert.equal(challenge.headers.get('www-authenticate'), 'Bearer realm="ruraliza"');
  assert.match(challenge.headers.get('access-control-expose-headers') ?? '', /WWW-Authenticate/);
  const wrongPassword = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana@exemplo.com', password: 'errada-123' })
  });
  assert.equal([wrongPassword.status, wrongPassword.headers.get('www-authenticate')].join(), '401,');
  passed++;
  console.log('  ok  401 — só o 401 de sessão traz WWW-Authenticate (exposto no CORS)');
  actAs(ana);
  await step('valor zero', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 0 }, 400);
  await step('publicar em nome de outro produtor', 'POST', '/farmers/services',
    { farmer_id: 999, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1 }, 403);
  await step('serviço sem campos', 'POST', '/farmers/services', { farmer_id: farmer.id }, 400);

  const { service: open } = await step<ServiceResponse>('publicar 2º serviço', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Plantio', category: 'Plantio', duration: 8, price: 300 }, 201);
  actAs(bruno);
  await step('candidatar em serviço inexistente', 'POST', '/workers/services/999/apply', { worker_id: worker.id }, 404);
  await step('candidatar em nome de outro trabalhador', 'POST', `/workers/services/${open.id}/apply`, { worker_id: worker2.id }, 403);
  actAs(carla);
  const { application: openApp } = await step<ApplicationResponse>('candidatar no 2º serviço', 'POST', `/workers/services/${open.id}/apply`, { worker_id: worker2.id }, 201);
  await step('candidatura duplicada', 'POST', `/workers/services/${open.id}/apply`, { worker_id: worker2.id }, 409);
  await step('candidatar em serviço concluído', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker2.id }, 409);

  actAs(ana);

  await step('ação inválida', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: openApp.id, action: 'Maybe' }, 400);
  await step('candidatura inexistente', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: 999, action: 'Accept' }, 404);
  await step('candidatura de outro serviço', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: application2.id, action: 'Accept' }, 400);
  await step('analisar serviço já em andamento/concluído', 'PATCH', `/farmers/services/${service.id}/analyze`, { application_id: application2.id, action: 'Accept' }, 409);
  await step<ApplicationResponse>('recusar candidatura', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: openApp.id, action: 'Reject' }, 200,
    (b) => assert.equal(b.application.status, 'Rejected'));
  await step('recusar de novo', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: openApp.id, action: 'Reject' }, 409);

  await step('pagar serviço não iniciado', 'POST', `/farmers/services/${open.id}/payment`, undefined, 409);
  await step('pagar duas vezes', 'POST', `/farmers/services/${service.id}/payment`, undefined, 409);
  await step('status de filtro inválido', 'GET', `/farmers/${farmer.id}/services?status=Foo`, undefined, 400);
  await step('serviço inexistente', 'GET', '/farmers/services/999', undefined, 404);
  await step('rota inexistente', 'GET', '/nada', undefined, 404);

  console.log('\nSenha e acesso');
  await step('cadastro sem senha', 'POST', '/workers', { name: 'X', email: 'semsenha@exemplo.com', phone: '1', cpf: '39053344705' }, 400);
  await step('cadastro com senha curta', 'POST', '/workers', { name: 'X', email: 'curta@exemplo.com', phone: '1', cpf: '39053344705', password: '1234567' }, 400);
  await step<Farmer>('a senha não aparece no perfil', 'GET', `/farmers/${farmer.id}`, undefined, 200, (b) => assert.equal('password' in b, false));
  await step<LoginResponse>('entrar', 'POST', '/auth/login', { email: 'ANA@exemplo.com', password: PW }, 200,
    (b) => assert.deepEqual(b.user, farmerSession));
  await step('senha errada', 'POST', '/auth/login', { email: 'ana@exemplo.com', password: 'errada-123' }, 401);
  await step('e-mail sem cadastro', 'POST', '/auth/login', { email: 'ninguem@exemplo.com', password: PW }, 401);
  await step('login sem senha', 'POST', '/auth/login', { email: 'ana@exemplo.com' }, 400);
  await step('editar a senha pelo PATCH do perfil', 'PATCH', `/farmers/${farmer.id}`, { password: 'outra-senha-1' }, 400);

  actAs(bruno);
  await step('trocar senha com a atual errada', 'PATCH', `/workers/${worker.id}/password`, { current_password: 'errada-123', new_password: 'nova-senha-1' }, 401);
  await step('trocar para a mesma senha', 'PATCH', `/workers/${worker.id}/password`, { current_password: PW, new_password: PW }, 400);
  await step('trocar senha de outro trabalhador', 'PATCH', `/workers/${worker2.id}/password`, { current_password: PW, new_password: 'nova-senha-1' }, 403);
  await step('trocar senha', 'PATCH', `/workers/${worker.id}/password`, { current_password: PW, new_password: 'nova-senha-1' }, 200);
  await step('senha antiga não entra mais', 'POST', '/auth/login', { email: 'bruno@exemplo.com', password: PW }, 401);
  await step<LoginResponse>('nova senha entra', 'POST', '/auth/login', { email: 'bruno@exemplo.com', password: 'nova-senha-1' }, 200,
    (b) => assert.ok(b.token.length > 0));

  await step('esqueci a senha: e-mail sem cadastro', 'POST', '/auth/password-reset', { email: 'ninguem@exemplo.com' }, 404);
  await step('esqueci a senha: e-mail inválido', 'POST', '/auth/password-reset', { email: 'bruno@' }, 400);
  const { reset_token } = await step<PasswordResetRequestResponse>('esqueci a senha: pedir', 'POST', '/auth/password-reset',
    { email: 'Bruno@exemplo.com' }, 200, (b) => assert.ok(b.reset_token.length >= 32));
  await step('nova senha curta', 'POST', '/auth/password-reset/confirm', { token: reset_token, password: 'curta' }, 400);
  await step('token inválido', 'POST', '/auth/password-reset/confirm', { token: 'nao-existe', password: 'senha-redefinida' }, 400);
  await step<LoginResponse>('criar a nova senha', 'POST', '/auth/password-reset/confirm', { token: reset_token, password: 'senha-redefinida' }, 200,
    (b) => assert.deepEqual(b.user, workerSession));
  await step('token já usado', 'POST', '/auth/password-reset/confirm', { token: reset_token, password: 'outra-redefinida' }, 400);
  await step('entra com a senha redefinida', 'POST', '/auth/login', { email: 'bruno@exemplo.com', password: 'senha-redefinida' }, 200);

  console.log('\nConta com os dois perfis');
  await step('e-mail de outra conta no cadastro', 'POST', '/workers', { name: 'X', email: 'ana@exemplo.com', phone: '1', cpf: '45612378955', password: PW }, 409);
  await step('CPF de outra conta no cadastro', 'POST', '/workers', { name: 'X', email: 'x2@exemplo.com', phone: '1', cpf: '52998224725', password: PW }, 409);
  actAs(ana);
  const accountUrl = `/accounts/${farmerSession.account_id}`;
  await step<SessionUser>('sessão da conta', 'GET', accountUrl, undefined, 200, (b) => assert.deepEqual(b, farmerSession));
  await step('conta de outra pessoa', 'GET', `/accounts/${workerSession.account_id}`, undefined, 403);
  const pushSub = { endpoint: 'https://push.exemplo.com/smoke', keys: { p256dh: 'chave', auth: 'segredo' } };
  await step('ativar push', 'POST', `${accountUrl}/push-subscriptions`, pushSub, 201);
  await step('ativar push de novo (mesmo navegador)', 'POST', `${accountUrl}/push-subscriptions`, pushSub, 201);
  await step('push com endpoint http', 'POST', `${accountUrl}/push-subscriptions`, { ...pushSub, endpoint: 'http://push.exemplo.com/x' }, 400);
  await step('push sem keys', 'POST', `${accountUrl}/push-subscriptions`, { endpoint: pushSub.endpoint }, 400);
  await step('push em conta de outra pessoa', 'POST', `/accounts/${workerSession.account_id}/push-subscriptions`, pushSub, 403);
  await step('desativar push', 'DELETE', `${accountUrl}/push-subscriptions`, { endpoint: pushSub.endpoint }, 200);
  await step('desativar push sem endpoint', 'DELETE', `${accountUrl}/push-subscriptions`, {}, 400);
  await step('painel que a conta não tem', 'PATCH', `${accountUrl}/active-role`, { role: 'worker' }, 404);
  await step('perfil novo com e-mail', 'POST', `${accountUrl}/profiles`, { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725', email: 'x@exemplo.com' }, 400);
  await step('perfil novo com CPF de outra conta', 'POST', `${accountUrl}/profiles`, { role: 'worker', name: 'Ana', phone: '1', cpf: '98765432100' }, 409);
  const { user: both } = await step<SessionResponse>('virar trabalhador também', 'POST', `${accountUrl}/profiles`,
    { role: 'worker', name: 'Ana Produtora', phone: '24999990000', cpf: '52998224725', experience: 'Colheita' }, 201,
    (b) => assert.deepEqual([b.user.role, b.user.profiles.farmer], ['worker', farmer.id]));
  await step('o perfil já existe', 'POST', `${accountUrl}/profiles`, { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' }, 409);
  await step('candidatar-se ao próprio serviço', 'POST', `/workers/services/${open.id}/apply`, { worker_id: both.id }, 409);
  await step<LoginResponse>('o login abre o último painel', 'POST', '/auth/login', { email: 'ana@exemplo.com', password: PW }, 200,
    (b) => assert.equal(b.user.role, 'worker'));
  await step<SessionResponse>('voltar ao painel de produtor', 'PATCH', `${accountUrl}/active-role`, { role: 'farmer' }, 200,
    (b) => assert.deepEqual([b.user.role, b.user.id], ['farmer', farmer.id]));

  console.log('\nEdição e remoção');
  const { farmer: fd, token: dora } = await step<FarmerSignupResponse>('produtor a remover', 'POST', '/farmers',
    { name: 'Dora', email: 'dora@exemplo.com', phone: '1', cpf: '39053344705', password: PW }, 201);
  actAs(dora);
  const { farm: fdFarm } = await step<FarmResponse>('fazenda a remover', 'POST', `/farmers/${fd.id}/farms`,
    { address: 'Sítio', city: 'Vassouras', state: 'RJ', latitude: -22.1165, longitude: -43.2092 }, 201);
  await step<Farmer>('farms guarda os IDs', 'GET', `/farmers/${fd.id}`, undefined, 200, (b) => assert.deepEqual(b.farms, [fdFarm.id]));
  await step<FarmerResponse>('editar produtor', 'PATCH', `/farmers/${fd.id}`, { name: 'Dora Lima' }, 200, (b) => assert.equal(b.farmer.name, 'Dora Lima'));
  await step('editar cpf', 'PATCH', `/farmers/${fd.id}`, { cpf: '11144477735' }, 400);
  await step('editar para e-mail em uso', 'PATCH', `/farmers/${fd.id}`, { email: 'ana@exemplo.com' }, 409);

  const { service: fdService } = await step<ServiceResponse>('serviço a remover', 'POST', '/farmers/services',
    { farmer_id: fd.id, farm_id: fdFarm.id, name: 'Roçada', category: 'Outros', duration: 4, price: 200 }, 201);
  const { worker: wd, token: eli } = await step<WorkerSignupResponse>('trabalhador a remover', 'POST', '/workers',
    { name: 'Eli', email: 'eli@exemplo.com', phone: '1', cpf: '93541134780', password: PW }, 201);
  actAs(eli);
  const { application: wdApp } = await step<ApplicationResponse>('candidatura a remover', 'POST', `/workers/services/${fdService.id}/apply`, { worker_id: wd.id }, 201);
  actAs(dora);
  await step('aceitar para ficar em andamento', 'PATCH', `/farmers/services/${fdService.id}/analyze`, { application_id: wdApp.id, action: 'Accept' }, 200);
  await step('remover produtor com serviço em andamento', 'DELETE', `/farmers/${fd.id}`, undefined, 409);
  actAs(eli);
  await step('remover trabalhador com serviço em andamento', 'DELETE', `/workers/${wd.id}`, undefined, 409);
  actAs(dora);
  await step('pagar para concluir', 'POST', `/farmers/services/${fdService.id}/payment`, undefined, 200);

  actAs(eli);
  await step('remover trabalhador', 'DELETE', `/workers/${wd.id}`, undefined, 200);
  await step('token de conta removida não vale mais', 'DELETE', `/workers/${wd.id}`, undefined, 401);
  actAs(dora);
  await step<ApplicationWithWorker[]>('candidaturas do removido somem', 'GET', `/farmers/services/${fdService.id}/applications`, undefined, 200,
    (b) => assert.equal(b.length, 0));
  await step('remover produtor', 'DELETE', `/farmers/${fd.id}`, undefined, 200);
  await step('removido não entra mais', 'POST', '/auth/login', { email: 'dora@exemplo.com', password: PW }, 401);
  await step('sessão do produtor removido cai', 'GET', `/farmers/${fd.id}`, undefined, 401);
  actAs(ana);
  await step('serviço removido junto', 'GET', `/farmers/services/${fdService.id}`, undefined, 404);

  console.log('\nEdição e cancelamento de serviço');
  const { service: editable } = await step<ServiceResponse>('serviço a editar', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Poda', category: 'Manutenção', duration: 6, price: 250 }, 201);
  await step<ServiceResponse>('editar serviço', 'PATCH', `/farmers/services/${editable.id}`, { name: 'Poda de café', price: 320 }, 200, (b) => {
    assert.equal(b.service.name, 'Poda de café');
    assert.equal(b.service.price, 320);
    assert.equal(b.service.duration, 6);
  });
  await step('editar com valor inválido', 'PATCH', `/farmers/services/${editable.id}`, { price: -1 }, 400);
  await step('editar status direto', 'PATCH', `/farmers/services/${editable.id}`, { status: 'Completed' }, 400);
  actAs(outro);
  const { farm: otherFarm } = await step<FarmResponse>('fazenda de outro produtor', 'POST', `/farmers/${other.id}/farms`, { address: 'a', city: 'b', state: 'MG', latitude: -22.1165, longitude: -43.2092 }, 201);
  actAs(ana);
  await step('editar para fazenda de outro', 'PATCH', `/farmers/services/${editable.id}`, { farm_id: otherFarm.id }, 400);
  await step('editar para fazenda inexistente', 'PATCH', `/farmers/services/${editable.id}`, { farm_id: 999 }, 404);
  await step('editar serviço concluído', 'PATCH', `/farmers/services/${service.id}`, { name: 'X' }, 409);
  await step('editar serviço inexistente', 'PATCH', '/farmers/services/999', { name: 'X' }, 404);

  actAs(carla);
  const { application: editableApp } = await step<ApplicationResponse>('candidatura no serviço a cancelar', 'POST', `/workers/services/${editable.id}/apply`, { worker_id: worker2.id }, 201);
  actAs(ana);
  await step<ServiceResponse>('cancelar serviço', 'PATCH', `/farmers/services/${editable.id}/cancel`, undefined, 200,
    (b) => assert.equal(b.service.status, 'Cancelled'));
  await step<ApplicationWithWorker[]>('candidatura pendente foi recusada', 'GET', `/farmers/services/${editable.id}/applications`, undefined, 200,
    (b) => assert.equal(b.find((a) => a.id === editableApp.id)?.status, 'Rejected'));
  actAs(bruno);
  await step<OpenService[]>('cancelado some das vagas', 'GET', '/workers/services', undefined, 200,
    (b) => assert.ok(!b.some((s) => s.id === editable.id)));
  actAs(ana);
  await step('cancelar de novo', 'PATCH', `/farmers/services/${editable.id}/cancel`, undefined, 409);
  await step('editar cancelado', 'PATCH', `/farmers/services/${editable.id}`, { name: 'X' }, 409);

  console.log('\nDesistência do trabalhador');
  const { service: ws } = await step<ServiceResponse>('serviço para desistência', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Capina', category: 'Manutenção', duration: 5, price: 150 }, 201);
  const { worker: worker3, token: davi } = await step<WorkerSignupResponse>('cadastrar 3º trabalhador', 'POST', '/workers',
    { name: 'Davi', email: 'davi@exemplo.com', phone: '1', cpf: '71428793860', password: PW }, 201);
  const farmerEvents = await openEvents('produtor acompanha as candidaturas (SSE)', `/farmers/services/${ws.id}/events`);
  actAs(bruno);
  await step('candidatar para desistir', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker.id }, 201);
  await farmerEvents.expectEvent('produtor avisado da candidatura', 'applications');
  await step<ServiceResponse>('desistir da candidatura', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker.id }, 200,
    (b) => assert.equal(b.service.status, 'Pending'));
  await farmerEvents.expectEvent('produtor avisado da desistência', 'applications');
  farmerEvents.close();
  await step('acompanhar candidaturas de outro trabalhador', 'GET', `/workers/${worker2.id}/events`, undefined, 403);
  actAs(ana);
  await step('acompanhar serviço inexistente', 'GET', '/farmers/services/999/events', undefined, 404);
  await step<ApplicationWithWorker[]>('candidatura removida', 'GET', `/farmers/services/${ws.id}/applications`, undefined, 200, (b) => assert.equal(b.length, 0));
  actAs(bruno);
  const { application: wa1 } = await step<ApplicationResponse>('candidatar de novo', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker.id }, 201);
  actAs(carla);
  const { application: wa2 } = await step<ApplicationResponse>('2º candidato', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker2.id }, 201);
  actAs(davi);
  const { application: wa3 } = await step<ApplicationResponse>('3º candidato', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker3.id }, 201);
  actAs(carla);
  const worker2Events = await openEvents('2º candidato acompanha as candidaturas (SSE)', `/workers/${worker2.id}/events`);
  actAs(ana);
  await step('produtor recusa o 3º', 'PATCH', `/farmers/services/${ws.id}/analyze`, { application_id: wa3.id, action: 'Reject' }, 200);
  await step('produtor aceita o 1º', 'PATCH', `/farmers/services/${ws.id}/analyze`, { application_id: wa1.id, action: 'Accept' }, 200);
  await worker2Events.expectEvent('2º candidato avisado da recusa pelo aceite', 'applications');
  actAs(bruno);
  await step<ServiceResponse>('desistir do serviço aceito', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker.id }, 200, (b) => {
    assert.equal(b.service.status, 'Pending');
    assert.equal(b.service.worker_id, null);
  });
  await worker2Events.expectEvent('2º candidato avisado da candidatura de volta a Pending', 'applications');
  worker2Events.close();
  actAs(ana);
  await step<ApplicationWithWorker[]>('volta à etapa anterior', 'GET', `/farmers/services/${ws.id}/applications`, undefined, 200, (b) => {
    assert.equal(b.length, 2);
    assert.equal(b.find((a) => a.id === wa2.id)?.status, 'Pending'); // recusada pelo aceite: volta
    assert.equal(b.find((a) => a.id === wa3.id)?.status, 'Rejected'); // recusada pelo produtor: continua
  });
  actAs(bruno);
  await step<OpenService[]>('vaga reaberta', 'GET', '/workers/services', undefined, 200, (b) => assert.ok(b.some((s) => s.id === ws.id)));
  await step('desistir sem candidatura', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker.id }, 404);
  actAs(davi);
  await step('desistir de candidatura recusada', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker3.id }, 409);
  actAs(bruno);
  await step('desistir de serviço concluído', 'PATCH', `/workers/services/${service.id}/withdraw`, { worker_id: worker.id }, 409);
  await step('desistir sem worker_id', 'PATCH', `/workers/services/${ws.id}/withdraw`, {}, 400);

  console.log('\nEdição e remoção de fazenda');
  actAs(ana);
  const { farm: f2 } = await step<FarmResponse>('2ª fazenda', 'POST', `/farmers/${farmer.id}/farms`, { address: 'Sítio Novo', city: 'Paty', state: 'RJ', latitude: -22.1165, longitude: -43.2092 }, 201);
  await step<FarmResponse>('editar fazenda', 'PATCH', `/farmers/${farmer.id}/farms/${f2.id}`, { address: 'Sítio Novo, Km 5', city: '  Paty do Alferes ' }, 200, (b) => {
    assert.equal(b.farm.address, 'Sítio Novo, Km 5');
    assert.equal(b.farm.city, 'Paty do Alferes');
    assert.equal(b.farm.state, 'RJ');
  });
  await step<FarmResponse>('mover o ponto no mapa', 'PATCH', `/farmers/${farmer.id}/farms/${f2.id}`, { latitude: -22.42, longitude: -43.43 }, 200,
    (b) => assert.deepEqual([b.farm.latitude, b.farm.longitude], [-22.42, -43.43]));
  await step('latitude sem longitude', 'PATCH', `/farmers/${farmer.id}/farms/${f2.id}`, { latitude: -22.42 }, 400);
  await step('editar com campo vazio', 'PATCH', `/farmers/${farmer.id}/farms/${f2.id}`, { city: ' ' }, 400);
  await step('trocar dono da fazenda', 'PATCH', `/farmers/${farmer.id}/farms/${f2.id}`, { farmer_id: other.id }, 400);
  await step('fazenda de outro produtor', 'PATCH', `/farmers/${farmer.id}/farms/${otherFarm.id}`, { city: 'X' }, 404);
  await step('fazenda inexistente', 'DELETE', `/farmers/${farmer.id}/farms/999`, undefined, 404);

  const { service: f2Service } = await step<ServiceResponse>('serviço na 2ª fazenda', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: f2.id, name: 'Cerca', category: 'Manutenção', duration: 3, price: 120 }, 201);
  await step('remover fazenda com serviço aberto', 'DELETE', `/farmers/${farmer.id}/farms/${f2.id}`, undefined, 409);
  await step('cancelar serviço da fazenda', 'PATCH', `/farmers/services/${f2Service.id}/cancel`, undefined, 200);
  await step('remover fazenda', 'DELETE', `/farmers/${farmer.id}/farms/${f2.id}`, undefined, 200);
  await step<Farmer>('fazenda sai do produtor', 'GET', `/farmers/${farmer.id}`, undefined, 200, (b) => assert.ok(!b.farms.includes(f2.id)));
  await step<Farm[]>('fazenda sai da lista', 'GET', `/farmers/${farmer.id}/farms`, undefined, 200, (b) => assert.ok(!b.some((f) => f.id === f2.id)));
  await step<ServiceWithFarm>('serviço encerrado continua com a fazenda', 'GET', `/farmers/services/${f2Service.id}`, undefined, 200,
    (b) => assert.equal(b.farm.city, 'Paty do Alferes'));
  await step('editar fazenda removida', 'PATCH', `/farmers/${farmer.id}/farms/${f2.id}`, { city: 'X' }, 404);
  await step('remover de novo', 'DELETE', `/farmers/${farmer.id}/farms/${f2.id}`, undefined, 404);
  await step('publicar em fazenda removida', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: f2.id, name: 'X', category: 'Outros', duration: 1, price: 1 }, 404);
  await step('mover serviço para fazenda removida', 'PATCH', `/farmers/services/${ws.id}`, { farm_id: f2.id }, 404);

  console.log('\nFotos');
  // Foto de celular simulada: 2400x1600 JPEG. Perfil tem que voltar WebP quadrado, no máximo 1000px.
  const bigPhoto = new Uint8Array(await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3a7d24' } }).jpeg().toBuffer());
  const smallPhoto = new Uint8Array(await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ee8a14' } }).png().toBuffer());

  actAs(bruno);
  const { worker: wPhoto } = await upload<WorkerResponse>('foto de perfil do trabalhador', `/workers/${worker.id}/photo`, bigPhoto, 'image/jpeg', 200,
    (b) => assert.match(b.worker.photo_url ?? '', /^\/api\/images\/.+\.webp$/));
  const firstUrl = wPhoto.photo_url ?? '';
  const size = await download('foto reduzida, quadrada e em WebP', firstUrl);
  assert.deepEqual(size, { width: 1000, height: 1000, format: 'webp' });
  await upload<WorkerResponse>('trocar a foto', `/workers/${worker.id}/photo`, smallPhoto, 'image/png', 200,
    (b) => assert.notEqual(b.worker.photo_url, firstUrl));
  await download('foto antiga apagada', firstUrl, 404);
  await upload('arquivo que não é imagem', `/workers/${worker.id}/photo`, new TextEncoder().encode('não sou uma foto'), 'image/jpeg', 400);
  await upload('sem Content-Type de imagem', `/workers/${worker.id}/photo`, bigPhoto, 'application/octet-stream', 400);
  await upload('foto maior que 10 MB', `/workers/${worker.id}/photo`, new Uint8Array(11 * 1024 * 1024), 'image/jpeg', 413);
  await upload('foto no perfil de outro trabalhador', `/workers/${worker2.id}/photo`, smallPhoto, 'image/png', 403);
  await step<WorkerResponse>('remover foto do trabalhador', 'DELETE', `/workers/${worker.id}/photo`, undefined, 200, (b) => assert.equal(b.worker.photo_url, null));

  actAs(ana);
  await upload<FarmerResponse>('foto de perfil do produtor', `/farmers/${farmer.id}/photo`, smallPhoto, 'image/png', 200,
    (b) => assert.ok(b.farmer.photo_url));
  await step<FarmerResponse>('remover foto do produtor', 'DELETE', `/farmers/${farmer.id}/photo`, undefined, 200, (b) => assert.equal(b.farmer.photo_url, null));

  let farmWithPhotos = farm;
  for (let i = 1; i <= 6; i++) {
    ({ farm: farmWithPhotos } = await upload<FarmResponse>(`foto ${i} da fazenda`, `/farmers/${farmer.id}/farms/${farm.id}/photos`, smallPhoto, 'image/png', 201,
      (b) => assert.equal(b.farm.photos.length, i)));
  }
  await upload('7ª foto da fazenda', `/farmers/${farmer.id}/farms/${farm.id}/photos`, smallPhoto, 'image/png', 409);
  await upload('foto em fazenda de outro produtor', `/farmers/${farmer.id}/farms/${otherFarm.id}/photos`, smallPhoto, 'image/png', 404);
  const [firstFarmPhoto] = farmWithPhotos.photos;
  assert.ok(firstFarmPhoto);
  await step<FarmResponse>('remover foto da fazenda', 'DELETE', `/farmers/${farmer.id}/farms/${farm.id}/photos/${firstFarmPhoto.id}`, undefined, 200,
    (b) => assert.equal(b.farm.photos.length, 5));
  await step('remover foto inexistente', 'DELETE', `/farmers/${farmer.id}/farms/${farm.id}/photos/nao-existe.webp`, undefined, 404);
  await download('foto removida não é mais servida', firstFarmPhoto.url, 404);

  console.log('\nCurrículo');
  actAs(bruno);
  const resumePdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
  const { worker: wResume } = await upload<WorkerResponse>('currículo do trabalhador', `/workers/${worker.id}/resume`, resumePdf, 'application/pdf', 200,
    (b) => assert.match(b.worker.resume_url ?? '', /^\/api\/documents\/.+\.pdf$/));
  const firstResume = wResume.resume_url ?? '';
  await downloadPdf('currículo servido como enviado', firstResume, 200, resumePdf);
  await upload<WorkerResponse>('trocar o currículo', `/workers/${worker.id}/resume`, resumePdf, 'application/pdf', 200,
    (b) => assert.notEqual(b.worker.resume_url, firstResume));
  await downloadPdf('currículo antigo apagado', firstResume, 404);
  await upload('arquivo que não é PDF', `/workers/${worker.id}/resume`, new TextEncoder().encode('não sou um PDF'), 'application/pdf', 400);
  await upload('sem Content-Type de PDF', `/workers/${worker.id}/resume`, resumePdf, 'application/octet-stream', 400);
  await upload('currículo maior que 5 MB', `/workers/${worker.id}/resume`, new Uint8Array(6 * 1024 * 1024), 'application/pdf', 413);
  await upload('currículo no perfil de outro trabalhador', `/workers/${worker2.id}/resume`, resumePdf, 'application/pdf', 403);
  await step<WorkerResponse>('remover currículo', 'DELETE', `/workers/${worker.id}/resume`, undefined, 200, (b) => assert.equal(b.worker.resume_url, null));

  console.log('\nPerfil do trabalhador');
  await step<WorkerResponse>('bio, cursos e contato', 'PATCH', `/workers/${worker.id}`,
    { bio: 'Tratorista há 6 anos.', courses: 'NR-31 (SENAR)', phone: '24911112222' }, 200, (b) => {
      assert.equal(b.worker.bio, 'Tratorista há 6 anos.');
      assert.equal(b.worker.courses, 'NR-31 (SENAR)');
      assert.equal(b.worker.phone, '24911112222');
    });
  await step('bio longa demais', 'PATCH', `/workers/${worker.id}`, { bio: 'x'.repeat(501) }, 400);
  await step<WorkerResponse>('limpar os cursos', 'PATCH', `/workers/${worker.id}`, { courses: null }, 200, (b) => assert.equal(b.worker.courses, null));

  console.log('\nDescrição, validade e exclusão');
  actAs(ana);
  const { service: described } = await step<ServiceResponse>('serviço com descrição e validade', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Roçada de pasto', description: '  Roçar 2 ha com roçadeira costal.  ', category: 'Manutenção', duration: 12, price: 600, expires_at: brDay(10) }, 201,
    (b) => {
      assert.equal(b.service.description, 'Roçar 2 ha com roçadeira costal.');
      assert.equal(b.service.expires_at, brDay(10));
    });
  await step('validade no passado', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1, expires_at: brDay(-1) }, 400);
  await step('validade em formato errado', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1, expires_at: '31/10/2026' }, 400);
  await step('data que não existe', 'PATCH', `/farmers/services/${described.id}`, { expires_at: '2026-02-30' }, 400);
  await step<ServiceResponse>('validade vence hoje ainda vale', 'PATCH', `/farmers/services/${described.id}`, { expires_at: brDay(0) }, 200);
  actAs(bruno);
  await step<OpenService[]>('vaga com validade hoje aparece', 'GET', '/workers/services?q=rocada', undefined, 200,
    (b) => assert.ok(b.some((j) => j.id === described.id)));
  actAs(ana);
  await step<ServiceResponse>('remover prazo e descrição', 'PATCH', `/farmers/services/${described.id}`, { expires_at: null, description: '' }, 200, (b) => {
    assert.equal(b.service.expires_at, null);
    assert.equal(b.service.description, null);
  });
  actAs(bruno);
  await step<OpenService>('vaga mostra fotos da fazenda', 'GET', `/workers/services/${described.id}`, undefined, 200,
    (b) => assert.equal(b.farm.photos.length, 5));
  actAs(ana);
  // Não existe exclusão de serviço: o caminho é cancelar (PATCH /cancel), que mantém o histórico.
  await step('rota de exclusão de serviço não existe', 'DELETE', `/farmers/services/${described.id}`, undefined, 404);

  console.log('\nFiltros de vagas');
  const post = (name: string, description: string, category: string, duration: number, price: number): Promise<ServiceResponse> =>
    step<ServiceResponse>(`publicar "${name}"`, 'POST', '/farmers/services', { farmer_id: farmer.id, farm_id: farm.id, name, description, category, duration, price }, 201);
  const cafe = (await post('Colheita de Café', 'Café arábica em terreno inclinado', 'Colheita', 30, 1500)).service;
  const ordenha = (await post('Ordenha', 'Ordenha mecânica às 5h', 'Manejo de gado', 6, 300)).service;
  const trator = (await post('Gradear área', 'Trator próprio da fazenda, precisa de CNH', 'Operação de máquinas', 16, 900)).service;
  const ids = (b: OpenService[]): number[] => b.map((j) => j.id);
  actAs(bruno);

  await step<OpenService[]>('busca sem acento acha "Café"', 'GET', '/workers/services?q=cafe', undefined, 200,
    (b) => assert.ok(ids(b).includes(cafe.id)));
  await step<OpenService[]>('busca na descrição', 'GET', '/workers/services?q=CNH', undefined, 200, (b) => assert.deepEqual(ids(b), [trator.id]));
  await step<OpenService[]>('todas as palavras precisam aparecer', 'GET', '/workers/services?q=ordenha%20trator', undefined, 200, (b) => assert.deepEqual(b, []));
  await step<OpenService[]>('busca pela cidade', 'GET', '/workers/services?q=tres%20rios&category=Manejo%20de%20gado', undefined, 200,
    (b) => assert.deepEqual(ids(b), [ordenha.id]));
  await step<OpenService[]>('carga horária entre 10 e 20 h', 'GET', '/workers/services?min_hours=10&max_hours=20', undefined, 200,
    (b) => assert.ok(b.length > 0 && b.every((j) => j.duration >= 10 && j.duration <= 20)));
  await step<OpenService[]>('publicadas hoje', 'GET', `/workers/services?from=${brDay(0)}&to=${brDay(0)}`, undefined, 200,
    (b) => assert.ok(ids(b).includes(cafe.id)));
  await step<OpenService[]>('publicadas amanhã em diante', 'GET', `/workers/services?from=${brDay(1)}`, undefined, 200, (b) => assert.deepEqual(b, []));
  await step<OpenService[]>('ordem: maior valor primeiro', 'GET', '/workers/services?sort=price_desc', undefined, 200,
    (b) => assert.ok(b.every((j, i) => i === 0 || (b[i - 1]?.price ?? 0) >= j.price)));
  await step<OpenService[]>('ordem: menos horas primeiro', 'GET', '/workers/services?sort=duration_asc', undefined, 200,
    (b) => assert.ok(b.every((j, i) => i === 0 || (b[i - 1]?.duration ?? 0) <= j.duration)));
  await step('mínimo maior que o máximo', 'GET', '/workers/services?min_hours=20&max_hours=10', undefined, 400);
  await step('horas que não são número', 'GET', '/workers/services?min_hours=muitas', undefined, 400);
  await step('data inválida no filtro', 'GET', '/workers/services?from=ontem', undefined, 400);
  await step('ordem desconhecida', 'GET', '/workers/services?sort=aleatorio', undefined, 400);

  const invalidJson = await call('POST', '/farmers', undefined, '{ invalido');
  assert.equal(invalidJson.status, 400);
  assert.equal(checkAgainstOpenApi('POST', '/api/farmers', invalidJson.status, invalidJson.body), null);
  passed++;
  console.log('  ok  400 POST   /farmers  — JSON inválido');

  await administration({ ana, outro, carla, farmer, other, worker, worker2, farmId: farm.id });

  console.log('\nDocumentação');
  actAs(null);
  await step('health check', 'GET', '/health', undefined, 200);

  const savedKey = process.env['GOOGLE_MAPS_API_KEY'];
  const savedOrigins = process.env['CORS_ORIGINS'];
  delete process.env['CORS_ORIGINS'];
  const fromFrontend = { Origin: FRONTEND_ORIGIN };
  process.env['GOOGLE_MAPS_API_KEY'] = '';
  await step('Google Maps sem chave no .env', 'GET', '/config/maps', undefined, 503, undefined, fromFrontend);
  process.env['GOOGLE_MAPS_API_KEY'] = 'chave-de-teste';
  await step<MapsConfig>('configuração do Google Maps', 'GET', '/config/maps', undefined, 200,
    (b) => assert.equal(b.api_key, 'chave-de-teste'), fromFrontend);
  await step('configuração do mapa sem Origin', 'GET', '/config/maps', undefined, 403);
  await step('configuração do mapa de outra origem', 'GET', '/config/maps', undefined, 403, undefined,
    { Origin: 'https://site-qualquer.example' });
  process.env['CORS_ORIGINS'] = 'http://localhost:4200';
  await step('configuração do mapa de origem do CORS_ORIGINS', 'GET', '/config/maps', undefined, 200, undefined,
    { Origin: 'http://localhost:4200' });
  const savedVapid = [process.env['VAPID_PUBLIC_KEY'], process.env['VAPID_PRIVATE_KEY']];
  process.env['VAPID_PUBLIC_KEY'] = '';
  await step('push sem chaves VAPID no .env', 'GET', '/config/push', undefined, 503);
  process.env['VAPID_PUBLIC_KEY'] = 'chave-publica';
  process.env['VAPID_PRIVATE_KEY'] = 'chave-privada';
  await step<PushConfig>('configuração do push', 'GET', '/config/push', undefined, 200,
    (b) => assert.equal(b.public_key, 'chave-publica'));
  if (savedVapid[0] === undefined) delete process.env['VAPID_PUBLIC_KEY'];
  else process.env['VAPID_PUBLIC_KEY'] = savedVapid[0];
  if (savedVapid[1] === undefined) delete process.env['VAPID_PRIVATE_KEY'];
  else process.env['VAPID_PRIVATE_KEY'] = savedVapid[1];
  if (savedKey === undefined) delete process.env['GOOGLE_MAPS_API_KEY'];
  else process.env['GOOGLE_MAPS_API_KEY'] = savedKey;
  if (savedOrigins === undefined) delete process.env['CORS_ORIGINS'];
  else process.env['CORS_ORIGINS'] = savedOrigins;

  const preflight = await fetch(`${baseUrl}/health`, { method: 'OPTIONS', headers: { Origin: FRONTEND_ORIGIN, 'Access-Control-Request-Method': 'GET' } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), FRONTEND_ORIGIN);
  const foreign = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://site-qualquer.example' } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  passed++;
  console.log('  ok  CORS  — só o frontend recebe Access-Control-Allow-Origin');

  const devServer = createApi(undefined, { devMode: true }).app.listen(0);
  await new Promise<void>((resolve) => devServer.once('listening', () => resolve()));
  const devAddress = devServer.address();
  assert.ok(devAddress !== null && typeof devAddress === 'object');
  const devUrl = `http://127.0.0.1:${devAddress.port}/api`;
  const devHealth = await fetch(`${devUrl}/health`, { headers: { Origin: 'https://site-qualquer.example' } });
  assert.equal(devHealth.headers.get('access-control-allow-origin'), '*');
  const devMaps = await fetch(`${devUrl}/config/maps`, { headers: { Origin: 'https://site-qualquer.example' } });
  assert.equal(devMaps.status, 403);
  devServer.close();
  passed++;
  console.log('  ok  CORS  — modo desenvolvimento libera as rotas, mas não a configuração do mapa');

  const root = await fetch(baseUrl.replace(/\/api$/, '/'), { redirect: 'manual' });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/api/docs');
  passed++;
  console.log('  ok  302 GET    /  — raiz redireciona para /api/docs');

  const spec = await fetch(`${baseUrl}/docs/openapi.json`);
  const specBody: unknown = await spec.json();
  assert.equal(spec.status, 200);
  assert.ok(isRecord(specBody) && specBody['openapi'] === '3.0.3' && isRecord(specBody['paths']), 'openapi.json inválido');
  passed++;
  console.log('  ok  200 GET    /docs/openapi.json  — documento OpenAPI');

  const ui = await fetch(`${baseUrl}/docs/`);
  const html = await ui.text();
  assert.equal(ui.status, 200);
  assert.match(html, /swagger-ui/i, 'Swagger UI não foi servido');
  passed++;
  console.log('  ok  200 GET    /docs/  — Swagger UI');
}

interface AdminScenario {
  ana: string; // conta com os dois perfis
  outro: string;
  carla: string;
  farmer: Farmer;
  other: Farmer;
  worker: { id: number };
  worker2: { id: number };
  farmId: number;
}

async function administration({ ana, outro, carla, farmer, other, worker, worker2, farmId }: AdminScenario): Promise<void> {
  console.log('\nAdministração (usuários de sistema)');
  // Sem cadastro público: o primeiro administrador vem do servidor (ADMIN_EMAIL/ADMIN_PASSWORD ou seed).
  assert.equal(await container.useCases.systemUsers.ensureInitialAdmin({ email: 'admin@exemplo.com', password: PW, name: 'Ana Admin' }), 'created');
  assert.equal(await container.useCases.systemUsers.ensureInitialAdmin({ email: 'admin@exemplo.com', password: 'outra-senha', name: 'X' }), 'exists');

  actAs(null);
  await step('login de sistema com senha errada', 'POST', '/auth/system/login', { email: 'admin@exemplo.com', password: 'errada-123' }, 401);
  await step('conta do app não entra como sistema', 'POST', '/auth/system/login', { email: 'ana@exemplo.com', password: PW }, 401);
  await step('usuário de sistema não entra pelo login do app', 'POST', '/auth/login', { email: 'admin@exemplo.com', password: PW }, 401);
  const { token: admin } = await step<SystemLoginResponse>('entrar como administrador', 'POST', '/auth/system/login',
    { email: 'ADMIN@exemplo.com', password: PW }, 200, (b) => assert.equal(b.user.role, 'admin'));

  actAs(ana);
  await step('conta do app na administração', 'GET', '/admin/users', undefined, 403);
  await step('conta do app na sessão de sistema', 'GET', '/auth/system/me', undefined, 403);
  await step('conta do app lista produtores', 'GET', '/farmers', undefined, 403);

  actAs(admin);
  await step<SystemUser>('sessão de sistema', 'GET', '/auth/system/me', undefined, 200, (b) => assert.equal(b.email, 'admin@exemplo.com'));
  await step('administrador não usa o painel do produtor', 'GET', `/farmers/${farmer.id}`, undefined, 403);
  await step<Farmer[]>('lista de produtores (administração)', 'GET', '/farmers', undefined, 200, (b) => assert.ok(b.length >= 2));
  await step('lista de trabalhadores (administração)', 'GET', '/workers', undefined, 200);
  const users = await step<AdminUser[]>('listar contas', 'GET', '/admin/users', undefined, 200, (b) => {
    const both = b.find((u) => u.email === 'ana@exemplo.com');
    assert.equal(both?.farmer?.cpf, '***.982.247-**');
    assert.ok(both.worker);
  });
  const account = (email: string): AdminUser => {
    const found = users.find((u) => u.email === email);
    assert.ok(found, `conta ${email} na lista`);
    return found;
  };
  const both = account('ana@exemplo.com');
  await step<AdminUser>('detalhe da conta (CPF completo)', 'GET', `/admin/users/${both.account_id}`, undefined, 200,
    (b) => assert.equal(b.farmer?.cpf, '52998224725'));
  await step('detalhe de conta inexistente', 'GET', '/admin/users/999', undefined, 404);

  await step<FarmerResponse>('editar produtor', 'PATCH', `/admin/farmers/${farmer.id}`, { name: 'Ana Souza' }, 200,
    (b) => assert.equal(b.farmer.name, 'Ana Souza'));
  await step('editar CPF', 'PATCH', `/admin/farmers/${farmer.id}`, { cpf: '11144477735' }, 400);
  await step('editar para e-mail de outra conta', 'PATCH', `/admin/farmers/${farmer.id}`, { email: 'outro@exemplo.com' }, 409);
  await step<WorkerResponse>('editar trabalhador', 'PATCH', `/admin/workers/${worker.id}`, { phone: '24900001111', bio: null }, 200,
    (b) => assert.equal(b.worker.phone, '24900001111'));
  await step('editar trabalhador inexistente', 'PATCH', '/admin/workers/999', { name: 'X' }, 404);

  // Foto imprópria: o administrador remove a foto de perfil de qualquer usuário.
  const photo = new Uint8Array(await sharp({ create: { width: 200, height: 200, channels: 3, background: '#c0392b' } }).png().toBuffer());
  actAs(ana);
  const { farmer: withPhoto } = await upload<FarmerResponse>('produtor envia foto', `/farmers/${farmer.id}/photo`, photo, 'image/png', 200);
  actAs(carla);
  const { worker: workerWithPhoto } = await upload<WorkerResponse>('trabalhador envia foto', `/workers/${worker2.id}/photo`, photo, 'image/png', 200);
  actAs(ana);
  await step('conta do app não remove foto pela administração', 'DELETE', `/admin/workers/${worker2.id}/photo`, undefined, 403);
  actAs(admin);
  await step<FarmerResponse>('remover foto do produtor', 'DELETE', `/admin/farmers/${farmer.id}/photo`, undefined, 200,
    (b) => assert.equal(b.farmer.photo_url, null));
  await download('foto do produtor não é mais servida', withPhoto.photo_url ?? '', 404);
  await step<WorkerResponse>('remover foto do trabalhador', 'DELETE', `/admin/workers/${worker2.id}/photo`, undefined, 200,
    (b) => assert.equal(b.worker.photo_url, null));
  await download('foto do trabalhador não é mais servida', workerWithPhoto.photo_url ?? '', 404);
  await step('remover foto de quem não tem foto', 'DELETE', `/admin/farmers/${farmer.id}/photo`, undefined, 200);
  await step('foto de trabalhador inexistente', 'DELETE', '/admin/workers/999/photo', undefined, 404);

  // Serviço em andamento bloqueia a remoção (de um perfil e da conta inteira).
  actAs(ana);
  const { service: busy } = await step<ServiceResponse>('serviço em andamento para a administração', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farmId, name: 'Adubação', category: 'Outros', duration: 4, price: 200 }, 201);
  actAs(carla);
  const { application: busyApp } = await step<ApplicationResponse>('candidata ao serviço', 'POST', `/workers/services/${busy.id}/apply`, { worker_id: worker2.id }, 201);
  actAs(ana);
  await step('aceita a candidata', 'PATCH', `/farmers/services/${busy.id}/analyze`, { application_id: busyApp.id, action: 'Accept' }, 200);
  actAs(admin);
  const carlaAccount = account('carla@exemplo.com');
  await step('remover conta com serviço em andamento', 'DELETE', `/admin/users/${carlaAccount.account_id}`, undefined, 409);
  await step('remover perfil com serviço em andamento', 'DELETE', `/admin/workers/${worker2.id}`, undefined, 409);
  await step<AdminUser>('nada foi removido', 'GET', `/admin/users/${carlaAccount.account_id}`, undefined, 200, (b) => assert.ok(b.worker));

  const bothWorker = both.worker;
  assert.ok(bothWorker);
  await step('remover perfil de trabalhador', 'DELETE', `/admin/workers/${bothWorker.id}`, undefined, 200);
  await step<AdminUser>('a conta fica com o produtor', 'GET', `/admin/users/${both.account_id}`, undefined, 200, (b) => {
    assert.equal(b.worker, null);
    assert.equal(b.farmer?.id, farmer.id);
  });
  await step('remover perfil inexistente', 'DELETE', `/admin/workers/${bothWorker.id}`, undefined, 404);
  actAs(ana);
  await step<SessionUser>('a sessão da conta perde o perfil', 'GET', `/accounts/${both.account_id}`, undefined, 200,
    (b) => assert.deepEqual([b.role, b.profiles.worker], ['farmer', null]));

  actAs(admin);
  const outroAccount = account('outro@exemplo.com');
  await step('remover conta', 'DELETE', `/admin/users/${outroAccount.account_id}`, undefined, 200);
  await step('conta removida', 'GET', `/admin/users/${outroAccount.account_id}`, undefined, 404);
  await step('remover conta de novo', 'DELETE', `/admin/users/${outroAccount.account_id}`, undefined, 404);
  await step('o produtor saiu junto', 'DELETE', `/admin/farmers/${other.id}`, undefined, 404);
  actAs(outro);
  await step('sessão da conta removida cai', 'GET', `/farmers/${other.id}`, undefined, 401);

  console.log('\nEquipe');
  actAs(admin);
  await step<SystemUserResponse>('cadastrar tutor', 'POST', '/admin/system-users',
    { email: 'Tutor@Exemplo.com', name: ' Tiago Tutor ', role: 'tutor', password: PW }, 201,
    (b) => assert.deepEqual([b.system_user.email, b.system_user.name, b.system_user.role], ['tutor@exemplo.com', 'Tiago Tutor', 'tutor']));
  await step('e-mail repetido na equipe', 'POST', '/admin/system-users', { email: 'tutor@exemplo.com', name: 'X', role: 'admin', password: PW }, 409);
  await step('cargo inválido', 'POST', '/admin/system-users', { email: 'x@exemplo.com', name: 'X', role: 'gerente', password: PW }, 400);
  await step('senha curta', 'POST', '/admin/system-users', { email: 'x@exemplo.com', name: 'X', role: 'admin', password: '123' }, 400);
  await step('sem nome', 'POST', '/admin/system-users', { email: 'x@exemplo.com', role: 'admin', password: PW }, 400);
  await step<SystemUser[]>('listar equipe (sem senha)', 'GET', '/admin/system-users', undefined, 200,
    (b) => assert.deepEqual(b.map((u) => u.role), ['admin', 'tutor']));

  const { token: tutor } = await step<SystemLoginResponse>('tutor entra', 'POST', '/auth/system/login', { email: 'tutor@exemplo.com', password: PW }, 200);
  actAs(tutor);
  await step<SystemUser>('sessão do tutor', 'GET', '/auth/system/me', undefined, 200, (b) => assert.equal(b.role, 'tutor'));
  await step('tutor não gerencia contas', 'GET', '/admin/users', undefined, 403);
  await step('tutor não cadastra equipe', 'POST', '/admin/system-users', { email: 'y@exemplo.com', name: 'Y', role: 'admin', password: PW }, 403);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const address = server.address(); // string só para sockets/pipes; aqui é sempre TCP
  if (address === null || typeof address === 'string') throw new Error('O servidor de teste não informou a porta.');
  baseUrl = `http://localhost:${address.port}/api`;
  try {
    await run();
    console.log(`\n${passed} verificações passaram.`);
  } catch (error: unknown) {
    console.error(`\nFALHOU: ${errorMessage(error)}`);
    process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

const server = app.listen(0, () => {
  void main();
});
