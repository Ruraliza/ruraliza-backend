// Validade do token de redefinição de senha.
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Entrega o código de redefinição a quem é dono do e-mail (o envio por e-mail, quando existir).
// Nunca volta na resposta HTTP. Sem entrega (null), a redefinição pública fica desligada.
export type ResetCodeDelivery = (email: string, code: string) => void;
