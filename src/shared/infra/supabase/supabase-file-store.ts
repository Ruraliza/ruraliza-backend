import { randomUUID } from 'node:crypto';
import type { SupabaseStorageSettings } from '../../config';
import type { DocumentStore, StoredDocument } from '../../domain/documents';
import type { ImageStore } from '../../domain/images';
import { isRecord } from '../http/body';

// Arquivos (fotos, currículos e fotos de documento da verificação) num bucket PRIVADO do Supabase Storage,
// pela API REST: POST/GET/DELETE {SUPABASE_URL}/storage/v1/object/{bucket}/{pasta}/{id}, com a chave de
// serviço. Só a API lê o bucket; o navegador continua pedindo os arquivos às rotas dela, que conferem
// quem pode ver. Cada armazenamento do container é uma pasta: um id só é achado na sua.
// Serve às fotos e aos documentos: as duas portas têm a mesma forma.

export type Fetch = typeof fetch;

// O que já estava guardado em outro lugar (a tabela `stored_files`) antes de ligar o bucket.
export type PreviousFileStore = Pick<DocumentStore, 'get' | 'delete'>;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function headers(settings: SupabaseStorageSettings): Record<string, string> {
  return { apikey: settings.serviceKey, Authorization: `Bearer ${settings.serviceKey}` };
}

// O Storage responde 404 ou, em versões antigas, 400 com { statusCode: '404' } para o que não existe.
async function isNotFound(res: Response): Promise<boolean> {
  if (res.status === 404) return true;
  if (res.status !== 400) return false;
  const body: unknown = await res.json().catch(() => undefined);
  return isRecord(body) && (body['statusCode'] === '404' || body['error'] === 'not_found' || body['error'] === 'Bucket not found');
}

// Só o status entra na mensagem: o corpo da resposta e a chave ficam fora do log.
function failure(action: string, res: Response): Error {
  return new Error(`Supabase Storage respondeu ${res.status} ao ${action}.`);
}

export class SupabaseFileStore implements ImageStore, DocumentStore {
  private readonly validId: RegExp;

  constructor(
    private readonly settings: SupabaseStorageSettings,
    private readonly folder: string,
    // Prefixo da URL servida pela API (ex.: /api/images/) e extensão dos ids (ex.: webp).
    private readonly urlPrefix: string,
    private readonly extension: string,
    private readonly previous?: PreviousFileStore,
    private readonly request: Fetch = fetch
  ) {
    this.validId = new RegExp(`^${UUID}\\.${extension}$`);
  }

  // O id chega da URL pedida pelo navegador. Só passa o formato que `save` gera: sem isso, um id como
  // `../id_documents/<uuid>.webp` leria a pasta privada pela rota pública das fotos.
  private objectUrl(id: string): string | undefined {
    if (!this.validId.test(id)) return undefined;
    return `${this.settings.url}/storage/v1/object/${encodeURIComponent(this.settings.bucket)}/${this.folder}/${id}`;
  }

  async save(file: StoredDocument): Promise<string> {
    const id = `${randomUUID()}.${this.extension}`;
    const res = await this.request(`${this.settings.url}/storage/v1/object/${encodeURIComponent(this.settings.bucket)}/${this.folder}/${id}`, {
      method: 'POST',
      headers: { ...headers(this.settings), 'Content-Type': file.contentType },
      body: Buffer.from(file.bytes)
    });
    if (!res.ok) throw failure('guardar um arquivo', res);
    return id;
  }

  async get(id: string): Promise<StoredDocument | undefined> {
    const url = this.objectUrl(id);
    if (url === undefined) return undefined;
    const res = await this.request(url, { headers: headers(this.settings) });
    if (res.ok) {
      return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
    }
    if (await isNotFound(res)) return this.previous?.get(id);
    throw failure('ler um arquivo', res);
  }

  async delete(id: string): Promise<void> {
    const url = this.objectUrl(id);
    if (url === undefined) return;
    const res = await this.request(url, { method: 'DELETE', headers: headers(this.settings) });
    if (!res.ok && !(await isNotFound(res))) throw failure('apagar um arquivo', res);
    await this.previous?.delete(id);
  }

  urlFor(id: string): string {
    return `${this.urlPrefix}${id}`;
  }

  idFromUrl(url: string): string | undefined {
    return url.startsWith(this.urlPrefix) ? url.slice(this.urlPrefix.length) : undefined;
  }
}

// Confere, na subida, que a chave abre o bucket e que ele é privado. Um bucket público serviria as fotos
// de documento de identidade a quem tivesse o endereço, sem passar pela API.
export async function checkSupabaseBucket(settings: SupabaseStorageSettings, request: Fetch = fetch): Promise<void> {
  const res = await request(`${settings.url}/storage/v1/bucket/${encodeURIComponent(settings.bucket)}`, { headers: headers(settings) });
  if (res.status === 401 || res.status === 403) throw new Error('Supabase Storage recusou a chave: confira SUPABASE_SERVICE_KEY (a chave secreta, não a pública).');
  if (await isNotFound(res)) throw new Error(`Supabase Storage: o bucket "${settings.bucket}" não existe. Crie-o no painel ou corrija SUPABASE_BUCKET.`);
  if (!res.ok) throw failure('conferir o bucket', res);
  const body: unknown = await res.json().catch(() => undefined);
  if (isRecord(body) && body['public'] === true) {
    throw new Error(`Supabase Storage: o bucket "${settings.bucket}" é público. Torne-o privado no painel (Storage > Edit bucket).`);
  }
}
