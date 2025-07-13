const Joi = require('joi');
const winston = require('winston');

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/validation.log' }),
    new winston.transports.Console()
  ]
});

// Schemas de validação
const schemas = {
  // Validação para dados de prompt
  promptData: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500),
    template: Joi.string().min(10).required(),
    parameters: Joi.object({
      temperature: Joi.number().min(0).max(2).default(0.7),
      max_tokens: Joi.number().min(1).max(4000).default(500),
      top_p: Joi.number().min(0).max(1).default(0.9),
      frequency_penalty: Joi.number().min(-2).max(2).default(0),
      presence_penalty: Joi.number().min(-2).max(2).default(0)
    }).default({}),
    version: Joi.string().pattern(/^\d+\.\d+$/).default('1.0'),
    category: Joi.string().valid(
      'qualification',
      'whatsapp_response',
      'intent_classification',
      'sentiment_analysis',
      'lead_scoring',
      'custom'
    ),
    variables: Joi.array().items(Joi.string()).default([]),
    active: Joi.boolean().default(true)
  }),

  // Validação para execução de prompt
  promptExecution: Joi.object({
    variables: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean(),
        Joi.object()
      )
    ).default({}),
    options: Joi.object({
      temperature: Joi.number().min(0).max(2),
      max_tokens: Joi.number().min(1).max(4000),
      timeout: Joi.number().min(1000).max(60000).default(30000),
      retries: Joi.number().min(0).max(3).default(1)
    }).default({})
  }),

  // Validação para dados de cliente
  clientData: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    cpf: Joi.string().pattern(/^\d{11}$/),
    cnpj: Joi.string().pattern(/^\d{14}$/),
    address: Joi.object({
      street: Joi.string().max(200),
      number: Joi.string().max(20),
      complement: Joi.string().max(100),
      neighborhood: Joi.string().max(100),
      city: Joi.string().max(100),
      state: Joi.string().length(2),
      zipCode: Joi.string().pattern(/^\d{8}$/),
      coordinates: Joi.object({
        lat: Joi.number().min(-90).max(90),
        lng: Joi.number().min(-180).max(180)
      })
    }),
    company: Joi.string().max(200),
    segment: Joi.string().valid(
      'residential',
      'commercial',
      'industrial',
      'rural',
      'public'
    ),
    source: Joi.string().max(100),
    tags: Joi.array().items(Joi.string().max(50)),
    customFields: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean()
      )
    )
  }),

  // Validação para dados de simulação
  simulationData: Joi.object({
    clientId: Joi.string().required(),
    consumptionKwh: Joi.number().min(0).max(100000).required(),
    averageBill: Joi.number().min(0).max(1000000).required(),
    roofArea: Joi.number().min(0).max(10000),
    roofType: Joi.string().valid(
      'ceramic',
      'concrete',
      'metal',
      'fiber_cement',
      'other'
    ),
    orientation: Joi.string().valid(
      'north',
      'south',
      'east',
      'west',
      'northeast',
      'northwest',
      'southeast',
      'southwest'
    ),
    shading: Joi.string().valid('none', 'partial', 'significant'),
    tariffType: Joi.string().valid(
      'conventional',
      'white',
      'green',
      'blue'
    ),
    voltage: Joi.string().valid('110V', '220V', '380V', '440V'),
    phase: Joi.string().valid('single', 'two', 'three'),
    location: Joi.object({
      city: Joi.string().required(),
      state: Joi.string().length(2).required(),
      coordinates: Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lng: Joi.number().min(-180).max(180).required()
      })
    }).required(),
    preferences: Joi.object({
      maxInvestment: Joi.number().min(0),
      paybackPeriod: Joi.number().min(1).max(30),
      financingInterest: Joi.boolean().default(false),
      brandPreference: Joi.array().items(Joi.string()),
      installationType: Joi.string().valid('roof', 'ground', 'carport')
    })
  }),

  // Validação para dados de mensagem WhatsApp
  whatsappMessage: Joi.object({
    to: Joi.string().pattern(/^\d{10,15}$/).required(),
    message: Joi.string().min(1).max(4096).required(),
    type: Joi.string().valid('text', 'image', 'document', 'audio', 'video').default('text'),
    mediaPath: Joi.string().when('type', {
      is: Joi.valid('image', 'document', 'audio', 'video'),
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    caption: Joi.string().max(1024).when('type', {
      is: Joi.valid('image', 'document', 'video'),
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    }),
    priority: Joi.string().valid('low', 'normal', 'high').default('normal'),
    scheduledAt: Joi.date().min('now'),
    metadata: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean()
      )
    )
  }),

  // Validação para dados de campanha
  campaignData: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500),
    type: Joi.string().valid(
      'whatsapp_broadcast',
      'email_sequence',
      'sms_campaign',
      'mixed'
    ).required(),
    status: Joi.string().valid(
      'draft',
      'scheduled',
      'running',
      'paused',
      'completed',
      'cancelled'
    ).default('draft'),
    targetAudience: Joi.object({
      segments: Joi.array().items(Joi.string()),
      tags: Joi.array().items(Joi.string()),
      customFilters: Joi.object(),
      excludeSegments: Joi.array().items(Joi.string())
    }),
    content: Joi.object({
      template: Joi.string().required(),
      variables: Joi.object(),
      mediaFiles: Joi.array().items(Joi.string())
    }),
    schedule: Joi.object({
      startDate: Joi.date().min('now'),
      endDate: Joi.date().min(Joi.ref('startDate')),
      timezone: Joi.string().default('America/Sao_Paulo'),
      frequency: Joi.string().valid('once', 'daily', 'weekly', 'monthly'),
      interval: Joi.number().min(1).max(365)
    }),
    settings: Joi.object({
      maxRecipientsPerBatch: Joi.number().min(1).max(1000).default(100),
      delayBetweenMessages: Joi.number().min(1000).max(60000).default(5000),
      retryFailedMessages: Joi.boolean().default(true),
      trackOpens: Joi.boolean().default(true),
      trackClicks: Joi.boolean().default(true)
    })
  }),

  // Validação para upload de arquivos
  fileUpload: Joi.object({
    allowedTypes: Joi.array().items(Joi.string()).default(['.jpg', '.jpeg', '.png', '.pdf']),
    maxSize: Joi.number().min(1024).max(50 * 1024 * 1024).default(10 * 1024 * 1024), // 10MB
    maxFiles: Joi.number().min(1).max(20).default(5)
  }),

  // Validação para configurações do sistema
  systemSettings: Joi.object({
    whatsapp: Joi.object({
      sessionPath: Joi.string(),
      webhookUrl: Joi.string().uri(),
      autoReply: Joi.boolean().default(false),
      businessHours: Joi.object({
        enabled: Joi.boolean().default(false),
        start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        timezone: Joi.string().default('America/Sao_Paulo')
      })
    }),
    ai: Joi.object({
      provider: Joi.string().valid('openai', 'anthropic', 'local').default('openai'),
      model: Joi.string().default('gpt-3.5-turbo'),
      maxTokens: Joi.number().min(100).max(4000).default(1000),
      temperature: Joi.number().min(0).max(2).default(0.7),
      timeout: Joi.number().min(5000).max(60000).default(30000)
    }),
    notifications: Joi.object({
      email: Joi.object({
        enabled: Joi.boolean().default(true),
        recipients: Joi.array().items(Joi.string().email()),
        events: Joi.array().items(Joi.string())
      }),
      webhook: Joi.object({
        enabled: Joi.boolean().default(false),
        url: Joi.string().uri(),
        events: Joi.array().items(Joi.string()),
        secret: Joi.string().min(16)
      })
    })
  })
};

// Middleware de validação genérico
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Erro de validação:', {
        endpoint: req.originalUrl,
        method: req.method,
        errors: errorDetails,
        userId: req.user?.id
      });

      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errorDetails
      });
    }

    // Substituir dados validados
    req[property] = value;
    next();
  };
};

// Middlewares específicos
const validatePromptData = validate(schemas.promptData);
const validatePromptExecution = validate(schemas.promptExecution);
const validateClientData = validate(schemas.clientData);
const validateSimulationData = validate(schemas.simulationData);
const validateWhatsappMessage = validate(schemas.whatsappMessage);
const validateCampaignData = validate(schemas.campaignData);
const validateSystemSettings = validate(schemas.systemSettings);

// Validação de parâmetros de query
const validateQuery = (schema) => validate(schema, 'query');

// Validação de parâmetros de rota
const validateParams = (schema) => validate(schema, 'params');

// Validação customizada para arquivos
const validateFileUpload = (options = {}) => {
  const schema = schemas.fileUpload;
  const { error, value } = schema.validate(options);
  
  if (error) {
    throw new Error(`Configuração de upload inválida: ${error.message}`);
  }

  return (req, res, next) => {
    if (!req.files && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    
    // Validar número de arquivos
    if (files.length > value.maxFiles) {
      return res.status(400).json({
        success: false,
        error: `Máximo ${value.maxFiles} arquivos permitidos`
      });
    }

    // Validar cada arquivo
    for (const file of files) {
      // Validar tamanho
      if (file.size > value.maxSize) {
        return res.status(400).json({
          success: false,
          error: `Arquivo ${file.originalname} excede o tamanho máximo de ${Math.round(value.maxSize / 1024 / 1024)}MB`
        });
      }

      // Validar tipo
      const ext = require('path').extname(file.originalname).toLowerCase();
      if (!value.allowedTypes.includes(ext)) {
        return res.status(400).json({
          success: false,
          error: `Tipo de arquivo ${ext} não permitido. Tipos aceitos: ${value.allowedTypes.join(', ')}`
        });
      }
    }

    next();
  };
};

// Validação de dados de OCR
const validateOCRData = validate(Joi.object({
  clientId: Joi.string(),
  validateData: Joi.boolean().default(true),
  associateClient: Joi.boolean().default(true),
  extractHistorical: Joi.boolean().default(true),
  language: Joi.string().valid('por', 'eng', 'por+eng').default('por'),
  confidence: Joi.number().min(0).max(100).default(60)
}));

// Validação de dados de proposta
const validateProposalData = validate(Joi.object({
  clientId: Joi.string().required(),
  simulationId: Joi.string(),
  templateType: Joi.string().valid(
    'standard',
    'premium',
    'commercial',
    'industrial',
    'custom'
  ).default('standard'),
  customData: Joi.object().default({}),
  format: Joi.string().valid('html', 'pdf', 'both').default('html'),
  includeAttachments: Joi.boolean().default(true),
  language: Joi.string().valid('pt-BR', 'en-US', 'es-ES').default('pt-BR')
}));

// Validação de filtros de busca
const validateSearchFilters = validateQuery(Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sortBy: Joi.string().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(100),
  dateFrom: Joi.date(),
  dateTo: Joi.date().min(Joi.ref('dateFrom')),
  status: Joi.string(),
  category: Joi.string(),
  tags: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  )
}));

// Sanitização de dados
const sanitizeHtml = require('sanitize-html');
// const mongoSanitize = require('express-mongo-sanitize'); // Removido para SQLite

const sanitizeInput = (req, res, next) => {
  // Sanitizar dados contra NoSQL injection - removido para SQLite
  // mongoSanitize.sanitize(req.body);
  // mongoSanitize.sanitize(req.query);
  // mongoSanitize.sanitize(req.params);

  // Sanitizar HTML em campos de texto
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeHtml(obj[key], {
          allowedTags: [],
          allowedAttributes: {},
          disallowedTagsMode: 'discard'
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
};

// Validação de rate limiting personalizada
const validateRateLimit = (options) => {
  return (req, res, next) => {
    const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
    const limit = options.max || 100;
    const window = options.windowMs || 60000;

    // Implementar lógica de rate limiting customizada aqui
    // Por simplicidade, apenas passamos adiante
    next();
  };
};

module.exports = {
  schemas,
  validate,
  validatePromptData,
  validatePromptExecution,
  validateClientData,
  validateSimulationData,
  validateWhatsappMessage,
  validateCampaignData,
  validateSystemSettings,
  validateQuery,
  validateParams,
  validateFileUpload,
  validateOCRData,
  validateProposalData,
  validateSearchFilters,
  sanitizeInput,
  validateRateLimit
};