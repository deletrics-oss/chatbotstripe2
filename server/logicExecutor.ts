/**
 * Logic Executor Engine
 * Processa lógicas JSON e retorna respostas baseadas em keywords
 */

export interface LogicRule {
  keywords: string[];
  reply: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  pause_bot_after_reply?: boolean;
  set_conversation_state?: string;
}

export interface LogicJson {
  rules: LogicRule[];
  default_reply?: string;
  pause_bot_after_reply?: boolean;
}

export interface ExecutionResult {
  reply: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  shouldPause: boolean;
  conversationState?: string;
}

/**
 * Normaliza texto removendo acentos, maiúsculas e espaços extras
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

/**
 * Executa lógica JSON contra mensagem recebida
 */
export function executeLogic(
  messageContent: string,
  logicJson: LogicJson
): ExecutionResult {
  const normalizedMessage = normalizeText(messageContent);

  // Procurar regra que matches
  for (const rule of logicJson.rules) {
    // Verificar se alguma keyword da regra está na mensagem
    const matches = rule.keywords.some(keyword => {
      const normalizedKeyword = normalizeText(keyword);
      return normalizedMessage.includes(normalizedKeyword);
    });

    if (matches) {
      return {
        reply: rule.reply,
        mediaUrl: rule.mediaUrl,
        mediaType: rule.mediaType,
        shouldPause: rule.pause_bot_after_reply ?? false,
        conversationState: rule.set_conversation_state,
      };
    }
  }

  // Se não encontrou match, usar resposta padrão
  return {
    reply: logicJson.default_reply || "Desculpe, não entendi sua mensagem.",
    shouldPause: logicJson.pause_bot_after_reply ?? false,
  };
}
