const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const NodeCache = require('node-cache');

// Cache para tokens e sessões
const tokenCache = new NodeCache({ stdTTL: 3600 }); // 1 hora
const sessionCache = new NodeCache({ stdTTL: 86400 }); // 24 horas
const blacklistCache = new NodeCache({ stdTTL: 86400 * 7 }); // 7 dias

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/auth.log' }),
    new winston.transports.Console()
  ]
});

// Rate limiting para tentativas de login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || req.body.username || 'unknown');
  }
});

// Rate limiting para operações sensíveis
const sensitiveOperationsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 operações por minuto
  message: {
    error: 'Muitas operações sensíveis. Tente novamente em 1 minuto.',
    code: 'SENSITIVE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Configurações JWT
const JWT_SECRET = process.env.JWT_SECRET || 'energiaa-crm-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Roles e permissões
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  VIEWER: 'viewer'
};

const PERMISSIONS = {
  // Usuários
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // Clientes
  CLIENT_CREATE: 'client:create',
  CLIENT_READ: 'client:read',
  CLIENT_UPDATE: 'client:update',
  CLIENT_DELETE: 'client:delete',
  
  // Campanhas
  CAMPAIGN_CREATE: 'campaign:create',
  CAMPAIGN_READ: 'campaign:read',
  CAMPAIGN_UPDATE: 'campaign:update',
  CAMPAIGN_DELETE: 'campaign:delete',
  CAMPAIGN_EXECUTE: 'campaign:execute',
  
  // WhatsApp
  WHATSAPP_SEND: 'whatsapp:send',
  WHATSAPP_MANAGE: 'whatsapp:manage',
  WHATSAPP_CONFIG: 'whatsapp:config',
  
  // Propostas
  PROPOSAL_CREATE: 'proposal:create',
  PROPOSAL_READ: 'proposal:read',
  PROPOSAL_UPDATE: 'proposal:update',
  PROPOSAL_DELETE: 'proposal:delete',
  
  // OCR
  OCR_PROCESS: 'ocr:process',
  OCR_MANAGE: 'ocr:manage',
  
  // Prompts
  PROMPT_CREATE: 'prompt:create',
  PROMPT_READ: 'prompt:read',
  PROMPT_UPDATE: 'prompt:update',
  PROMPT_DELETE: 'prompt:delete',
  PROMPT_EXECUTE: 'prompt:execute',
  
  // Testes
  TEST_RUN: 'test:run',
  TEST_MANAGE: 'test:manage',
  
  // Sistema
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_LOGS: 'system:logs',
  SYSTEM_BACKUP: 'system:backup'
};

// Mapeamento de roles para permissões
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.CLIENT_DELETE,
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_UPDATE,
    PERMISSIONS.CAMPAIGN_DELETE,
    PERMISSIONS.CAMPAIGN_EXECUTE,
    PERMISSIONS.WHATSAPP_SEND,
    PERMISSIONS.WHATSAPP_MANAGE,
    PERMISSIONS.PROPOSAL_CREATE,
    PERMISSIONS.PROPOSAL_READ,
    PERMISSIONS.PROPOSAL_UPDATE,
    PERMISSIONS.PROPOSAL_DELETE,
    PERMISSIONS.OCR_PROCESS,
    PERMISSIONS.OCR_MANAGE,
    PERMISSIONS.PROMPT_CREATE,
    PERMISSIONS.PROMPT_READ,
    PERMISSIONS.PROMPT_UPDATE,
    PERMISSIONS.PROMPT_DELETE,
    PERMISSIONS.PROMPT_EXECUTE,
    PERMISSIONS.TEST_RUN,
    PERMISSIONS.TEST_MANAGE,
    PERMISSIONS.SYSTEM_LOGS
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_UPDATE,
    PERMISSIONS.CAMPAIGN_EXECUTE,
    PERMISSIONS.WHATSAPP_SEND,
    PERMISSIONS.PROPOSAL_CREATE,
    PERMISSIONS.PROPOSAL_READ,
    PERMISSIONS.PROPOSAL_UPDATE,
    PERMISSIONS.OCR_PROCESS,
    PERMISSIONS.PROMPT_READ,
    PERMISSIONS.PROMPT_EXECUTE,
    PERMISSIONS.TEST_RUN
  ],
  [ROLES.AGENT]: [
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.WHATSAPP_SEND,
    PERMISSIONS.PROPOSAL_CREATE,
    PERMISSIONS.PROPOSAL_READ,
    PERMISSIONS.OCR_PROCESS,
    PERMISSIONS.PROMPT_READ,
    PERMISSIONS.PROMPT_EXECUTE
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.PROPOSAL_READ,
    PERMISSIONS.PROMPT_READ
  ]
};

// Função para gerar token JWT
const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Função para gerar refresh token
const generateRefreshToken = (userId) => {
  const payload = { userId, type: 'refresh' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

// Função para verificar token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido');
  }
};

// Função para hash de senha
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Função para verificar senha
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de acesso requerido',
        code: 'MISSING_TOKEN'
      });
    }

    // Verificar se o token está na blacklist
    if (blacklistCache.get(token)) {
      return res.status(401).json({
        success: false,
        error: 'Token revogado',
        code: 'REVOKED_TOKEN'
      });
    }

    // Verificar cache primeiro
    let decoded = tokenCache.get(token);
    
    if (!decoded) {
      decoded = verifyToken(token);
      tokenCache.set(token, decoded);
    }

    // Simular busca do usuário no banco de dados
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: 'Usuário inativo',
        code: 'USER_INACTIVE'
      });
    }

    // Adicionar informações do usuário à requisição
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role] || [],
      lastLogin: user.lastLogin,
      sessionId: decoded.sessionId
    };

    // Atualizar último acesso
    await updateLastAccess(user.id);

    next();
  } catch (error) {
    logger.error('Erro na autenticação:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno de autenticação'
    });
  }
};

// Middleware de autorização por role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Tentativa de acesso negado:', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        endpoint: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'INSUFFICIENT_ROLE',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// Middleware de autorização por permissão
const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    const hasPermission = requiredPermissions.every(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn('Tentativa de acesso negado por permissão:', {
        userId: req.user.id,
        userPermissions: req.user.permissions,
        requiredPermissions,
        endpoint: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        required: requiredPermissions
      });
    }

    next();
  };
};

// Middleware de autenticação opcional
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token && !blacklistCache.get(token)) {
      const decoded = verifyToken(token);
      const user = await getUserById(decoded.userId);
      
      if (user && user.active) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: ROLE_PERMISSIONS[user.role] || []
        };
      }
    }
  } catch (error) {
    // Ignorar erros na autenticação opcional
    logger.debug('Erro na autenticação opcional:', error.message);
  }

  next();
};

// Middleware para verificar propriedade de recurso
const requireOwnership = (resourceIdParam = 'id', userIdField = 'userId') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      
      // Super admin pode acessar tudo
      if (req.user.role === ROLES.SUPER_ADMIN) {
        return next();
      }

      // Verificar propriedade do recurso
      const resource = await getResourceById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Recurso não encontrado'
        });
      }

      if (resource[userIdField] !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado - recurso não pertence ao usuário',
          code: 'NOT_OWNER'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.error('Erro na verificação de propriedade:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  };
};

// Middleware para logout
const logout = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // Adicionar token à blacklist
    blacklistCache.set(token, true);
    
    // Remover do cache de tokens
    tokenCache.del(token);
    
    // Remover sessão
    if (req.user && req.user.sessionId) {
      sessionCache.del(req.user.sessionId);
    }

    logger.info('Logout realizado:', {
      userId: req.user?.id,
      sessionId: req.user?.sessionId
    });
  }

  next();
};

// Middleware para verificar sessão ativa
const requireActiveSession = (req, res, next) => {
  if (!req.user || !req.user.sessionId) {
    return res.status(401).json({
      success: false,
      error: 'Sessão inválida'
    });
  }

  const session = sessionCache.get(req.user.sessionId);
  
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Sessão expirada',
      code: 'SESSION_EXPIRED'
    });
  }

  // Atualizar TTL da sessão
  sessionCache.ttl(req.user.sessionId, 86400); // 24 horas

  next();
};

// Funções auxiliares (simuladas - devem ser implementadas com banco de dados real)
const getUserById = async (userId) => {
  // Simular busca no banco de dados
  const users = {
    '1': {
      id: '1',
      email: 'admin@energiaa.com',
      name: 'Administrador',
      role: ROLES.ADMIN,
      active: true,
      lastLogin: new Date()
    },
    '2': {
      id: '2',
      email: 'agent@energiaa.com',
      name: 'Agente',
      role: ROLES.AGENT,
      active: true,
      lastLogin: new Date()
    }
  };
  
  return users[userId] || null;
};

const updateLastAccess = async (userId) => {
  // Simular atualização no banco de dados
  logger.debug(`Último acesso atualizado para usuário ${userId}`);
};

const getResourceById = async (resourceId) => {
  // Simular busca de recurso no banco de dados
  return {
    id: resourceId,
    userId: '1', // Exemplo
    name: 'Recurso de exemplo'
  };
};

// Função para criar sessão
const createSession = (userId, metadata = {}) => {
  const sessionId = `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const sessionData = {
    userId,
    createdAt: new Date(),
    lastActivity: new Date(),
    metadata
  };
  
  sessionCache.set(sessionId, sessionData);
  
  return sessionId;
};

// Função para validar força da senha
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Senha deve ter pelo menos ${minLength} caracteres`);
  }
  
  if (!hasUpperCase) {
    errors.push('Senha deve conter pelo menos uma letra maiúscula');
  }
  
  if (!hasLowerCase) {
    errors.push('Senha deve conter pelo menos uma letra minúscula');
  }
  
  if (!hasNumbers) {
    errors.push('Senha deve conter pelo menos um número');
  }
  
  if (!hasSpecialChar) {
    errors.push('Senha deve conter pelo menos um caractere especial');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    score: [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar, password.length >= minLength].filter(Boolean).length
  };
};

module.exports = {
  // Constantes
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  
  // Funções utilitárias
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  createSession,
  
  // Middlewares
  authenticateToken,
  requireRole,
  requirePermission,
  optionalAuth,
  requireOwnership,
  requireActiveSession,
  logout,
  
  // Rate limiters
  loginLimiter,
  sensitiveOperationsLimiter,
  
  // Cache
  tokenCache,
  sessionCache,
  blacklistCache
};