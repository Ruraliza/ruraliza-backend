// Smoke test do fluxo completo da API (em memória).
// Sobe o app numa porta livre, sem o seed, e percorre:
// produtor → fazenda → serviço → trabalhador → candidatura → aceite → pagamento,
// além dos principais casos 400/404/409.
// Uso: npm run smoke
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApi } from '../app';
import type {
  ApplicationResponse,
  ApplicationWithService,
  ApplicationWithWorker,
  Farm,
  FarmResponse,
  Farmer,
  FarmerResponse,
  FarmerServiceItem,
  MapsConfig,
  OpenService,
  PaymentResponse,
  ServiceResponse,
  ServiceWithFarm,
  WorkerResponse
} from '../src/contracts';
import { FRONTEND_ORIGIN } from '../src/config';
import { isRecord } from '../src/http/body';
import { createOpenApiChecker } from './openapi-check';

// API nova, sem seed, só para este teste.
const { app, document } = createApi();
const checkAgainstOpenApi = createOpenApiChecker(document);

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface CallResult {
  status: number;
  body: unknown;
}

let baseUrl = '';
let passed = 0;

async function call(
  method: Method,
  path: string,
  body?: unknown,
  rawBody?: string,
  headers: Record<string, string> = {}
): Promise<CallResult> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
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

// Envia um arquivo como corpo (Content-Type image/*) e confere a resposta contra o OpenAPI.
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
    headers: { 'Content-Type': contentType },
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

// Dia de hoje/amanhã/ontem no horário de Brasília (AAAA-MM-DD).
function brDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function run(): Promise<void> {
  console.log('\nFluxo principal');
  await step<string[]>('categorias', 'GET', '/categories', undefined, 200, (b) => assert.equal(b.length, 7));

  const { farmer } = await step<FarmerResponse>('cadastrar produtor', 'POST', '/farmers',
    { name: 'Ana Produtora', email: 'Ana@Exemplo.com', phone: '24999990000', cpf: '52998224725' }, 201,
    (b) => assert.equal(b.farmer.email, 'ana@exemplo.com'));

  const { farm } = await step<FarmResponse>('cadastrar fazenda', 'POST', `/farmers/${farmer.id}/farms`,
    { address: 'Estrada Velha, Km 3', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 }, 201,
    (b) => assert.deepEqual([b.farm.latitude, b.farm.longitude], [-22.1165, -43.2092]));

  const { service } = await step<ServiceResponse>('publicar serviço', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Colheita de café', category: 'Colheita', duration: 16, price: 900 }, 201,
    (b) => assert.equal(b.service.status, 'Pending'));

  // Mesmo CPF do produtor: permitido, pois a unicidade é por tipo de perfil.
  const { worker } = await step<WorkerResponse>('cadastrar trabalhador', 'POST', '/workers',
    { name: 'Bruno Tratorista', email: 'bruno@exemplo.com', phone: '24988880000', cpf: '52998224725' }, 201);
  const { worker: worker2 } = await step<WorkerResponse>('cadastrar 2º trabalhador', 'POST', '/workers',
    { name: 'Carla Diarista', email: 'carla@exemplo.com', phone: '24977770000', cpf: '12345678909' }, 201);

  await step<OpenService[]>('vagas com cidade/UF', 'GET', '/workers/services?category=Colheita', undefined, 200,
    (b) => assert.deepEqual(b[0]?.farm, { city: 'Três Rios', state: 'RJ', photos: [] }));
  await step<OpenService>('detalhe da vaga sem o ponto no mapa', 'GET', `/workers/services/${service.id}?worker_id=${worker.id}`, undefined, 200,
    (b) => assert.equal(b.farm.latitude, undefined));

  const { application } = await step<ApplicationResponse>('candidatar-se', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker.id }, 201,
    (b) => assert.equal(b.application.status, 'Pending'));
  const { application: application2 } = await step<ApplicationResponse>('2ª candidatura', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker2.id }, 201);

  await step<ApplicationWithWorker[]>('listar candidaturas (CPF mascarado)', 'GET', `/farmers/services/${service.id}/applications`, undefined, 200, (b) => {
    assert.equal(b.length, 2);
    assert.equal(b[0]?.worker.cpf, '***.982.247-**');
  });
  await step<FarmerServiceItem[]>('serviços do produtor com pendentes', 'GET', `/farmers/${farmer.id}/services`, undefined, 200,
    (b) => assert.equal(b[0]?.applications_pending, 2));

  await step<ApplicationResponse & ServiceResponse>('aceitar trabalhador', 'PATCH', `/farmers/services/${service.id}/analyze`, { application_id: application.id, action: 'Accept' }, 200, (b) => {
    assert.equal(b.service.status, 'In Progress');
    assert.equal(b.service.worker_id, worker.id);
  });
  await step<ApplicationWithService[]>('outra candidatura foi recusada', 'GET', `/workers/${worker2.id}/applications`, undefined, 200,
    (b) => assert.equal(b[0]?.status, 'Rejected'));
  await step<OpenService[]>('serviços do trabalhador com o ponto no mapa', 'GET', `/workers/${worker.id}/services`, undefined, 200, (b) => {
    assert.equal(b[0]?.id, service.id);
    assert.deepEqual([b[0].farm.latitude, b[0].farm.longitude], [-22.1165, -43.2092]);
  });
  await step<OpenService>('aceito vê o ponto no detalhe', 'GET', `/workers/services/${service.id}?worker_id=${worker.id}`, undefined, 200,
    (b) => assert.equal(b.farm.latitude, -22.1165));
  await step<OpenService>('outro trabalhador não vê o ponto', 'GET', `/workers/services/${service.id}?worker_id=${worker2.id}`, undefined, 200,
    (b) => assert.equal(b.farm.latitude, undefined));
  await step('worker_id inválido no detalhe', 'GET', `/workers/services/${service.id}?worker_id=abc`, undefined, 400);

  await step<PaymentResponse>('liberar pagamento', 'POST', `/farmers/services/${service.id}/payment`, undefined, 200, (b) => {
    assert.equal(b.service.status, 'Completed');
    assert.equal(b.payment.value, 900);
    assert.equal(b.service.payment_id, b.payment.id);
  });
  await step<FarmerServiceItem[]>('filtrar concluídos', 'GET', `/farmers/${farmer.id}/services?status=Completed`, undefined, 200,
    (b) => assert.equal(b.length, 1));

  console.log('\nCasos de erro');
  await step('CPF inválido', 'POST', '/farmers', { name: 'X', email: 'x@exemplo.com', phone: '1', cpf: '12345678900' }, 400);
  await step('e-mail inválido', 'POST', '/workers', { name: 'X', email: 'x@', phone: '1', cpf: '11144477735' }, 400);
  await step('campo faltando', 'POST', '/farmers', { name: 'X', email: 'x@exemplo.com' }, 400);
  await step('e-mail duplicado', 'POST', '/farmers', { name: 'X', email: 'ana@exemplo.com', phone: '1', cpf: '11144477735' }, 409);
  await step('CPF duplicado', 'POST', '/farmers', { name: 'X', email: 'novo@exemplo.com', phone: '1', cpf: '52998224725' }, 409);
  await step('fazenda de produtor inexistente', 'POST', '/farmers/999/farms', { address: 'a', city: 'b', state: 'MG', latitude: -22.1165, longitude: -43.2092 }, 404);

  await step('fazenda sem o ponto no mapa', 'POST', `/farmers/${farmer.id}/farms`, { address: 'a', city: 'b', state: 'MG' }, 400);
  await step('latitude fora da faixa', 'POST', `/farmers/${farmer.id}/farms`, { address: 'a', city: 'b', state: 'MG', latitude: 91, longitude: 0 }, 400);
  await step('longitude como texto', 'POST', `/farmers/${farmer.id}/farms`, { address: 'a', city: 'b', state: 'MG', latitude: 0, longitude: '-43' }, 400);

  const { farmer: other } = await step<FarmerResponse>('cadastrar outro produtor', 'POST', '/farmers',
    { name: 'Outro', email: 'outro@exemplo.com', phone: '1', cpf: '11144477735' }, 201);
  await step('fazenda de outro produtor', 'POST', '/farmers/services',
    { farmer_id: other.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1 }, 400);
  await step('valor zero', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 0 }, 400);
  await step('produtor inexistente', 'POST', '/farmers/services',
    { farmer_id: 999, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1 }, 404);
  await step('serviço sem campos', 'POST', '/farmers/services', { farmer_id: farmer.id }, 400);

  const { service: open } = await step<ServiceResponse>('publicar 2º serviço', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Plantio', category: 'Plantio', duration: 8, price: 300 }, 201);
  await step('candidatar em serviço inexistente', 'POST', '/workers/services/999/apply', { worker_id: worker.id }, 404);
  await step('trabalhador inexistente', 'POST', `/workers/services/${open.id}/apply`, { worker_id: 999 }, 404);
  const { application: openApp } = await step<ApplicationResponse>('candidatar no 2º serviço', 'POST', `/workers/services/${open.id}/apply`, { worker_id: worker2.id }, 201);
  await step('candidatura duplicada', 'POST', `/workers/services/${open.id}/apply`, { worker_id: worker2.id }, 409);
  await step('candidatar em serviço concluído', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker2.id }, 409);

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

  console.log('\nEdição e remoção');
  const { farmer: fd } = await step<FarmerResponse>('produtor a remover', 'POST', '/farmers',
    { name: 'Dora', email: 'dora@exemplo.com', phone: '1', cpf: '39053344705' }, 201);
  const { farm: fdFarm } = await step<FarmResponse>('fazenda a remover', 'POST', `/farmers/${fd.id}/farms`,
    { address: 'Sítio', city: 'Vassouras', state: 'RJ', latitude: -22.1165, longitude: -43.2092 }, 201);
  await step<Farmer>('farms guarda os IDs', 'GET', `/farmers/${fd.id}`, undefined, 200, (b) => assert.deepEqual(b.farms, [fdFarm.id]));
  await step<FarmerResponse>('editar produtor', 'PATCH', `/farmers/${fd.id}`, { name: 'Dora Lima' }, 200, (b) => assert.equal(b.farmer.name, 'Dora Lima'));
  await step('editar cpf', 'PATCH', `/farmers/${fd.id}`, { cpf: '11144477735' }, 400);
  await step('editar para e-mail em uso', 'PATCH', `/farmers/${fd.id}`, { email: 'ana@exemplo.com' }, 409);

  const { service: fdService } = await step<ServiceResponse>('serviço a remover', 'POST', '/farmers/services',
    { farmer_id: fd.id, farm_id: fdFarm.id, name: 'Roçada', category: 'Outros', duration: 4, price: 200 }, 201);
  const { worker: wd } = await step<WorkerResponse>('trabalhador a remover', 'POST', '/workers',
    { name: 'Eli', email: 'eli@exemplo.com', phone: '1', cpf: '93541134780' }, 201);
  const { application: wdApp } = await step<ApplicationResponse>('candidatura a remover', 'POST', `/workers/services/${fdService.id}/apply`, { worker_id: wd.id }, 201);
  await step('aceitar para ficar em andamento', 'PATCH', `/farmers/services/${fdService.id}/analyze`, { application_id: wdApp.id, action: 'Accept' }, 200);
  await step('remover produtor com serviço em andamento', 'DELETE', `/farmers/${fd.id}`, undefined, 409);
  await step('remover trabalhador com serviço em andamento', 'DELETE', `/workers/${wd.id}`, undefined, 409);
  await step('pagar para concluir', 'POST', `/farmers/services/${fdService.id}/payment`, undefined, 200);

  await step('remover trabalhador', 'DELETE', `/workers/${wd.id}`, undefined, 200);
  await step<ApplicationWithWorker[]>('candidaturas do removido somem', 'GET', `/farmers/services/${fdService.id}/applications`, undefined, 200,
    (b) => assert.equal(b.length, 0));
  await step('remover produtor', 'DELETE', `/farmers/${fd.id}`, undefined, 200);
  await step('produtor removido', 'GET', `/farmers/${fd.id}`, undefined, 404);
  await step('serviço removido junto', 'GET', `/farmers/services/${fdService.id}`, undefined, 404);
  await step('remover inexistente', 'DELETE', `/workers/${wd.id}`, undefined, 404);

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
  const { farm: otherFarm } = await step<FarmResponse>('fazenda de outro produtor', 'POST', `/farmers/${other.id}/farms`, { address: 'a', city: 'b', state: 'MG', latitude: -22.1165, longitude: -43.2092 }, 201);
  await step('editar para fazenda de outro', 'PATCH', `/farmers/services/${editable.id}`, { farm_id: otherFarm.id }, 400);
  await step('editar para fazenda inexistente', 'PATCH', `/farmers/services/${editable.id}`, { farm_id: 999 }, 404);
  await step('editar serviço concluído', 'PATCH', `/farmers/services/${service.id}`, { name: 'X' }, 409);
  await step('editar serviço inexistente', 'PATCH', '/farmers/services/999', { name: 'X' }, 404);

  const { application: editableApp } = await step<ApplicationResponse>('candidatura no serviço a cancelar', 'POST', `/workers/services/${editable.id}/apply`, { worker_id: worker2.id }, 201);
  await step<ServiceResponse>('cancelar serviço', 'PATCH', `/farmers/services/${editable.id}/cancel`, undefined, 200,
    (b) => assert.equal(b.service.status, 'Cancelled'));
  await step<ApplicationWithWorker[]>('candidatura pendente foi recusada', 'GET', `/farmers/services/${editable.id}/applications`, undefined, 200,
    (b) => assert.equal(b.find((a) => a.id === editableApp.id)?.status, 'Rejected'));
  await step<OpenService[]>('cancelado some das vagas', 'GET', '/workers/services', undefined, 200,
    (b) => assert.ok(!b.some((s) => s.id === editable.id)));
  await step('cancelar de novo', 'PATCH', `/farmers/services/${editable.id}/cancel`, undefined, 409);
  await step('editar cancelado', 'PATCH', `/farmers/services/${editable.id}`, { name: 'X' }, 409);

  console.log('\nDesistência do trabalhador');
  const { service: ws } = await step<ServiceResponse>('serviço para desistência', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Capina', category: 'Manutenção', duration: 5, price: 150 }, 201);
  const { worker: worker3 } = await step<WorkerResponse>('cadastrar 3º trabalhador', 'POST', '/workers',
    { name: 'Davi', email: 'davi@exemplo.com', phone: '1', cpf: '71428793860' }, 201);
  await step('candidatar para desistir', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker.id }, 201);
  await step<ServiceResponse>('desistir da candidatura', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker.id }, 200,
    (b) => assert.equal(b.service.status, 'Pending'));
  await step<ApplicationWithWorker[]>('candidatura removida', 'GET', `/farmers/services/${ws.id}/applications`, undefined, 200, (b) => assert.equal(b.length, 0));
  const { application: wa1 } = await step<ApplicationResponse>('candidatar de novo', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker.id }, 201);
  const { application: wa2 } = await step<ApplicationResponse>('2º candidato', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker2.id }, 201);
  const { application: wa3 } = await step<ApplicationResponse>('3º candidato', 'POST', `/workers/services/${ws.id}/apply`, { worker_id: worker3.id }, 201);
  await step('produtor recusa o 3º', 'PATCH', `/farmers/services/${ws.id}/analyze`, { application_id: wa3.id, action: 'Reject' }, 200);
  await step('produtor aceita o 1º', 'PATCH', `/farmers/services/${ws.id}/analyze`, { application_id: wa1.id, action: 'Accept' }, 200);
  await step<ServiceResponse>('desistir do serviço aceito', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker.id }, 200, (b) => {
    assert.equal(b.service.status, 'Pending');
    assert.equal(b.service.worker_id, null);
  });
  await step<ApplicationWithWorker[]>('volta à etapa anterior', 'GET', `/farmers/services/${ws.id}/applications`, undefined, 200, (b) => {
    assert.equal(b.length, 2);
    assert.equal(b.find((a) => a.id === wa2.id)?.status, 'Pending'); // recusada pelo aceite: volta
    assert.equal(b.find((a) => a.id === wa3.id)?.status, 'Rejected'); // recusada pelo produtor: continua
  });
  await step<OpenService[]>('vaga reaberta', 'GET', '/workers/services', undefined, 200, (b) => assert.ok(b.some((s) => s.id === ws.id)));
  await step('desistir sem candidatura', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker.id }, 404);
  await step('desistir de candidatura recusada', 'PATCH', `/workers/services/${ws.id}/withdraw`, { worker_id: worker3.id }, 409);
  await step('desistir de serviço concluído', 'PATCH', `/workers/services/${service.id}/withdraw`, { worker_id: worker.id }, 409);
  await step('desistir sem worker_id', 'PATCH', `/workers/services/${ws.id}/withdraw`, {}, 400);

  console.log('\nEdição e remoção de fazenda');
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
  // Foto de celular simulada: 2400x1600 JPEG. Tem que voltar WebP com no máximo 1000px.
  const bigPhoto = new Uint8Array(await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3a7d24' } }).jpeg().toBuffer());
  const smallPhoto = new Uint8Array(await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ee8a14' } }).png().toBuffer());

  const { worker: wPhoto } = await upload<WorkerResponse>('foto de perfil do trabalhador', `/workers/${worker.id}/photo`, bigPhoto, 'image/jpeg', 200,
    (b) => assert.match(b.worker.photo_url ?? '', /^\/api\/images\/.+\.webp$/));
  const firstUrl = wPhoto.photo_url ?? '';
  const size = await download('foto reduzida e em WebP', firstUrl);
  assert.deepEqual(size, { width: 1000, height: 667, format: 'webp' });
  await upload<WorkerResponse>('trocar a foto', `/workers/${worker.id}/photo`, smallPhoto, 'image/png', 200,
    (b) => assert.notEqual(b.worker.photo_url, firstUrl));
  await download('foto antiga apagada', firstUrl, 404);
  await upload('arquivo que não é imagem', `/workers/${worker.id}/photo`, new TextEncoder().encode('não sou uma foto'), 'image/jpeg', 400);
  await upload('sem Content-Type de imagem', `/workers/${worker.id}/photo`, bigPhoto, 'application/octet-stream', 400);
  await upload('foto maior que 10 MB', `/workers/${worker.id}/photo`, new Uint8Array(11 * 1024 * 1024), 'image/jpeg', 413);
  await upload('foto de trabalhador inexistente', '/workers/999/photo', smallPhoto, 'image/png', 404);
  await step<WorkerResponse>('remover foto do trabalhador', 'DELETE', `/workers/${worker.id}/photo`, undefined, 200, (b) => assert.equal(b.worker.photo_url, null));

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
  await step<OpenService[]>('vaga com validade hoje aparece', 'GET', '/workers/services?q=rocada', undefined, 200,
    (b) => assert.ok(b.some((j) => j.id === described.id)));
  await step<ServiceResponse>('remover prazo e descrição', 'PATCH', `/farmers/services/${described.id}`, { expires_at: null, description: '' }, 200, (b) => {
    assert.equal(b.service.expires_at, null);
    assert.equal(b.service.description, null);
  });
  await step<OpenService>('vaga mostra fotos da fazenda', 'GET', `/workers/services/${described.id}`, undefined, 200,
    (b) => assert.equal(b.farm.photos.length, 5));
  // Não existe exclusão de serviço: o caminho é cancelar (PATCH /cancel), que mantém o histórico.
  await step('rota de exclusão de serviço não existe', 'DELETE', `/farmers/services/${described.id}`, undefined, 404);

  console.log('\nFiltros de vagas');
  const post = (name: string, description: string, category: string, duration: number, price: number): Promise<ServiceResponse> =>
    step<ServiceResponse>(`publicar "${name}"`, 'POST', '/farmers/services', { farmer_id: farmer.id, farm_id: farm.id, name, description, category, duration, price }, 201);
  const cafe = (await post('Colheita de Café', 'Café arábica em terreno inclinado', 'Colheita', 30, 1500)).service;
  const ordenha = (await post('Ordenha', 'Ordenha mecânica às 5h', 'Manejo de gado', 6, 300)).service;
  const trator = (await post('Gradear área', 'Trator próprio da fazenda, precisa de CNH', 'Operação de máquinas', 16, 900)).service;
  const ids = (b: OpenService[]): number[] => b.map((j) => j.id);

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

  console.log('\nDocumentação');
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
