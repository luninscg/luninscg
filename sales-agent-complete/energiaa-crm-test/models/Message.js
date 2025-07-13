/**
 * MODELO DE MENSAGEM
 * Schema para mensagens WhatsApp do Energiaa CRM
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Identificação
  messageId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Cliente relacionado
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  
  // Campanha relacionada (se aplicável)
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  
  // Dados do contato
  phone: {
    type: String,
    required: true
  },
  
  // Direção da mensagem
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  
  // Tipo de mensagem
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker'],
    default: 'text'
  },
  
  // Conteúdo da mensagem
  content: {
    text: String,
    caption: String,
    mediaUrl: String,
    mediaType: String,
    mediaSize: Number,
    fileName: String,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    contact: {
      name: String,
      phone: String,
      email: String
    }
  },
  
  // Status da mensagem
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  
  // Timestamps
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  
  // Contexto da conversa
  context: {
    isFirstMessage: {
      type: Boolean,
      default: false
    },
    conversationStage: {
      type: String,
      enum: ['inicial', 'qualificacao', 'apresentacao', 'simulacao', 'objecoes', 'agendamento', 'fechamento', 'pos-venda'],
      default: 'inicial'
    },
    intent: {
      type: String,
      enum: ['saudacao', 'duvida', 'interesse', 'objecao', 'agendamento', 'simulacao', 'preco', 'tecnico', 'outro']
    },
    sentiment: {
      type: String,
      enum: ['positivo', 'neutro', 'negativo'],
      default: 'neutro'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  },
  
  // Análise de IA
  aiAnalysis: {
    processed: {
      type: Boolean,
      default: false
    },
    keywords: [String],
    entities: [{
      type: String,
      value: String,
      confidence: Number
    }],
    topics: [String],
    urgency: {
      type: String,
      enum: ['baixa', 'media', 'alta'],
      default: 'media'
    },
    requiresHuman: {
      type: Boolean,
      default: false
    },
    suggestedResponse: String,
    nextAction: {
      type: String,
      enum: ['responder', 'agendar', 'simular', 'transferir', 'aguardar']
    }
  },
  
  // Resposta automática
  autoResponse: {
    triggered: {
      type: Boolean,
      default: false
    },
    responseId: String,
    delay: {
      type: Number,
      default: 0
    },
    scheduledFor: Date
  },
  
  // Métricas de engajamento
  engagement: {
    responseTime: Number, // em segundos
    wordCount: {
      type: Number,
      default: 0
    },
    hasEmoji: {
      type: Boolean,
      default: false
    },
    hasQuestion: {
      type: Boolean,
      default: false
    },
    hasUrl: {
      type: Boolean,
      default: false
    },
    hasPhone: {
      type: Boolean,
      default: false
    },
    hasEmail: {
      type: Boolean,
      default: false
    }
  },
  
  // Dados técnicos
  technical: {
    whatsappId: String,
    chatId: String,
    quotedMessageId: String,
    forwardedFrom: String,
    deviceType: String,
    appVersion: String,
    errorCode: String,
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0
    }
  },
  
  // Controle de qualidade
  isSpam: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isStarred: {
    type: Boolean,
    default: false
  },
  
  // Agente responsável
  agent: {
    type: String,
    default: 'AI-Sofia'
  },
  
  // Tags e categorização
  tags: [String],
  category: {
    type: String,
    enum: ['vendas', 'suporte', 'informacao', 'agendamento', 'reclamacao', 'elogio'],
    default: 'vendas'
  },
  
  // Metadados
  metadata: mongoose.Schema.Types.Mixed,
  notes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para performance
messageSchema.index({ clientId: 1, createdAt: -1 });
messageSchema.index({ phone: 1, createdAt: -1 });
messageSchema.index({ campaignId: 1 });
messageSchema.index({ direction: 1, status: 1 });
messageSchema.index({ 'context.conversationStage': 1 });
messageSchema.index({ 'context.intent': 1 });
messageSchema.index({ 'aiAnalysis.requiresHuman': 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ messageId: 1 });

// Virtual para duração da conversa
messageSchema.virtual('conversationDuration').get(function() {
  if (this.sentAt && this.readAt) {
    return this.readAt - this.sentAt;
  }
  return null;
});

// Virtual para texto limpo
messageSchema.virtual('cleanText').get(function() {
  if (this.content.text) {
    return this.content.text
      .replace(/[^\w\s]/gi, '') // Remove caracteres especiais
      .toLowerCase()
      .trim();
  }
  return '';
});

// Método para analisar sentimento
messageSchema.methods.analyzeSentiment = function() {
  if (!this.content.text) return 'neutro';
  
  const text = this.content.text.toLowerCase();
  
  // Palavras positivas
  const positiveWords = ['obrigado', 'ótimo', 'excelente', 'perfeito', 'adorei', 'maravilhoso', 'sim', 'quero', 'interessado', 'gostei'];
  const negativeWords = ['não', 'ruim', 'péssimo', 'horrível', 'problema', 'erro', 'cancelar', 'desistir', 'caro', 'impossível'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (text.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (text.includes(word)) negativeCount++;
  });
  
  if (positiveCount > negativeCount) {
    this.context.sentiment = 'positivo';
    this.context.confidence = Math.min(0.9, 0.5 + (positiveCount * 0.1));
  } else if (negativeCount > positiveCount) {
    this.context.sentiment = 'negativo';
    this.context.confidence = Math.min(0.9, 0.5 + (negativeCount * 0.1));
  } else {
    this.context.sentiment = 'neutro';
    this.context.confidence = 0.5;
  }
  
  return this.context.sentiment;
};

// Método para detectar intenção
messageSchema.methods.detectIntent = function() {
  if (!this.content.text) return 'outro';
  
  const text = this.content.text.toLowerCase();
  
  // Padrões de intenção
  const intentPatterns = {
    saudacao: ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'e aí'],
    interesse: ['quero', 'interessado', 'gostaria', 'preciso', 'como funciona'],
    preco: ['preço', 'valor', 'custo', 'quanto', 'custa', 'investimento'],
    simulacao: ['simular', 'simulação', 'calcular', 'economia', 'conta de luz'],
    agendamento: ['agendar', 'visita', 'reunião', 'encontro', 'horário'],
    duvida: ['dúvida', 'pergunta', 'como', 'por que', 'quando', 'onde'],
    objecao: ['mas', 'porém', 'não sei', 'difícil', 'complicado', 'caro']
  };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        this.context.intent = intent;
        return intent;
      }
    }
  }
  
  this.context.intent = 'outro';
  return 'outro';
};

// Método para extrair entidades
messageSchema.methods.extractEntities = function() {
  if (!this.content.text) return [];
  
  const text = this.content.text;
  const entities = [];
  
  // Extrair telefones
  const phoneRegex = /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g;
  const phones = text.match(phoneRegex);
  if (phones) {
    phones.forEach(phone => {
      entities.push({
        type: 'phone',
        value: phone,
        confidence: 0.9
      });
    });
  }
  
  // Extrair emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  if (emails) {
    emails.forEach(email => {
      entities.push({
        type: 'email',
        value: email,
        confidence: 0.9
      });
    });
  }
  
  // Extrair valores monetários
  const moneyRegex = /R\$\s?\d+(?:\.\d{3})*(?:,\d{2})?/g;
  const money = text.match(moneyRegex);
  if (money) {
    money.forEach(value => {
      entities.push({
        type: 'money',
        value: value,
        confidence: 0.8
      });
    });
  }
  
  this.aiAnalysis.entities = entities;
  return entities;
};

// Método para calcular métricas de engajamento
messageSchema.methods.calculateEngagement = function() {
  if (this.content.text) {
    // Contar palavras
    this.engagement.wordCount = this.content.text.split(/\s+/).length;
    
    // Verificar emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    this.engagement.hasEmoji = emojiRegex.test(this.content.text);
    
    // Verificar perguntas
    this.engagement.hasQuestion = this.content.text.includes('?');
    
    // Verificar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    this.engagement.hasUrl = urlRegex.test(this.content.text);
    
    // Verificar telefones
    const phoneRegex = /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g;
    this.engagement.hasPhone = phoneRegex.test(this.content.text);
    
    // Verificar emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    this.engagement.hasEmail = emailRegex.test(this.content.text);
  }
};

// Middleware pre-save
messageSchema.pre('save', function(next) {
  // Analisar sentimento e intenção para mensagens recebidas
  if (this.direction === 'inbound' && this.content.text) {
    this.analyzeSentiment();
    this.detectIntent();
    this.extractEntities();
    this.calculateEngagement();
  }
  
  // Marcar como processado pela IA
  if (this.direction === 'inbound') {
    this.aiAnalysis.processed = true;
  }
  
  next();
});

module.exports = mongoose.model('Message', messageSchema);