const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_PATTERN.test(email);
}

// CPF: 11 dígitos (só números), não repetidos, com dígitos verificadores válidos.
function isValidCpf(cpf) {
  if (typeof cpf !== 'string' || !/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  const checkDigit = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

// 12345678901 -> ***.456.789-**
function maskCpf(cpf) {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

// Devolve os nomes dos campos obrigatórios ausentes no corpo.
function missingFields(body, fields) {
  return fields.filter((field) => isBlank(body[field]));
}

module.exports = { isValidEmail, isValidCpf, maskCpf, isPositiveNumber, missingFields };
