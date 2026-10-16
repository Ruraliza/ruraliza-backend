import type { WhatsAppSettings } from '#shared/config';
import type { WhatsAppSender } from '../domain/whatsapp';

// Envio pela Evolution API v2 (open source, roda num servidor próprio com um número de WhatsApp conectado):
// POST {WHATSAPP_API_URL}/message/sendText/{WHATSAPP_INSTANCE}, cabeçalho `apikey`, corpo { number, text }.
// Para Z-API, Twilio ou a API oficial da Meta, escreva outro WhatsAppSender e passe em createContainer({ whatsapp }).
export class EvolutionWhatsAppSender implements WhatsAppSender {
  readonly enabled = true;

  constructor(private readonly settings: WhatsAppSettings) {}

  async send(phone: string, text: string): Promise<void> {
    const { apiUrl, apiKey, instance } = this.settings;
    const res = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: phone, text })
    });
    if (!res.ok) throw new Error(`Evolution API respondeu ${res.status} ao enviar WhatsApp.`);
  }
}
