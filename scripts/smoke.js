// Smoke test do fluxo completo da API (em memória).
// Sobe o app numa porta livre, sem o seed, e percorre:
// produtor → fazenda → serviço → trabalhador → candidatura → aceite → pagamento,
// além dos principais casos 400/404/409.
// Uso: npm run smoke
const assert = require('node:assert/strict');
const app = require('../app');

let baseUrl;
let passed = 0;

async function call(method, path, body, rawBody) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  return { status: res.status, body: await res.json() };
}

async function step(title, method, path, body, expectedStatus, check) {
  const res = await call(method, path, body);
  assert.equal(res.status, expectedStatus, `${title}: esperado ${expectedStatus}, veio ${res.status} ${JSON.stringify(res.body)}`);
  if (expectedStatus >= 400) {
    assert.equal(typeof res.body.error, 'string', `${title}: resposta de erro sem { error }`);
  }
  if (check) check(res.body);
  passed++;
  console.log(`  ok  ${String(res.status).padEnd(3)} ${method.padEnd(5)} ${path}  — ${title}`);
  return res.body;
}

async function run() {
  console.log('\nFluxo principal');
  await step('categorias', 'GET', '/categories', undefined, 200, (b) => assert.equal(b.length, 7));

  const { farmer } = await step('cadastrar produtor', 'POST', '/farmers',
    { name: 'Ana Produtora', email: 'Ana@Exemplo.com', phone: '24999990000', cpf: '52998224725' }, 201,
    (b) => assert.equal(b.farmer.email, 'ana@exemplo.com'));

  const { farm } = await step('cadastrar fazenda', 'POST', `/farmers/${farmer.id}/farms`,
    { address: 'Estrada Velha, Km 3', city: 'Três Rios', state: 'RJ' }, 201);

  const { service } = await step('publicar serviço', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Colheita de café', category: 'Colheita', duration: 16, price: 900 }, 201,
    (b) => assert.equal(b.service.status, 'Pending'));

  // Mesmo CPF do produtor: permitido, pois a unicidade é por tipo de perfil.
  const { worker } = await step('cadastrar trabalhador', 'POST', '/workers',
    { name: 'Bruno Tratorista', email: 'bruno@exemplo.com', phone: '24988880000', cpf: '52998224725' }, 201);
  const { worker: worker2 } = await step('cadastrar 2º trabalhador', 'POST', '/workers',
    { name: 'Carla Diarista', email: 'carla@exemplo.com', phone: '24977770000', cpf: '12345678909' }, 201);

  await step('vagas com cidade/UF', 'GET', '/workers/services?category=Colheita', undefined, 200,
    (b) => assert.deepEqual(b[0].farm, { city: 'Três Rios', state: 'RJ' }));
  await step('detalhe da vaga', 'GET', `/workers/services/${service.id}`, undefined, 200);

  const { application } = await step('candidatar-se', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker.id }, 201,
    (b) => assert.equal(b.application.status, 'Pending'));
  const { application: application2 } = await step('2ª candidatura', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker2.id }, 201);

  await step('listar candidaturas (CPF mascarado)', 'GET', `/farmers/services/${service.id}/applications`, undefined, 200, (b) => {
    assert.equal(b.length, 2);
    assert.equal(b[0].worker.cpf, '***.982.247-**');
  });
  await step('serviços do produtor com pendentes', 'GET', `/farmers/${farmer.id}/services`, undefined, 200,
    (b) => assert.equal(b[0].applications_pending, 2));

  await step('aceitar trabalhador', 'PATCH', `/farmers/services/${service.id}/analyze`, { application_id: application.id, action: 'Accept' }, 200, (b) => {
    assert.equal(b.service.status, 'In Progress');
    assert.equal(b.service.worker_id, worker.id);
  });
  await step('outra candidatura foi recusada', 'GET', `/workers/${worker2.id}/applications`, undefined, 200,
    (b) => assert.equal(b[0].status, 'Rejected'));
  await step('serviços do trabalhador', 'GET', `/workers/${worker.id}/services`, undefined, 200,
    (b) => assert.equal(b[0].id, service.id));

  await step('liberar pagamento', 'POST', `/farmers/services/${service.id}/payment`, undefined, 200, (b) => {
    assert.equal(b.service.status, 'Completed');
    assert.equal(b.payment.value, 900);
    assert.equal(b.service.payment_id, b.payment.id);
  });
  await step('filtrar concluídos', 'GET', `/farmers/${farmer.id}/services?status=Completed`, undefined, 200,
    (b) => assert.equal(b.length, 1));

  console.log('\nCasos de erro');
  await step('CPF inválido', 'POST', '/farmers', { name: 'X', email: 'x@exemplo.com', phone: '1', cpf: '12345678900' }, 400);
  await step('e-mail inválido', 'POST', '/workers', { name: 'X', email: 'x@', phone: '1', cpf: '11144477735' }, 400);
  await step('campo faltando', 'POST', '/farmers', { name: 'X', email: 'x@exemplo.com' }, 400);
  await step('e-mail duplicado', 'POST', '/farmers', { name: 'X', email: 'ana@exemplo.com', phone: '1', cpf: '11144477735' }, 409);
  await step('CPF duplicado', 'POST', '/farmers', { name: 'X', email: 'novo@exemplo.com', phone: '1', cpf: '52998224725' }, 409);
  await step('fazenda de produtor inexistente', 'POST', '/farmers/999/farms', { address: 'a', city: 'b', state: 'MG' }, 404);

  const { farmer: other } = await step('cadastrar outro produtor', 'POST', '/farmers',
    { name: 'Outro', email: 'outro@exemplo.com', phone: '1', cpf: '11144477735' }, 201);
  await step('fazenda de outro produtor', 'POST', '/farmers/services',
    { farmer_id: other.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1 }, 400);
  await step('valor zero', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 0 }, 400);
  await step('produtor inexistente', 'POST', '/farmers/services',
    { farmer_id: 999, farm_id: farm.id, name: 'X', category: 'Outros', duration: 1, price: 1 }, 404);
  await step('serviço sem campos', 'POST', '/farmers/services', { farmer_id: farmer.id }, 400);

  const { service: open } = await step('publicar 2º serviço', 'POST', '/farmers/services',
    { farmer_id: farmer.id, farm_id: farm.id, name: 'Plantio', category: 'Plantio', duration: 8, price: 300 }, 201);
  await step('candidatar em serviço inexistente', 'POST', '/workers/services/999/apply', { worker_id: worker.id }, 404);
  await step('trabalhador inexistente', 'POST', `/workers/services/${open.id}/apply`, { worker_id: 999 }, 404);
  const { application: openApp } = await step('candidatar no 2º serviço', 'POST', `/workers/services/${open.id}/apply`, { worker_id: worker2.id }, 201);
  await step('candidatura duplicada', 'POST', `/workers/services/${open.id}/apply`, { worker_id: worker2.id }, 409);
  await step('candidatar em serviço concluído', 'POST', `/workers/services/${service.id}/apply`, { worker_id: worker2.id }, 409);

  await step('ação inválida', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: openApp.id, action: 'Maybe' }, 400);
  await step('candidatura inexistente', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: 999, action: 'Accept' }, 404);
  await step('candidatura de outro serviço', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: application2.id, action: 'Accept' }, 400);
  await step('analisar serviço já em andamento/concluído', 'PATCH', `/farmers/services/${service.id}/analyze`, { application_id: application2.id, action: 'Accept' }, 409);
  await step('recusar candidatura', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: openApp.id, action: 'Reject' }, 200,
    (b) => assert.equal(b.application.status, 'Rejected'));
  await step('recusar de novo', 'PATCH', `/farmers/services/${open.id}/analyze`, { application_id: openApp.id, action: 'Reject' }, 409);

  await step('pagar serviço não iniciado', 'POST', `/farmers/services/${open.id}/payment`, undefined, 409);
  await step('pagar duas vezes', 'POST', `/farmers/services/${service.id}/payment`, undefined, 409);
  await step('status de filtro inválido', 'GET', `/farmers/${farmer.id}/services?status=Foo`, undefined, 400);
  await step('serviço inexistente', 'GET', '/farmers/services/999', undefined, 404);
  await step('rota inexistente', 'GET', '/nada', undefined, 404);

  console.log('\nEdição e remoção');
  const { farmer: fd } = await step('produtor a remover', 'POST', '/farmers',
    { name: 'Dora', email: 'dora@exemplo.com', phone: '1', cpf: '39053344705' }, 201);
  const { farm: fdFarm } = await step('fazenda a remover', 'POST', `/farmers/${fd.id}/farms`,
    { address: 'Sítio', city: 'Vassouras', state: 'RJ' }, 201);
  await step('farms guarda os IDs', 'GET', `/farmers/${fd.id}`, undefined, 200, (b) => assert.deepEqual(b.farms, [fdFarm.id]));
  await step('editar produtor', 'PATCH', `/farmers/${fd.id}`, { name: 'Dora Lima' }, 200, (b) => assert.equal(b.farmer.name, 'Dora Lima'));
  await step('editar cpf', 'PATCH', `/farmers/${fd.id}`, { cpf: '11144477735' }, 400);
  await step('editar para e-mail em uso', 'PATCH', `/farmers/${fd.id}`, { email: 'ana@exemplo.com' }, 409);

  const { service: fdService } = await step('serviço a remover', 'POST', '/farmers/services',
    { farmer_id: fd.id, farm_id: fdFarm.id, name: 'Roçada', category: 'Outros', duration: 4, price: 200 }, 201);
  const { worker: wd } = await step('trabalhador a remover', 'POST', '/workers',
    { name: 'Eli', email: 'eli@exemplo.com', phone: '1', cpf: '93541134780' }, 201);
  const { application: wdApp } = await step('candidatura a remover', 'POST', `/workers/services/${fdService.id}/apply`, { worker_id: wd.id }, 201);
  await step('aceitar para ficar em andamento', 'PATCH', `/farmers/services/${fdService.id}/analyze`, { application_id: wdApp.id, action: 'Accept' }, 200);
  await step('remover produtor com serviço em andamento', 'DELETE', `/farmers/${fd.id}`, undefined, 409);
  await step('remover trabalhador com serviço em andamento', 'DELETE', `/workers/${wd.id}`, undefined, 409);
  await step('pagar para concluir', 'POST', `/farmers/services/${fdService.id}/payment`, undefined, 200);

  await step('remover trabalhador', 'DELETE', `/workers/${wd.id}`, undefined, 200);
  await step('candidaturas do removido somem', 'GET', `/farmers/services/${fdService.id}/applications`, undefined, 200,
    (b) => assert.equal(b.length, 0));
  await step('remover produtor', 'DELETE', `/farmers/${fd.id}`, undefined, 200);
  await step('produtor removido', 'GET', `/farmers/${fd.id}`, undefined, 404);
  await step('serviço removido junto', 'GET', `/farmers/services/${fdService.id}`, undefined, 404);
  await step('remover inexistente', 'DELETE', `/workers/${wd.id}`, undefined, 404);

  const invalidJson = await call('POST', '/farmers', undefined, '{ invalido');
  assert.equal(invalidJson.status, 400);
  passed++;
  console.log('  ok  400 POST  /farmers  — JSON inválido');
}

const server = app.listen(0, async () => {
  baseUrl = `http://localhost:${server.address().port}/api`;
  try {
    await run();
    console.log(`\n${passed} verificações passaram.`);
  } catch (error) {
    console.error(`\nFALHOU: ${error.message}`);
    process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
