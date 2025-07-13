/**
 * MODELO DE CAMPANHA
 * Schema para campanhas de disparo WhatsApp do Energiaa CRM
 */

const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  // Informações básicas
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Tipo de campanha
  type: {
    type: String,
    enum: ['promocional', 'educativa', 'follow-up', 'reativacao', 'simulacao', 'agendamento'],
    required: true
  },
  
  // Status da campanha
  status: {
    type: String,
    enum: ['rascunho', 'agendada', 'executando', 'pausada', 'concluida', 'cancelada'],
    default: 'rascunho'
  },

  // Conteúdo da mensagem
  message: {
    text: {
      type: String,
      required: true
    },
    hasMedia: {
      type: Boolean,
      default: false
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'audio', 'document'],
      required: function() { return this.message.hasMedia; }
    },
    mediaUrl: {
      type: String,
      required: function() { return this.message.hasMedia; }
    },
    mediaCaption: String,
    variables: [{
      name: String,
      defaultValue: String,
      required: Boolean
    }]
  },

  // Segmentação de público
  targeting: {
    segments: [{
      type: String,
      enum: ['alta-renda', 'media-renda', 'comercial', 'industrial', 'rural', 'todos']
    }],
    tags: [String],
    status: [{
      type: String,
      enum: ['novo', 'contatado', 'interessado', 'proposta', 'negociacao', 'fechado', 'perdido']
    }],
    source: [{
      type: String,
      enum: ['whatsapp', 'site', 'facebook', 'instagram', 'google', 'indicacao', 'outro']
    }],
    interestLevel: {
      min: {
        type: Number,
        min: 1,
        max: 10,
        default: 1
      },
      max: {
        type: Number,
        min: 1,
        max: 10,
        default: 10
      }
    },
    lastInteractionDays: {
      min: Number,
      max: Number
    },
    customFilters: mongoose.Schema.Types.Mixed
  },

  // Agendamento
  scheduling: {
    type: {
      type: String,
      enum: ['imediato', 'agendado', 'recorrente'],
      default: 'imediato'
    },
    scheduledDate: Date,
    timezone: {
      type: String,
      default: 'America/Sao_Paulo'
    },
    recurrence: {
      enabled: {
        type: Boolean,
        default: false
      },
      pattern: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: function() { return this.scheduling.recurrence.enabled; }
      },
      interval: {
        type: Number,
        default: 1,
        required: function() { return this.scheduling.recurrence.enabled; }
      },
      endDate: Date,
      maxOccurrences: Number
    }
  },

  // Configurações de envio
  sendingConfig: {
    batchSize: {
      type: Number,
      default: 50,
      min: 1,
      max: 200
    },
    delayBetweenMessages: {
      type: Number,
      default: 5000, // 5 segundos
      min: 1000,
      max: 60000
    },
    delayBetweenBatches: {
      type: Number,
      default: 300000, // 5 minutos
      min: 60000,
      max: 3600000
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 5
    },
    respectOptOut: {
      type: Boolean,
      default: true
    }
  },

  // Métricas e resultados
  metrics: {
    targetAudience: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    read: {
      type: Number,
      default: 0
    },
    replied: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    optOut: {
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
    }
  },

  // Execução
  execution: {
    startedAt: Date,
    completedAt: Date,
    pausedAt: Date,
    cancelledAt: Date,
    currentBatch: {
      type: Number,
      default: 0
    },
    totalBatches: {
      type: Number,
      default: 0
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    errors: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      error: String,
      clientId: mongoose.Schema.Types.ObjectId,
      phone: String
    }]
  },

  // Logs detalhados
  logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info'
    },
    message: String,
    data: mongoose.Schema.Types.Mixed
  }],

  // A/B Testing
  abTest: {
    enabled: {
      type: Boolean,
      default: false
    },
    variants: [{
      name: String,
      percentage: {
        type: Number,
        min: 0,
        max: 100
      },
      message: {
        text: String,
        mediaUrl: String,
        mediaCaption: String
      },
      metrics: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        read: { type: Number, default: 0 },
        replied: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 }
      }
    }]
  },

  // Controle
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: String,
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String],
  notes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para performance
campaignSchema.index({ status: 1 });
campaignSchema.index({ type: 1 });
campaignSchema.index({ 'scheduling.scheduledDate': 1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ 'execution.startedAt': -1 });

// Virtual para taxa de entrega
campaignSchema.virtual('deliveryRate').get(function() {
  if (this.metrics.sent === 0) return 0;
  return ((this.metrics.delivered / this.metrics.sent) * 100).toFixed(2);
});

// Virtual para taxa de leitura
campaignSchema.virtual('readRate').get(function() {
  if (this.metrics.delivered === 0) return 0;
  return ((this.metrics.read / this.metrics.delivered) * 100).toFixed(2);
});

// Virtual para taxa de resposta
campaignSchema.virtual('replyRate').get(function() {
  if (this.metrics.delivered === 0) return 0;
  return ((this.metrics.replied / this.metrics.delivered) * 100).toFixed(2);
});

// Virtual para taxa de conversão
campaignSchema.virtual('conversionRate').get(function() {
  if (this.metrics.delivered === 0) return 0;
  return ((this.metrics.conversions / this.metrics.delivered) * 100).toFixed(2);
});

// Virtual para ROI
campaignSchema.virtual('roi').get(function() {
  // Calcular ROI baseado na receita vs custo estimado
  const estimatedCost = this.metrics.sent * 0.05; // R$ 0,05 por mensagem
  if (estimatedCost === 0) return 0;
  return (((this.metrics.revenue - estimatedCost) / estimatedCost) * 100).toFixed(2);
});

// Método para adicionar log
campaignSchema.methods.addLog = function(level, message, data = null) {
  this.logs.push({
    level,
    message,
    data,
    timestamp: new Date()
  });
  return this.save();
};

// Método para atualizar métricas
campaignSchema.methods.updateMetrics = function(metric, increment = 1) {
  if (this.metrics[metric] !== undefined) {
    this.metrics[metric] += increment;
    
    // Atualizar progresso
    if (this.metrics.targetAudience > 0) {
      const totalProcessed = this.metrics.sent + this.metrics.failed;
      this.execution.progress = Math.min(100, (totalProcessed / this.metrics.targetAudience) * 100);
    }
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Método para pausar campanha
campaignSchema.methods.pause = function() {
  this.status = 'pausada';
  this.execution.pausedAt = new Date();
  return this.addLog('info', 'Campanha pausada');
};

// Método para retomar campanha
campaignSchema.methods.resume = function() {
  this.status = 'executando';
  this.execution.pausedAt = null;
  return this.addLog('info', 'Campanha retomada');
};

// Método para finalizar campanha
campaignSchema.methods.complete = function() {
  this.status = 'concluida';
  this.execution.completedAt = new Date();
  this.execution.progress = 100;
  return this.addLog('success', 'Campanha concluída com sucesso');
};

// Método para cancelar campanha
campaignSchema.methods.cancel = function(reason = 'Cancelada pelo usuário') {
  this.status = 'cancelada';
  this.execution.cancelledAt = new Date();
  return this.addLog('warning', `Campanha cancelada: ${reason}`);
};

// Middleware pre-save
campaignSchema.pre('save', function(next) {
  // Calcular total de batches
  if (this.metrics.targetAudience > 0 && this.sendingConfig.batchSize > 0) {
    this.execution.totalBatches = Math.ceil(this.metrics.targetAudience / this.sendingConfig.batchSize);
  }
  
  next();
});

module.exports = mongoose.model('Campaign', campaignSchema);