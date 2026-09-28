// Smoke test do fluxo completo da API (em memória).
// Sobe o app numa porta livre, sem o seed, e percorre:
// produtor → fazenda → serviço → trabalhador → candidatura → aceite → pagamento,
// além dos principais casos 400/404/409.
// Uso: npm run smoke
import assert from 'node:assert/strict';
import app from '../app';
import type {
  ApplicationResponse,
  ApplicationWithService,
  ApplicationWithWorker,
  Farm,
  FarmResponse,
  Farmer,
  FarmerResponse,
  FarmerServiceItem,
  OpenService,
  PaymentResponse,
  ServiceResponse,
  ServiceWithFarm,
  WorkerResponse
} from '../src/contracts';
import { isRecord } from '../src/http/body';
import { checkAgainstOpenApi } from './openapi-check';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface CallResult {
  status: number;
  body: unknown;
}

let baseUrl = '';
let passed = 0;

async function call(method: Method, path: string, body?: unknown, rawBody?: string): Promise<CallResult> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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
  check?: (body: T) => void
): Promise<T> {
  const res = await call(method, path, body);
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

async function run(): Promise<void> {
  console.log('\nFluxo principal');
  await step<string[]>('categorias', 'GET', '/categories', undefined, 200, (b) => assert.equal(b.length, 7));

  const { farmer } = await step<FarmerResponse>('cadastrar produtor', 'POST', '/farmers',
    { name: 'Ana Produtora', email: 'Ana@Exemplo.com', phone: '24999990000', cpf: '52998224725' }, 201,
    (b) => assert.equal(b.farmer.email, 'ana@exemplo.com'));

  const { farm } = await step<FarmResponse>('cadastrar fazenda', 'POST', `/farmers/${farmer.id}/farms`,
    { address: 'Estrada Velha, Km 3', city: 'Três Rios', state: 'RJ' }, 201);

  const { service } = await step<ServiceResponse>('publicar serviço', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Colheita de café', category: 'Colheita', duration: 16, price: 900 }, 201,
    (b) => assert.equal(b.service.status, 'Pending'));

  // Mesmo CPF do produtor: permitido, pois a unicidade é por tipo de perfil.
  const { worker } = await step<WorkerResponse>('cadastrar trabalhador', 'POST', '/workers',
    { name: 'Bruno Tratorista', email: 'bruno@exemplo.com', phone: '24988880000', cpf: '52998224725' }, 201);
  const { worker: worker2 } = await step<WorkerResponse>('cadastrar 2º trabalhador', 'POST', '/workers',
    { name: 'Carla Diarista', email: 'carla@exemplo.com', phone: '24977770000', cpf: '12345678909' }, 201);

  await step<OpenService[]>('vagas com cidade/UF', 'GET', '/workers/services?category=Colheita', undefined, 200,
    (b) => assert.deepEqual(b[0]?.farm, { city: 'Três Rios', state: 'RJ' }));
  await step('detalhe da vaga', 'GET', `/workers/services/${service.id}`, undefined, 200);

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
  await step<OpenService[]>('serviços do trabalhador', 'GET', `/workers/${worker.id}/services`, undefined, 200,
    (b) => assert.equal(b[0]?.id, service.id));

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
  await step('fazenda de produtor inexistente', 'POST', '/farmers/999/farms', { address: 'a', city: 'b', state: 'MG' }, 404);

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
    { address: 'Sítio', city: 'Vassouras', state: 'RJ' }, 201);
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
  const { farm: otherFarm } = await step<FarmResponse>('fazenda de outro produtor', 'POST', `/farmers/${other.id}/farms`, { address: 'a', city: 'b', state: 'MG' }, 201);
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
  const { farm: f2 } = await step<FarmResponse>('2ª fazenda', 'POST', `/farmers/${farmer.id}/farms`, { address: 'Sítio Novo', city: 'Paty', state: 'RJ' }, 201);
  await step<FarmResponse>('editar fazenda', 'PATCH', `/farmers/${farmer.id}/farms/${f2.id}`, { address: 'Sítio Novo, Km 5', city: '  Paty do Alferes ' }, 200, (b) => {
    assert.equal(b.farm.address, 'Sítio Novo, Km 5');
    assert.equal(b.farm.city, 'Paty do Alferes');
    assert.equal(b.farm.state, 'RJ');
  });
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

  const invalidJson = await call('POST', '/farmers', undefined, '{ invalido');
  assert.equal(invalidJson.status, 400);
  assert.equal(checkAgainstOpenApi('POST', '/api/farmers', invalidJson.status, invalidJson.body), null);
  passed++;
  console.log('  ok  400 POST   /farmers  — JSON inválido');

  console.log('\nDocumentação');
  await step('health check', 'GET', '/health', undefined, 200);

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
