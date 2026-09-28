// Corpo JSON já lido, mas ainda não validado: cada campo é `unknown`.
export type Body = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Qualquer corpo que não seja um objeto JSON vira {} (os campos obrigatórios acusam a falta).
export function toBody(value: unknown): Body {
  return isRecord(value) ? value : {};
}

export function missingMessage(fields: readonly string[]): string {
  return `Preencha os campos obrigatórios: ${fields.join(', ')}.`;
}
