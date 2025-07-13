const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Função para validar variáveis de ambiente obrigatórias
const validateRequiredEnvVars = (requiredVars) => {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias não encontradas: ${missing.join(', ')}`);
  }
};

// Função para criar diretórios se não existirem
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configurações do servidor
const server = {
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  env: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  compression: {
    enabled: process.env.COMPRESSION_ENABLED === 'true',
    level: parseInt(process.env.COMPRESSION_LEVEL) || 6
  },
  helmet: {
    enabled: process.env.HELMET_ENABLED !== 'false',
    contentSecurityPolicy: process.env.CSP_ENABLED === 'true'
  }
};

// Configurações do banco de dados
const database = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/energiaa-crm',
    testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/energiaa-crm-test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      bufferMaxEntries: 0,
      bufferCommands: false
    }
  },
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'energiaa:',
    ttl: parseInt(process.env.REDIS_TTL) || 3600
  }
};

// Configurações de autenticação e segurança
const auth = {
  jwt: {
    secret: process.env.JWT_SECRET || 'energiaa-crm-secret-key-2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    issuer: process.env.JWT_ISSUER || 'energiaa-crm',
    audience: process.env.JWT_AUDIENCE || 'energiaa-users'
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
  },
  session: {
    secret: process.env.SESSION_SECRET || 'energiaa-session-secret-2024',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 horas
    secure: process.env.SESSION_SECURE === 'true',
    httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
    sameSite: process.env.SESSION_SAME_SITE || 'lax'
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
    maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 86400000,
    sameSite: process.env.COOKIE_SAME_SITE || 'lax'
  },
  passwordPolicy: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    maxAge: parseInt(process.env.PASSWORD_MAX_AGE) || 90 // dias
  }
};

// Configurações do WhatsApp
const whatsapp = {
  sessionPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions',
  webhook: {
    url: process.env.WHATSAPP_WEBHOOK_URL,
    secret: process.env.WHATSAPP_WEBHOOK_SECRET
  },
  puppeteer: {
    headless: process.env.WHATSAPP_HEADLESS !== 'false',
    args: process.env.WHATSAPP_PUPPETEER_ARGS ? 
      process.env.WHATSAPP_PUPPETEER_ARGS.split(',') : 
      ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.WHATSAPP_CHROME_PATH
  },
  timeouts: {
    connection: parseInt(process.env.WHATSAPP_CONNECTION_TIMEOUT) || 60000,
    message: parseInt(process.env.WHATSAPP_MESSAGE_TIMEOUT) || 30000,
    qr: parseInt(process.env.WHATSAPP_QR_TIMEOUT) || 120000
  },
  retry: {
    maxAttempts: parseInt(process.env.WHATSAPP_MAX_RETRY_ATTEMPTS) || 3,
    delay: parseInt(process.env.WHATSAPP_RETRY_DELAY) || 5000
  },
  delays: {
    betweenMessages: parseInt(process.env.WHATSAPP_DELAY_BETWEEN_MESSAGES) || 2000,
    typing: parseInt(process.env.WHATSAPP_TYPING_DELAY) || 1000
  },
  batch: {
    size: parseInt(process.env.WHATSAPP_BATCH_SIZE) || 10,
    delay: parseInt(process.env.WHATSAPP_BATCH_DELAY) || 60000
  },
  rateLimit: {
    messagesPerMinute: parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_MINUTE) || 20,
    messagesPerHour: parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_HOUR) || 100
  }
};

// Configurações da OpenAI
const openai = {
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORGANIZATION,
  model: {
    chat: process.env.OPENAI_CHAT_MODEL || 'gpt-4',
    embedding: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
    whisper: process.env.OPENAI_WHISPER_MODEL || 'whisper-1'
  },
  maxTokens: {
    chat: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
    completion: parseInt(process.env.OPENAI_MAX_COMPLETION_TOKENS) || 1000
  },
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
  timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
  retries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
  chatbot: {
    enabled: process.env.CHATBOT_ENABLED === 'true',
    autoResponse: process.env.CHATBOT_AUTO_RESPONSE === 'true',
    fallbackMessage: process.env.CHATBOT_FALLBACK_MESSAGE || 'Desculpe, não consegui processar sua mensagem. Um atendente entrará em contato em breve.'
  }
};

// Configurações de e-mail
const email = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    pool: process.env.SMTP_POOL === 'true',
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS) || 5,
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES) || 100
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Energiaa CRM',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@energiaa.com'
  },
  templates: {
    path: process.env.EMAIL_TEMPLATES_PATH || './templates/email'
  },
  queue: {
    enabled: process.env.EMAIL_QUEUE_ENABLED === 'true',
    concurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY) || 3,
    delay: parseInt(process.env.EMAIL_QUEUE_DELAY) || 1000
  }
};

// Configurações de upload e mídia
const upload = {
  path: process.env.UPLOAD_PATH || './uploads',
  maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10485760, // 10MB
  allowedTypes: process.env.UPLOAD_ALLOWED_TYPES ? 
    process.env.UPLOAD_ALLOWED_TYPES.split(',') : 
    ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  image: {
    maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH) || 1920,
    maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT) || 1080,
    quality: parseInt(process.env.IMAGE_QUALITY) || 85,
    formats: ['jpeg', 'png', 'webp']
  },
  cleanup: {
    enabled: process.env.UPLOAD_CLEANUP_ENABLED === 'true',
    maxAge: parseInt(process.env.UPLOAD_CLEANUP_MAX_AGE) || 2592000000, // 30 dias
    interval: parseInt(process.env.UPLOAD_CLEANUP_INTERVAL) || 86400000 // 24 horas
  }
};

// Configurações de rate limiting
const rateLimit = {
  global: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false
  },
  auth: {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
    skipSuccessfulRequests: true
  },
  api: {
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 60000, // 1 minuto
    max: parseInt(process.env.API_RATE_LIMIT_MAX) || 60
  },
  whatsapp: {
    windowMs: parseInt(process.env.WHATSAPP_RATE_LIMIT_WINDOW_MS) || 60000, // 1 minuto
    max: parseInt(process.env.WHATSAPP_RATE_LIMIT_MAX) || 10
  }
};

// Configurações de logs
const logging = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'combined',
  file: {
    enabled: process.env.LOG_FILE_ENABLED !== 'false',
    path: process.env.LOG_FILE_PATH || './logs',
    maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES) || 14,
    datePattern: process.env.LOG_FILE_DATE_PATTERN || 'YYYY-MM-DD'
  },
  console: {
    enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
    colorize: process.env.LOG_CONSOLE_COLORIZE !== 'false'
  },
  database: {
    enabled: process.env.LOG_DATABASE_ENABLED === 'true',
    level: process.env.LOG_DATABASE_LEVEL || 'error'
  }
};

// Configurações específicas da Energiaa
const energiaa = {
  company: {
    name: process.env.COMPANY_NAME || 'Energiaa',
    cnpj: process.env.COMPANY_CNPJ || '00.000.000/0001-00',
    address: process.env.COMPANY_ADDRESS || 'Endereço da empresa',
    phone: process.env.COMPANY_PHONE || '(00) 0000-0000',
    email: process.env.COMPANY_EMAIL || 'contato@energiaa.com',
    website: process.env.COMPANY_WEBSITE || 'https://energiaa.com'
  },
  solar: {
    irradiation: {
      default: parseFloat(process.env.SOLAR_IRRADIATION_DEFAULT) || 5.5,
      regions: {
        northeast: parseFloat(process.env.SOLAR_IRRADIATION_NORTHEAST) || 6.2,
        southeast: parseFloat(process.env.SOLAR_IRRADIATION_SOUTHEAST) || 5.8,
        south: parseFloat(process.env.SOLAR_IRRADIATION_SOUTH) || 4.9,
        north: parseFloat(process.env.SOLAR_IRRADIATION_NORTH) || 5.9,
        centerwest: parseFloat(process.env.SOLAR_IRRADIATION_CENTERWEST) || 5.7
      }
    },
    efficiency: {
      panel: parseFloat(process.env.SOLAR_PANEL_EFFICIENCY) || 0.85,
      inverter: parseFloat(process.env.SOLAR_INVERTER_EFFICIENCY) || 0.95,
      system: parseFloat(process.env.SOLAR_SYSTEM_EFFICIENCY) || 0.8
    },
    costs: {
      installationPerKw: parseFloat(process.env.SOLAR_INSTALLATION_COST_PER_KW) || 4500,
      maintenancePercentage: parseFloat(process.env.SOLAR_MAINTENANCE_PERCENTAGE) || 0.02,
      degradationPerYear: parseFloat(process.env.SOLAR_DEGRADATION_PER_YEAR) || 0.005
    },
    financing: {
      maxYears: parseInt(process.env.SOLAR_FINANCING_MAX_YEARS) || 20,
      interestRate: parseFloat(process.env.SOLAR_FINANCING_INTEREST_RATE) || 0.12,
      downPaymentMin: parseFloat(process.env.SOLAR_FINANCING_DOWN_PAYMENT_MIN) || 0.2
    }
  }
};

// Configurações de simulação
const simulation = {
  enabled: process.env.SIMULATION_ENABLED !== 'false',
  cache: {
    enabled: process.env.SIMULATION_CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.SIMULATION_CACHE_TTL) || 3600
  },
  validation: {
    minConsumption: parseInt(process.env.SIMULATION_MIN_CONSUMPTION) || 100,
    maxConsumption: parseInt(process.env.SIMULATION_MAX_CONSUMPTION) || 50000,
    minTariff: parseFloat(process.env.SIMULATION_MIN_TARIFF) || 0.3,
    maxTariff: parseFloat(process.env.SIMULATION_MAX_TARIFF) || 2.0
  }
};

// Configurações de métricas
const metrics = {
  enabled: process.env.METRICS_ENABLED === 'true',
  interval: parseInt(process.env.METRICS_COLLECTION_INTERVAL) || 60000, // 1 minuto
  retention: {
    raw: parseInt(process.env.METRICS_RAW_RETENTION) || 86400000, // 24 horas
    aggregated: parseInt(process.env.METRICS_AGGREGATED_RETENTION) || 2592000000 // 30 dias
  },
  alerts: {
    enabled: process.env.METRICS_ALERTS_ENABLED === 'true',
    thresholds: {
      cpu: parseInt(process.env.METRICS_CPU_THRESHOLD) || 80,
      memory: parseInt(process.env.METRICS_MEMORY_THRESHOLD) || 85,
      responseTime: parseInt(process.env.METRICS_RESPONSE_TIME_THRESHOLD) || 5000
    }
  }
};

// Configurações de backup
const backup = {
  enabled: process.env.BACKUP_ENABLED === 'true',
  schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 2:00 AM diariamente
  retention: {
    daily: parseInt(process.env.BACKUP_RETENTION_DAILY) || 7,
    weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY) || 4,
    monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY) || 12
  },
  storage: {
    local: {
      enabled: process.env.BACKUP_LOCAL_ENABLED !== 'false',
      path: process.env.BACKUP_LOCAL_PATH || './backups'
    },
    s3: {
      enabled: process.env.BACKUP_S3_ENABLED === 'true',
      bucket: process.env.BACKUP_S3_BUCKET,
      region: process.env.BACKUP_S3_REGION || 'us-east-1',
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY
    }
  },
  compression: {
    enabled: process.env.BACKUP_COMPRESSION_ENABLED !== 'false',
    level: parseInt(process.env.BACKUP_COMPRESSION_LEVEL) || 6
  }
};

// Configurações de campanhas
const campaigns = {
  maxConcurrent: parseInt(process.env.CAMPAIGNS_MAX_CONCURRENT) || 5,
  batchSize: parseInt(process.env.CAMPAIGNS_BATCH_SIZE) || 100,
  delay: {
    betweenBatches: parseInt(process.env.CAMPAIGNS_DELAY_BETWEEN_BATCHES) || 60000,
    betweenMessages: parseInt(process.env.CAMPAIGNS_DELAY_BETWEEN_MESSAGES) || 5000
  },
  retry: {
    maxAttempts: parseInt(process.env.CAMPAIGNS_MAX_RETRY_ATTEMPTS) || 3,
    delay: parseInt(process.env.CAMPAIGNS_RETRY_DELAY) || 30000
  },
  tracking: {
    enabled: process.env.CAMPAIGNS_TRACKING_ENABLED !== 'false',
    pixelEnabled: process.env.CAMPAIGNS_PIXEL_TRACKING_ENABLED === 'true'
  }
};

// Configurações de cache
const cache = {
  enabled: process.env.CACHE_ENABLED === 'true',
  defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL) || 3600,
  maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 10000,
  checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600,
  useClones: process.env.CACHE_USE_CLONES !== 'false'
};

// Configurações de localização
const localization = {
  timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
  locale: process.env.LOCALE || 'pt-BR',
  currency: process.env.CURRENCY || 'BRL',
  dateFormat: process.env.DATE_FORMAT || 'DD/MM/YYYY',
  timeFormat: process.env.TIME_FORMAT || 'HH:mm:ss'
};

// Feature flags
const features = {
  whatsappIntegration: process.env.FEATURE_WHATSAPP_INTEGRATION !== 'false',
  aiChatbot: process.env.FEATURE_AI_CHATBOT === 'true',
  solarSimulation: process.env.FEATURE_SOLAR_SIMULATION !== 'false',
  ocrProcessing: process.env.FEATURE_OCR_PROCESSING === 'true',
  proposalGeneration: process.env.FEATURE_PROPOSAL_GENERATION === 'true',
  campaignAutomation: process.env.FEATURE_CAMPAIGN_AUTOMATION === 'true',
  advancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS === 'true',
  multiTenant: process.env.FEATURE_MULTI_TENANT === 'true',
  apiRateLimit: process.env.FEATURE_API_RATE_LIMIT !== 'false',
  realTimeNotifications: process.env.FEATURE_REAL_TIME_NOTIFICATIONS === 'true'
};

// Configurações de desenvolvimento
const development = {
  hotReload: process.env.DEV_HOT_RELOAD === 'true',
  debugMode: process.env.DEV_DEBUG_MODE === 'true',
  mockData: process.env.DEV_MOCK_DATA === 'true',
  skipAuth: process.env.DEV_SKIP_AUTH === 'true',
  verboseLogging: process.env.DEV_VERBOSE_LOGGING === 'true'
};

// Configurações de teste
const testing = {
  enabled: process.env.TESTING_ENABLED === 'true',
  coverage: {
    enabled: process.env.TEST_COVERAGE_ENABLED === 'true',
    threshold: parseInt(process.env.TEST_COVERAGE_THRESHOLD) || 80
  },
  timeout: parseInt(process.env.TEST_TIMEOUT) || 30000,
  parallel: process.env.TEST_PARALLEL === 'true',
  retries: parseInt(process.env.TEST_RETRIES) || 2
};

// Validar variáveis obrigatórias em produção
if (server.env === 'production') {
  const requiredVars = [
    'JWT_SECRET',
    'MONGODB_URI',
    'OPENAI_API_KEY'
  ];
  
  validateRequiredEnvVars(requiredVars);
}

// Criar diretórios necessários
const requiredDirs = [
  upload.path,
  logging.file.path,
  whatsapp.sessionPath,
  backup.storage.local.path,
  email.templates.path
];

requiredDirs.forEach(ensureDirectoryExists);

// Configuração principal
const config = {
  server,
  database,
  auth,
  whatsapp,
  openai,
  email,
  upload,
  rateLimit,
  logging,
  energiaa,
  simulation,
  metrics,
  backup,
  campaigns,
  cache,
  localization,
  features,
  development,
  testing,
  
  // Métodos utilitários
  isDevelopment: () => server.env === 'development',
  isProduction: () => server.env === 'production',
  isTesting: () => server.env === 'test',
  
  // Função para obter configuração por caminho
  get: (path, defaultValue = null) => {
    const keys = path.split('.');
    let current = config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  },
  
  // Função para validar configuração
  validate: () => {
    const errors = [];
    
    // Validações básicas
    if (!config.server.port || config.server.port < 1 || config.server.port > 65535) {
      errors.push('Porta do servidor inválida');
    }
    
    if (!config.database.mongodb.uri) {
      errors.push('URI do MongoDB não configurada');
    }
    
    if (config.features.aiChatbot && !config.openai.apiKey) {
      errors.push('Chave da API OpenAI necessária para chatbot IA');
    }
    
    if (config.email.smtp.auth.user && !config.email.smtp.auth.pass) {
      errors.push('Senha SMTP necessária quando usuário SMTP está configurado');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

module.exports = config;