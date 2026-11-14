import { randomUUID } from 'node:crypto';
import type { DocumentStore, StoredDocument } from '../../domain/documents';
import type { ImageStore } from '../../domain/images';
import type { Database } from './database';

// Arquivos (fotos, currículos e fotos de documento da verificação) guardados no PostgreSQL, na tabela
// `stored_files`. Cada armazenamento do container é um `store` separado: um id só é achado no seu.
// Serve às fotos e aos documentos: as duas portas têm a mesma forma.
//
// É a opção que não pede outro serviço: o disco do servidor publicado some a cada deploy. Para tirar os
// bytes do banco, ligue o bucket do Supabase Storage (SUPABASE_*; ver supabase-file-store.ts).
export class PgFileStore implements ImageStore, DocumentStore {
  constructor(
    private readonly db: Database,
    private readonly store: string,
    // Prefixo da URL pública (ex.: /api/images/) e extensão dos ids (ex.: webp).
    private readonly urlPrefix: string,
    private readonly extension: string
  ) {}

  async save(file: StoredDocument): Promise<string> {
    const id = `${randomUUID()}.${this.extension}`;
    await this.db.query('INSERT INTO stored_files (store, id, content_type, bytes) VALUES ($1, $2, $3, $4)', [
      this.store, id, file.contentType, Buffer.from(file.bytes)
    ]);
    return id;
  }

  async get(id: string): Promise<StoredDocument | undefined> {
    const { rows } = await this.db.query('SELECT content_type, bytes FROM stored_files WHERE store = $1 AND id = $2', [this.store, id]);
    const row = rows[0];
    if (row === undefined) return undefined;
    const { content_type: contentType, bytes } = row;
    if (typeof contentType !== 'string' || !(bytes instanceof Uint8Array)) throw new Error(`stored_files: registro ${id} ilegível.`);
    // O driver devolve um Buffer; a porta promete os bytes puros, como o armazenamento em memória.
    return { bytes: new Uint8Array(bytes), contentType };
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM stored_files WHERE store = $1 AND id = $2', [this.store, id]);
  }

  urlFor(id: string): string {
    return `${this.urlPrefix}${id}`;
  }

  idFromUrl(url: string): string | undefined {
    return url.startsWith(this.urlPrefix) ? url.slice(this.urlPrefix.length) : undefined;
  }
}
