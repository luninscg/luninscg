/**
 * SERVIÇO CHATBOT IA
 * Chatbot inteligente com prompt humanizado para Energiaa
 */

const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

// Importar prompt e dossiê
const { PROMPT_ENERGIAA_ADVANCED } = require('../prompt-energiaa-advanced');
const { ENERGIAA_DOSSIER } = require('../energiaa-dossier');

// Models
const ClientModel = require('../models/Client');
const Message = require('../models/Message');
const Metrics = require('../models/Metrics');

class ChatbotService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.conversationHistory = new Map();
    this.responseTemplates = new Map();
    this.contextMemory = new Map();
    
    this.initializeTemplates();
  }

  async initializeTemplates() {
    // Templates de resposta para diferentes situações
    this.responseTemplates.set('greeting', [
      'Oi! 😊 Tudo bem? Sou a Sofia da Energiaa! 🌞',
      'Olá! 👋 Que bom te ver aqui! Sou a Sofia, sua consultora de energia solar! ☀️',
      'E aí! 😄 Sofia aqui da Energiaa! Como posso te ajudar hoje? 🌱'
    ]);
    
    this.responseTemplates.set('interest', [
      'Que legal que você tem interesse em energia solar! 🎉',
      'Adorei saber do seu interesse! Energia solar é o futuro! 🚀',
      'Perfeito! Você está no caminho certo para economizar muito! 💰'
    ]);
    
    this.responseTemplates.set('objection_price', [
      'Entendo sua preocupação com o investimento... 🤔',
      'Sei que parece um valor alto no início, mas vou te mostrar algo incrível... 💡',
      'Essa é uma dúvida super comum! Deixa eu te explicar melhor... 📊'
    ]);
  }

  async processMessage(messageData) {
    const { text, phone, clientId, messageId, context } = messageData;
    
    try {
      // Buscar dados do cliente
      const client = await ClientModel.findById(clientId);
      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      // Analisar mensagem
      const analysis = await this.analyzeMessage(text, client, context);
      
      // Gerar resposta contextual
      const response = await this.generateResponse(text, client, analysis, context);
      
      // Atualizar contexto da conversa
      await this.updateConversationContext(phone, analysis, response);
      
      // Atualizar dados do cliente baseado na conversa
      await this.updateClientData(client, analysis, text);
      
      // Salvar métricas de IA
      await this.saveAIMetrics(analysis, response);
      
      return {
        shouldRespond: true,
        messages: response.messages,
        priority: response.priority,
        nextActions: response.nextActions,
        analysis: analysis
      };
      
    } catch (error) {
      console.error('❌ Erro no processamento do chatbot:', error);
      
      return {
        shouldRespond: true,
        messages: [{
          type: 'text',
          text: 'Ops! Tive um probleminha técnico aqui... 🤖 ||| Pode repetir sua mensagem? Prometo que vou responder certinho! 😊'
        }],
        priority: 'high',
        nextActions: [],
        analysis: { intent: 'error', sentiment: 'neutral', confidence: 0.1 }
      };
    }
  }

  async analyzeMessage(text, client, context) {
    const analysis = {
      intent: 'unknown',
      sentiment: 'neutral',
      confidence: 0.5,
      entities: [],
      keywords: [],
      urgency: 'medium',
      stage: 'initial',
      requiresHuman: false,
      topics: []
    };

    try {
      // Análise básica com regex patterns
      analysis.intent = this.detectIntent(text);
      analysis.sentiment = this.detectSentiment(text);
      analysis.entities = this.extractEntities(text);
      analysis.keywords = this.extractKeywords(text);
      analysis.urgency = this.detectUrgency(text);
      analysis.stage = this.determineConversationStage(text, client);
      
      // Análise avançada com OpenAI se disponível
      if (process.env.OPENAI_API_KEY) {
        const aiAnalysis = await this.performAIAnalysis(text, client);
        Object.assign(analysis, aiAnalysis);
      }
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Erro na análise da mensagem:', error);
      return analysis;
    }
  }

  detectIntent(text) {
    const lowerText = text.toLowerCase();
    
    const intentPatterns = {
      greeting: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e aí', 'eai', 'hey', 'hello'],
      interest: ['quero', 'interessado', 'interesse', 'gostaria', 'preciso', 'como funciona', 'me ajuda'],
      price: ['preço', 'preco', 'valor', 'custo', 'quanto', 'custa', 'investimento', 'caro', 'barato'],
      simulation: ['simular', 'simulação', 'simulacao', 'calcular', 'economia', 'conta de luz', 'kwh'],
      scheduling: ['agendar', 'visita', 'reunião', 'reuniao', 'encontro', 'horário', 'horario', 'quando'],
      doubt: ['dúvida', 'duvida', 'pergunta', 'como', 'por que', 'porque', 'quando', 'onde'],
      objection: ['mas', 'porém', 'porem', 'não sei', 'nao sei', 'difícil', 'dificil', 'complicado'],
      positive: ['sim', 'ok', 'certo', 'perfeito', 'ótimo', 'otimo', 'legal', 'show', 'top'],
      negative: ['não', 'nao', 'nunca', 'jamais', 'impossível', 'impossivel', 'desisto']
    };
    
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
          return intent;
        }
      }
    }
    
    return 'other';
  }

  detectSentiment(text) {
    const lowerText = text.toLowerCase();
    
    const positiveWords = ['obrigado', 'obrigada', 'ótimo', 'otimo', 'excelente', 'perfeito', 'adorei', 'amei', 'maravilhoso', 'legal', 'show', 'top', 'sim', 'quero', 'interessado', 'gostei', 'bom', 'boa'];
    const negativeWords = ['não', 'nao', 'ruim', 'péssimo', 'pessimo', 'horrível', 'horrivel', 'problema', 'erro', 'cancelar', 'desistir', 'caro', 'impossível', 'impossivel', 'difícil', 'dificil'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  extractEntities(text) {
    const entities = [];
    
    // Extrair telefones
    const phoneRegex = /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g;
    const phones = text.match(phoneRegex);
    if (phones) {
      phones.forEach(phone => {
        entities.push({ type: 'phone', value: phone, confidence: 0.9 });
      });
    }
    
    // Extrair emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex);
    if (emails) {
      emails.forEach(email => {
        entities.push({ type: 'email', value: email, confidence: 0.9 });
      });
    }
    
    // Extrair valores monetários
    const moneyRegex = /R\$\s?\d+(?:\.\d{3})*(?:,\d{2})?/g;
    const money = text.match(moneyRegex);
    if (money) {
      money.forEach(value => {
        entities.push({ type: 'money', value: value, confidence: 0.8 });
      });
    }
    
    // Extrair números (possível consumo de energia)
    const numberRegex = /\d+(?:,\d+)?\s*(?:kwh|kw|reais?)/gi;
    const numbers = text.match(numberRegex);
    if (numbers) {
      numbers.forEach(number => {
        entities.push({ type: 'energy_data', value: number, confidence: 0.7 });
      });
    }
    
    return entities;
  }

  extractKeywords(text) {
    const energyKeywords = [
      'energia solar', 'placa solar', 'painel solar', 'fotovoltaico', 'inversor',
      'conta de luz', 'economia', 'sustentabilidade', 'meio ambiente',
      'instalação', 'manutenção', 'garantia', 'financiamento', 'aluguel'
    ];
    
    const foundKeywords = [];
    const lowerText = text.toLowerCase();
    
    energyKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    });
    
    return foundKeywords;
  }

  detectUrgency(text) {
    const urgentWords = ['urgente', 'rápido', 'rapido', 'hoje', 'agora', 'imediato', 'emergência', 'emergencia'];
    const lowerText = text.toLowerCase();
    
    for (const word of urgentWords) {
      if (lowerText.includes(word)) {
        return 'high';
      }
    }
    
    return 'medium';
  }

  determineConversationStage(text, client) {
    const interactionCount = client.interactions.length;
    const lowerText = text.toLowerCase();
    
    if (interactionCount === 0) return 'initial';
    
    if (lowerText.includes('simular') || lowerText.includes('calcular')) {
      return 'simulation';
    }
    
    if (lowerText.includes('agendar') || lowerText.includes('visita')) {
      return 'scheduling';
    }
    
    if (lowerText.includes('preço') || lowerText.includes('valor')) {
      return 'pricing';
    }
    
    if (client.status === 'interessado') return 'qualification';
    if (client.status === 'proposta') return 'proposal';
    if (client.status === 'negociacao') return 'negotiation';
    
    return 'qualification';
  }

  async performAIAnalysis(text, client) {
    try {
      const prompt = `
Analise esta mensagem de um cliente interessado em energia solar:

Mensagem: "${text}"

Contexto do cliente:
- Status: ${client.status}
- Interações anteriores: ${client.interactions.length}
- Última interação: ${client.lastInteraction ? client.lastInteraction.timestamp : 'Primeira vez'}

Retorne um JSON com:
{
  "intent": "intenção principal",
  "sentiment": "positive/neutral/negative",
  "confidence": 0.8,
  "topics": ["tópicos identificados"],
  "requiresHuman": false,
  "suggestedResponse": "sugestão de resposta"
}
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return analysis;
      
    } catch (error) {
      console.error('❌ Erro na análise com IA:', error);
      return {};
    }
  }

  async generateResponse(text, client, analysis, context) {
    try {
      // Construir contexto da conversa
      const conversationContext = this.buildConversationContext(client, analysis, context);
      
      // Gerar resposta com OpenAI
      const aiResponse = await this.generateAIResponse(text, conversationContext);
      
      // Processar e humanizar resposta
      const humanizedResponse = this.humanizeResponse(aiResponse, analysis);
      
      // Determinar próximas ações
      const nextActions = this.determineNextActions(analysis, client);
      
      return {
        messages: humanizedResponse.messages,
        priority: this.determinePriority(analysis),
        nextActions: nextActions,
        metadata: {
          stage: analysis.stage,
          intent: analysis.intent,
          confidence: analysis.confidence
        }
      };
      
    } catch (error) {
      console.error('❌ Erro ao gerar resposta:', error);
      
      // Resposta de fallback
      return {
        messages: [{
          type: 'text',
          text: this.getFallbackResponse(analysis.intent)
        }],
        priority: 'normal',
        nextActions: []
      };
    }
  }

  buildConversationContext(client, analysis, context) {
    return {
      clientName: client.name,
      clientStatus: client.status,
      interactionCount: client.interactions.length,
      isFirstMessage: context.isFirstMessage,
      lastInteraction: context.lastInteraction,
      energyData: client.energyData,
      simulation: client.simulation,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      stage: analysis.stage,
      keywords: analysis.keywords,
      entities: analysis.entities
    };
  }

  async generateAIResponse(text, context) {
    try {
      const systemPrompt = PROMPT_ENERGIAA_ADVANCED;
      const userMessage = `
Contexto da conversa:
${JSON.stringify(context, null, 2)}

Mensagem do cliente: "${text}"

Responda como Sofia da Energiaa seguindo todas as diretrizes do prompt.
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content;
      
    } catch (error) {
      console.error('❌ Erro na geração com IA:', error);
      throw error;
    }
  }

  humanizeResponse(aiResponse, analysis) {
    // Dividir resposta em mensagens usando |||
    const messageParts = aiResponse.split('|||').map(part => part.trim()).filter(part => part);
    
    const messages = messageParts.map(part => ({
      type: 'text',
      text: part
    }));
    
    // Se não há divisões, usar resposta completa
    if (messages.length === 0) {
      messages.push({
        type: 'text',
        text: aiResponse
      });
    }
    
    return { messages };
  }

  determineNextActions(analysis, client) {
    const actions = [];
    
    if (analysis.intent === 'simulation') {
      actions.push({
        type: 'simulation',
        delay: 2000,
        data: { clientId: client._id }
      });
    }
    
    if (analysis.intent === 'scheduling') {
      actions.push({
        type: 'schedule_followup',
        delay: 5000,
        data: { clientId: client._id, days: 1 }
      });
    }
    
    if (analysis.urgency === 'high') {
      actions.push({
        type: 'priority_followup',
        delay: 3600000, // 1 hora
        data: { clientId: client._id }
      });
    }
    
    return actions;
  }

  determinePriority(analysis) {
    if (analysis.urgency === 'high') return 'high';
    if (analysis.intent === 'objection') return 'high';
    if (analysis.sentiment === 'negative') return 'high';
    if (analysis.intent === 'scheduling') return 'normal';
    return 'normal';
  }

  getFallbackResponse(intent) {
    const fallbacks = {
      greeting: 'Oi! 😊 Sou a Sofia da Energiaa! Como posso te ajudar com energia solar hoje? 🌞',
      interest: 'Que legal seu interesse em energia solar! 🎉 ||| Vou te ajudar a entender como funciona nosso sistema de aluguel! ☀️',
      price: 'Entendo sua curiosidade sobre valores! 💰 ||| Nosso modelo de aluguel é super acessível! Quer que eu faça uma simulação pra você? 📊',
      simulation: 'Perfeito! Vou te ajudar com a simulação! 🧮 ||| Preciso de alguns dados da sua conta de luz. Pode me enviar? 📋',
      scheduling: 'Ótimo! Vamos agendar uma conversa! 📅 ||| Qual horário funciona melhor pra você? 🕐',
      doubt: 'Fico feliz em esclarecer suas dúvidas! 🤔 ||| Pode perguntar à vontade! Estou aqui pra isso! 😊',
      objection: 'Entendo sua preocupação! 🤝 ||| Vou te mostrar como a energia solar pode ser a melhor decisão! 💡',
      other: 'Interessante! 🤔 ||| Me conta mais sobre o que você gostaria de saber sobre energia solar! ☀️'
    };
    
    return fallbacks[intent] || fallbacks.other;
  }

  async updateConversationContext(phone, analysis, response) {
    const context = this.conversationHistory.get(phone) || {
      messages: [],
      stage: 'initial',
      lastIntent: null,
      sentiment: 'neutral'
    };
    
    context.messages.push({
      timestamp: new Date(),
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      stage: analysis.stage
    });
    
    context.stage = analysis.stage;
    context.lastIntent = analysis.intent;
    context.sentiment = analysis.sentiment;
    
    // Manter apenas últimas 10 mensagens
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
    }
    
    this.conversationHistory.set(phone, context);
  }

  async updateClientData(client, analysis, text) {
    try {
      // Atualizar nível de interesse baseado no sentimento
      if (analysis.sentiment === 'positive') {
        client.interest.level = Math.min(10, client.interest.level + 1);
      } else if (analysis.sentiment === 'negative') {
        client.interest.level = Math.max(1, client.interest.level - 1);
      }
      
      // Extrair dados de energia das entidades
      for (const entity of analysis.entities) {
        if (entity.type === 'energy_data') {
          const value = parseFloat(entity.value.replace(/[^\d,]/g, '').replace(',', '.'));
          if (entity.value.toLowerCase().includes('kwh')) {
            client.energyData.monthlyConsumption = value;
          } else if (entity.value.toLowerCase().includes('reais')) {
            client.energyData.monthlyBill = value;
          }
        }
      }
      
      // Atualizar status baseado na intenção
      if (analysis.intent === 'interest' && client.status === 'novo') {
        client.status = 'interessado';
      } else if (analysis.intent === 'simulation' && client.status === 'interessado') {
        client.status = 'proposta';
      } else if (analysis.intent === 'scheduling') {
        client.status = 'negociacao';
      }
      
      // Adicionar tags baseadas nas palavras-chave
      for (const keyword of analysis.keywords) {
        if (!client.tags.includes(keyword)) {
          client.tags.push(keyword);
        }
      }
      
      // Calcular score de engajamento
      client.calculateEngagementScore();
      
      await client.save();
      
    } catch (error) {
      console.error('❌ Erro ao atualizar dados do cliente:', error);
    }
  }

  async saveAIMetrics(analysis, response) {
    try {
      // Implementar salvamento de métricas de IA
      const metrics = {
        intent: analysis.intent,
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        responseGenerated: true,
        processingTime: Date.now() // Calcular tempo real de processamento
      };
      
      // Salvar no sistema de métricas
      // await MetricsService.updateAIMetrics(metrics);
      
    } catch (error) {
      console.error('❌ Erro ao salvar métricas de IA:', error);
    }
  }

  // Métodos públicos para controle
  getConversationHistory(phone) {
    return this.conversationHistory.get(phone) || null;
  }

  clearConversationHistory(phone) {
    this.conversationHistory.delete(phone);
  }

  getStats() {
    return {
      activeConversations: this.conversationHistory.size,
      templatesLoaded: this.responseTemplates.size
    };
  }
}

module.exports = ChatbotService;