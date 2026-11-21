// Aviso único do catálogo para quem já tinha conta quando o catálogo chegou (ligado por padrão).
// Tabela `catalog_notices` (passo 004): uma linha por trabalhador daquela época, com sent_at NULL até o aviso.
export interface CatalogNoticeStore {
  // Marca como enviados, de uma vez, os avisos que faltam e devolve de quem são. Uma segunda chamada (ou outra
  // instância da API ao mesmo tempo) não recebe os mesmos: cada aviso sai uma vez só.
  claimPending(now: string): Promise<number[]>;
}
