import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { type SupabaseStorageSettings, supabaseStorageSettings } from '../../config';
import type { StoredDocument } from '../../domain/documents';
import { type Fetch, type PreviousFileStore, SupabaseFileStore, checkSupabaseBucket } from './supabase-file-store';

const settings: SupabaseStorageSettings = { url: 'https://projeto.supabase.co', serviceKey: 'chave-secreta', bucket: 'ruraliza' };
const OBJECTS = `${settings.url}/storage/v1/object/ruraliza/`;
const bytes = new Uint8Array([0, 1, 2, 250, 255]);
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// O Storage de mentira: guarda os objetos por caminho e anota cada chamada.
interface FakeStorage {
  objects: Map<string, StoredDocument>;
  calls: { method: string; url: string }[];
  request: Fetch;
}

function fakeStorage(options: { notFoundStatus?: 400 | 404; bucket?: Response } = {}): FakeStorage {
  const objects = new Map<string, StoredDocument>();
  const calls: { method: string; url: string }[] = [];
  const notFound = (): Response => options.notFoundStatus === 400
    ? json(400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    : json(404, { error: 'not_found' });
  const request: Fetch = (input, init) => {
    assert.ok(typeof input === 'string');
    const method = init?.method ?? 'GET';
    calls.push({ method, url: input });
    const sent = new Headers(init?.headers);
    assert.equal(sent.get('Authorization'), 'Bearer chave-secreta');
    assert.equal(sent.get('apikey'), 'chave-secreta');
    if (input === `${settings.url}/storage/v1/bucket/ruraliza`) return Promise.resolve(options.bucket ?? json(200, { id: 'ruraliza', public: false }));
    assert.ok(input.startsWith(OBJECTS));
    const path = input.slice(OBJECTS.length);
    if (method === 'POST') {
      assert.ok(init?.body instanceof Uint8Array);
      objects.set(path, { bytes: new Uint8Array(init.body), contentType: sent.get('Content-Type') ?? '' });
      return Promise.resolve(json(200, { Key: `ruraliza/${path}` }));
    }
    const found = objects.get(path);
    if (found === undefined) return Promise.resolve(notFound());
    if (method === 'DELETE') {
      objects.delete(path);
      return Promise.resolve(json(200, { message: 'Successfully deleted' }));
    }
    return Promise.resolve(new Response(Buffer.from(found.bytes), { status: 200, headers: { 'Content-Type': found.contentType } }));
  };
  return { objects, calls, request };
}

const store = (request: Fetch, folder = 'images', previous?: PreviousFileStore): SupabaseFileStore =>
  new SupabaseFileStore(settings, folder, '/api/images/', 'webp', previous, request);

describe('SupabaseFileStore', () => {
  it('guarda, devolve e apaga os bytes na pasta do armazenamento', async () => {
    const storage = fakeStorage();
    const images = store(storage.request);

    const id = await images.save({ bytes, contentType: 'image/webp' });
    assert.match(id, /^[0-9a-f-]{36}\.webp$/);
    assert.deepEqual([...storage.objects.keys()], [`images/${id}`]);
    assert.deepEqual(await images.get(id), { bytes, contentType: 'image/webp' });
    assert.equal(images.idFromUrl(images.urlFor(id)), id);

    await images.delete(id);
    assert.equal(await images.get(id), undefined);
  });

  it('cada armazenamento só acha os seus: a foto de documento não sai pela pasta das fotos', async () => {
    const storage = fakeStorage();
    const privateId = await store(storage.request, 'id_documents').save({ bytes, contentType: 'image/webp' });

    assert.equal(await store(storage.request).get(privateId), undefined);
  });

  it('recusa, sem chamar o Storage, um id que não é o que save gera (ex.: subir de pasta)', async () => {
    const storage = fakeStorage();
    const images = store(storage.request);
    const privateId = await store(storage.request, 'id_documents').save({ bytes, contentType: 'image/webp' });
    storage.calls.length = 0;

    for (const id of [`../id_documents/${privateId}`, `..%2Fid_documents%2F${privateId}`, privateId.replace('.webp', '.pdf'), 'x.webp', '']) {
      assert.equal(await images.get(id), undefined);
      await images.delete(id);
    }
    assert.deepEqual(storage.calls, []);
    assert.equal(storage.objects.size, 1);
  });

  it('trata como ausente o "não encontrado" antigo do Storage (400 com statusCode 404)', async () => {
    const images = store(fakeStorage({ notFoundStatus: 400 }).request);
    const id = '123e4567-e89b-42d3-a456-426614174000.webp';

    assert.equal(await images.get(id), undefined);
    await images.delete(id);
  });

  it('o que não está no bucket é lido e apagado no armazenamento anterior', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000.webp';
    const old = new Map<string, StoredDocument>([[id, { bytes, contentType: 'image/webp' }]]);
    const previous: PreviousFileStore = {
      get: (key) => Promise.resolve(old.get(key)),
      delete: (key) => Promise.resolve(void old.delete(key))
    };
    const images = store(fakeStorage().request, 'images', previous);

    assert.deepEqual(await images.get(id), { bytes, contentType: 'image/webp' });
    await images.delete(id);
    assert.equal(await images.get(id), undefined);
  });

  it('falha do Storage vira erro sem a chave nem o corpo da resposta', async () => {
    const failing: Fetch = () => Promise.resolve(json(500, { message: 'detalhe interno chave-secreta' }));
    const images = store(failing);
    const id = '123e4567-e89b-42d3-a456-426614174000.webp';

    for (const attempt of [images.save({ bytes, contentType: 'image/webp' }), images.get(id), images.delete(id)]) {
      await assert.rejects(attempt, (error: Error) => {
        assert.match(error.message, /^Supabase Storage respondeu 500 ao /);
        assert.doesNotMatch(error.message, /chave-secreta|detalhe/);
        return true;
      });
    }
  });
});

describe('checkSupabaseBucket', () => {
  it('aceita o bucket privado', async () => {
    await checkSupabaseBucket(settings, fakeStorage().request);
  });

  it('recusa bucket público, bucket inexistente e chave errada', async () => {
    await assert.rejects(checkSupabaseBucket(settings, fakeStorage({ bucket: json(200, { id: 'ruraliza', public: true }) }).request), /é público/);
    await assert.rejects(checkSupabaseBucket(settings, fakeStorage({ bucket: json(400, { statusCode: '404', error: 'Bucket not found' }) }).request), /não existe/);
    await assert.rejects(checkSupabaseBucket(settings, fakeStorage({ bucket: json(404, {}) }).request), /não existe/);
    await assert.rejects(checkSupabaseBucket(settings, fakeStorage({ bucket: json(401, {}) }).request), /recusou a chave/);
    await assert.rejects(checkSupabaseBucket(settings, fakeStorage({ bucket: json(403, {}) }).request), /recusou a chave/);
  });
});

describe('supabaseStorageSettings', () => {
  const KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_BUCKET'] as const;
  const saved = new Map(KEYS.map((key) => [key, process.env[key]]));
  const set = (values: Partial<Record<(typeof KEYS)[number], string>>): void => {
    for (const key of KEYS) process.env[key] = values[key] ?? '';
  };

  afterEach(() => {
    for (const [key, value] of saved) process.env[key] = value ?? '';
  });

  it('sem as variáveis, desligado; com as três, ligado (URL sem a barra final)', () => {
    set({});
    assert.equal(supabaseStorageSettings(), null);
    set({ SUPABASE_URL: 'https://projeto.supabase.co/', SUPABASE_SERVICE_KEY: ' chave ', SUPABASE_BUCKET: 'ruraliza' });
    assert.deepEqual(supabaseStorageSettings(), { url: 'https://projeto.supabase.co', serviceKey: 'chave', bucket: 'ruraliza' });
  });

  it('recusa a configuração pela metade e a URL que não é um endereço', () => {
    set({ SUPABASE_URL: 'https://projeto.supabase.co', SUPABASE_BUCKET: 'ruraliza' });
    assert.throws(() => supabaseStorageSettings(), /juntas/);
    set({ SUPABASE_URL: 'projeto.supabase.co', SUPABASE_SERVICE_KEY: 'chave', SUPABASE_BUCKET: 'ruraliza' });
    assert.throws(() => supabaseStorageSettings(), /endereço do projeto/);
  });
});
