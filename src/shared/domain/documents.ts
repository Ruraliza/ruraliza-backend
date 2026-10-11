// Documentos enviados pelos usuários (hoje: o currículo em PDF do trabalhador).
//
// Mesmo esquema das fotos (ver src/domain/images.ts), mas sem processamento: o PDF é guardado
// como chegou, depois de conferir que é mesmo um PDF.
// - DocumentStore: guarda os bytes e diz a URL pública de cada documento.
//
// Hoje: InMemoryDocumentStore (some ao reiniciar).
// TODO(db): trocar por um store de arquivos (S3, Cloudflare R2, disco do servidor...), como o
// ImageStore. No banco fica só a URL (`resume_url`), nunca os bytes.

export const PDF_CONTENT_TYPE = 'application/pdf';
export const RESUME_MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // corpo aceito

// Todo PDF começa com "%PDF-" (o Content-Type do envio não garante nada).
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

export function isPdf(bytes: Uint8Array): boolean {
  return PDF_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

export interface StoredDocument {
  bytes: Uint8Array;
  contentType: string;
}

export interface DocumentStore {
  // Guarda e devolve o id do documento.
  save(document: StoredDocument): Promise<string>;
  get(id: string): Promise<StoredDocument | undefined>;
  delete(id: string): Promise<void>;
  // URL pública (relativa à API hoje; absoluta quando for um bucket/CDN).
  urlFor(id: string): string;
  // Id a partir de uma URL gerada por este store (para remover o documento antigo).
  idFromUrl(url: string): string | undefined;
}

// Apaga do store o documento de uma URL gerada por ele (sem erro se não houver, ou se for de outro lugar).
export async function releaseDocument(store: DocumentStore, url: string | null): Promise<void> {
  if (url === null) return;
  const id = store.idFromUrl(url);
  if (id !== undefined) await store.delete(id);
}
