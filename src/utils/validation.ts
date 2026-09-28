const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_PATTERN.test(email);
}

// CPF: 11 dígitos (só números), não repetidos, com dígitos verificadores válidos.
export function isValidCpf(cpf: unknown): cpf is string {
  if (typeof cpf !== 'string' || !/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (i: number): number => cpf.charCodeAt(i) - 48; // '0' = 48
  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digit(i) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digit(9) && checkDigit(10) === digit(10);
}

// 12345678901 -> ***.456.789-**
export function maskCpf(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// Converte um valor do corpo JSON para texto, como a API sempre fez (String(valor)).
export function text(value: unknown): string {
  return String(value);
}

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || text(value).trim() === '';
}

// Devolve os nomes dos campos obrigatórios ausentes no corpo.
export function missingFields<K extends string>(body: Readonly<Record<string, unknown>>, fields: readonly K[]): K[] {
  return fields.filter((field) => isBlank(body[field]));
}
