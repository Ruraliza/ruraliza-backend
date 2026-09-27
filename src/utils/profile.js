const { isValidEmail, isValidCpf, maskCpf, missingFields } = require('./validation');

const REQUIRED_PROFILE_FIELDS = ['email', 'name', 'phone', 'cpf'];

// Valida os dados de cadastro de um perfil (Farmer ou Worker).
// `existingProfiles` é a lista do MESMO tipo de perfil (unicidade por tipo).
// Retorna { status, error } quando inválido, ou null quando está tudo certo.
function validateProfileInput(body, existingProfiles) {
  const missing = missingFields(body, REQUIRED_PROFILE_FIELDS);
  if (missing.length > 0) {
    return { status: 400, error: `Preencha os campos obrigatórios: ${missing.join(', ')}.` };
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return { status: 400, error: 'E-mail inválido. Use o formato nome@dominio.com.' };
  }

  if (!isValidCpf(body.cpf)) {
    return { status: 400, error: 'CPF inválido. Envie os 11 dígitos, só números, e confira se estão corretos.' };
  }

  // TODO(db): trocar por restrições UNIQUE (email) e (cpf) na tabela de cada perfil.
  if (existingProfiles.some((p) => p.email === email)) {
    return { status: 409, error: 'Já existe um cadastro com este e-mail.' };
  }
  if (existingProfiles.some((p) => p.cpf === body.cpf)) {
    return { status: 409, error: 'Já existe um cadastro com este CPF.' };
  }

  return null;
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

// Versão do perfil segura para listas e respostas embutidas (CPF mascarado).
function toPublicProfile(profile) {
  return { ...profile, cpf: maskCpf(profile.cpf) };
}

module.exports = { validateProfileInput, normalizeEmail, toPublicProfile };
