import { operation as moduleOperation } from '#shared/infra/docs/operations';
import type { SchemaName } from './schemas';

export { IMAGE_UPLOAD, PDF_UPLOAD, TAGS, type Tag, pathParam, queryParam } from '#shared/infra/docs/operations';

// Operação que pode citar qualquer schema do documento. Usada pelas rotas ainda não migradas para
// src/modules; as dos módulos usam `operation<NomesDoMódulo>` de #shared/infra/docs/operations.
export const operation = moduleOperation<SchemaName>;
