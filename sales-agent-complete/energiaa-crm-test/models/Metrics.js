/**
 * MODELO DE MÉTRICAS
 * Schema para métricas e analytics do Energiaa CRM
 */

const mongoose = require('mongoose');

const metricsSchema = new mongoose.Schema({
  // Período das métricas
  period: {
    type: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'],
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    year: Number,
    month: Number,
    week: Number,
    day: Number,
    hour: Number
  },

  // Métricas de clientes
  clients: {
    total: {
      type: Number,
      default: 0
    },
    new: {
      type: Number,
      default: 0
    },
    active: {
      type: Number,
      default: 0
    },
    byStatus: {
      novo: { type: Number, default: 0 },
      contatado: { type: Number, default: 0 },
      interessado: { type: Number, default: 0 },
      proposta: { type: Number, default: 0 },
      negociacao: { type: Number, default: 0 },
      fechado: { type: Number, default: 0 },
      perdido: { type: Number, default: 0 }
    },
    bySource: {
      whatsapp: { type: Number, default: 0 },
      site: { type: Number, default: 0 },
      facebook: { type: Number, default: 0 },
      instagram: { type: Number, default: 0 },
      google: { type: Number, default: 0 },
      indicacao: { type: Number, default: 0 },
      outro: { type: Number, default: 0 }
    },
    bySegment: {
      'alta-renda': { type: Number, default: 0 },
      'media-renda': { type: Number, default: 0 },
      comercial: { type: Number, default: 0 },
      industrial: { type: Number, default: 0 },
      rural: { type: Number, default: 0 }
    }
  },

  // Métricas de campanhas
  campaigns: {
    total: {
      type: Number,
      default: 0
    },
    active: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    messagesSent: {
      type: Number,
      default: 0
    },
    messagesDelivered: {
      type: Number,
      default: 0
    },
    messagesRead: {
      type: Number,
      default: 0
    },
    replies: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    },
    cost: {
      type: Number,
      default: 0
    },
    byType: {
      promocional: { type: Number, default: 0 },
      educativa: { type: Number, default: 0 },
      'follow-up': { type: Number, default: 0 },
      reativacao: { type: Number, default: 0 },
      simulacao: { type: Number, default: 0 },
      agendamento: { type: Number, default: 0 }
    }
  },

  // Métricas de mensagens
  messages: {
    total: {
      type: Number,
      default: 0
    },
    inbound: {
      type: Number,
      default: 0
    },
    outbound: {
      type: Number,
      default: 0
    },
    byType: {
      text: { type: Number, default: 0 },
      image: { type: Number, default: 0 },
      video: { type: Number, default: 0 },
      audio: { type: Number, default: 0 },
      document: { type: Number, default: 0 },
      location: { type: Number, default: 0 },
      contact: { type: Number, default: 0 },
      sticker: { type: Number, default: 0 }
    },
    byStatus: {
      pending: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    },
    avgResponseTime: {
      type: Number,
      default: 0
    },
    avgWordCount: {
      type: Number,
      default: 0
    }
  },

  // Métricas de conversação
  conversations: {
    total: {
      type: Number,
      default: 0
    },
    active: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    avgDuration: {
      type: Number,
      default: 0
    },
    avgMessagesPerConversation: {
      type: Number,
      default: 0
    },
    byStage: {
      inicial: { type: Number, default: 0 },
      qualificacao: { type: Number, default: 0 },
      apresentacao: { type: Number, default: 0 },
      simulacao: { type: Number, default: 0 },
      objecoes: { type: Number, default: 0 },
      agendamento: { type: Number, default: 0 },
      fechamento: { type: Number, default: 0 },
      'pos-venda': { type: Number, default: 0 }
    },
    bySentiment: {
      positivo: { type: Number, default: 0 },
      neutro: { type: Number, default: 0 },
      negativo: { type: Number, default: 0 }
    }
  },

  // Métricas de IA
  ai: {
    messagesProcessed: {
      type: Number,
      default: 0
    },
    autoResponses: {
      type: Number,
      default: 0
    },
    humanHandoffs: {
      type: Number,
      default: 0
    },
    avgConfidence: {
      type: Number,
      default: 0
    },
    intentAccuracy: {
      type: Number,
      default: 0
    },
    sentimentAccuracy: {
      type: Number,
      default: 0
    },
    byIntent: {
      saudacao: { type: Number, default: 0 },
      duvida: { type: Number, default: 0 },
      interesse: { type: Number, default: 0 },
      objecao: { type: Number, default: 0 },
      agendamento: { type: Number, default: 0 },
      simulacao: { type: Number, default: 0 },
      preco: { type: Number, default: 0 },
      tecnico: { type: Number, default: 0 },
      outro: { type: Number, default: 0 }
    }
  },

  // Métricas de vendas
  sales: {
    leads: {
      type: Number,
      default: 0
    },
    qualified: {
      type: Number,
      default: 0
    },
    proposals: {
      type: Number,
      default: 0
    },
    closed: {
      type: Number,
      default: 0
    },
    lost: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    },
    avgDealSize: {
      type: Number,
      default: 0
    },
    avgSalesCycle: {
      type: Number,
      default: 0
    },
    conversionRates: {
      leadToQualified: { type: Number, default: 0 },
      qualifiedToProposal: { type: Number, default: 0 },
      proposalToClosed: { type: Number, default: 0 },
      overallConversion: { type: Number, default: 0 }
    }
  },

  // Métricas de simulação
  simulations: {
    total: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    avgSavings: {
      monthly: { type: Number, default: 0 },
      annual: { type: Number, default: 0 }
    },
    avgSystemSize: {
      type: Number,
      default: 0
    },
    avgInvestment: {
      type: Number,
      default: 0
    },
    avgPayback: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    }
  },

  // Métricas de sistema
  system: {
    uptime: {
      type: Number,
      default: 100
    },
    errors: {
      type: Number,
      default: 0
    },
    apiCalls: {
      type: Number,
      default: 0
    },
    avgResponseTime: {
      type: Number,
      default: 0
    },
    memoryUsage: {
      type: Number,
      default: 0
    },
    cpuUsage: {
      type: Number,
      default: 0
    },
    diskUsage: {
      type: Number,
      default: 0
    },
    activeConnections: {
      type: Number,
      default: 0
    }
  },

  // Métricas financeiras
  financial: {
    revenue: {
      type: Number,
      default: 0
    },
    costs: {
      messaging: { type: Number, default: 0 },
      ai: { type: Number, default: 0 },
      infrastructure: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    profit: {
      type: Number,
      default: 0
    },
    roi: {
      type: Number,
      default: 0
    },
    cac: {
      type: Number,
      default: 0
    },
    ltv: {
      type: Number,
      default: 0
    },
    ltvCacRatio: {
      type: Number,
      default: 0
    }
  },

  // Dados brutos para cálculos
  rawData: {
    responseTimes: [Number],
    wordCounts: [Number],
    confidenceScores: [Number],
    dealSizes: [Number],
    salesCycles: [Number]
  },

  // Metadados
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  version: {
    type: String,
    default: '1.0'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para performance
metricsSchema.index({ 'period.type': 1, 'period.date': -1 });
metricsSchema.index({ 'period.year': 1, 'period.month': 1 });
metricsSchema.index({ 'period.date': -1 });
metricsSchema.index({ createdAt: -1 });

// Virtual para taxa de conversão geral
metricsSchema.virtual('overallConversionRate').get(function() {
  if (this.clients.total === 0) return 0;
  return ((this.sales.closed / this.clients.total) * 100).toFixed(2);
});

// Virtual para taxa de entrega de mensagens
metricsSchema.virtual('messageDeliveryRate').get(function() {
  if (this.messages.outbound === 0) return 0;
  return ((this.messages.byStatus.delivered / this.messages.outbound) * 100).toFixed(2);
});

// Virtual para taxa de resposta
metricsSchema.virtual('responseRate').get(function() {
  if (this.messages.outbound === 0) return 0;
  return ((this.messages.inbound / this.messages.outbound) * 100).toFixed(2);
});

// Virtual para ROI de campanhas
metricsSchema.virtual('campaignROI').get(function() {
  if (this.campaigns.cost === 0) return 0;
  return (((this.campaigns.revenue - this.campaigns.cost) / this.campaigns.cost) * 100).toFixed(2);
});

// Virtual para eficiência da IA
metricsSchema.virtual('aiEfficiency').get(function() {
  if (this.ai.messagesProcessed === 0) return 0;
  const humanHandoffRate = (this.ai.humanHandoffs / this.ai.messagesProcessed) * 100;
  return (100 - humanHandoffRate).toFixed(2);
});

// Método estático para criar métricas do período
metricsSchema.statics.createPeriodMetrics = async function(periodType, date) {
  const periodDate = new Date(date);
  const period = {
    type: periodType,
    date: periodDate,
    year: periodDate.getFullYear(),
    month: periodDate.getMonth() + 1,
    day: periodDate.getDate(),
    hour: periodDate.getHours()
  };
  
  // Calcular semana do ano
  const startOfYear = new Date(periodDate.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((periodDate - startOfYear) / (24 * 60 * 60 * 1000));
  period.week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  
  // Verificar se já existe métrica para este período
  const existing = await this.findOne({
    'period.type': periodType,
    'period.date': periodDate
  });
  
  if (existing) {
    return existing;
  }
  
  // Criar nova métrica
  return new this({ period });
};

// Método para atualizar métricas
metricsSchema.methods.updateMetric = function(path, value, operation = 'set') {
  const keys = path.split('.');
  let current = this;
  
  // Navegar até o penúltimo nível
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  const lastKey = keys[keys.length - 1];
  
  switch (operation) {
    case 'increment':
      current[lastKey] = (current[lastKey] || 0) + value;
      break;
    case 'average':
      // Para médias, assumimos que value é um array [novoValor, contador]
      const [newValue, count] = Array.isArray(value) ? value : [value, 1];
      const currentValue = current[lastKey] || 0;
      current[lastKey] = ((currentValue * (count - 1)) + newValue) / count;
      break;
    case 'max':
      current[lastKey] = Math.max(current[lastKey] || 0, value);
      break;
    case 'min':
      current[lastKey] = Math.min(current[lastKey] || Infinity, value);
      break;
    default:
      current[lastKey] = value;
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

// Método para calcular métricas derivadas
metricsSchema.methods.calculateDerivedMetrics = function() {
  // Calcular taxas de conversão de vendas
  if (this.clients.total > 0) {
    this.sales.conversionRates.leadToQualified = (this.sales.qualified / this.clients.total) * 100;
  }
  
  if (this.sales.qualified > 0) {
    this.sales.conversionRates.qualifiedToProposal = (this.sales.proposals / this.sales.qualified) * 100;
  }
  
  if (this.sales.proposals > 0) {
    this.sales.conversionRates.proposalToClosed = (this.sales.closed / this.sales.proposals) * 100;
  }
  
  if (this.clients.total > 0) {
    this.sales.conversionRates.overallConversion = (this.sales.closed / this.clients.total) * 100;
  }
  
  // Calcular métricas financeiras
  this.financial.costs.total = 
    this.financial.costs.messaging + 
    this.financial.costs.ai + 
    this.financial.costs.infrastructure;
  
  this.financial.profit = this.financial.revenue - this.financial.costs.total;
  
  if (this.financial.costs.total > 0) {
    this.financial.roi = (this.financial.profit / this.financial.costs.total) * 100;
  }
  
  // Calcular CAC (Customer Acquisition Cost)
  if (this.sales.closed > 0) {
    this.financial.cac = this.financial.costs.total / this.sales.closed;
  }
  
  // Calcular LTV/CAC ratio
  if (this.financial.cac > 0) {
    this.financial.ltvCacRatio = this.financial.ltv / this.financial.cac;
  }
  
  // Calcular médias de dados brutos
  if (this.rawData.responseTimes.length > 0) {
    this.messages.avgResponseTime = this.rawData.responseTimes.reduce((a, b) => a + b, 0) / this.rawData.responseTimes.length;
  }
  
  if (this.rawData.wordCounts.length > 0) {
    this.messages.avgWordCount = this.rawData.wordCounts.reduce((a, b) => a + b, 0) / this.rawData.wordCounts.length;
  }
  
  if (this.rawData.confidenceScores.length > 0) {
    this.ai.avgConfidence = this.rawData.confidenceScores.reduce((a, b) => a + b, 0) / this.rawData.confidenceScores.length;
  }
  
  if (this.rawData.dealSizes.length > 0) {
    this.sales.avgDealSize = this.rawData.dealSizes.reduce((a, b) => a + b, 0) / this.rawData.dealSizes.length;
  }
  
  if (this.rawData.salesCycles.length > 0) {
    this.sales.avgSalesCycle = this.rawData.salesCycles.reduce((a, b) => a + b, 0) / this.rawData.salesCycles.length;
  }
  
  return this;
};

// Middleware pre-save
metricsSchema.pre('save', function(next) {
  this.calculateDerivedMetrics();
  next();
});

module.exports = mongoose.model('Metrics', metricsSchema);