/**
 * ROTAS DE AUTENTICAÇÃO
 * Sistema de login e controle de acesso para Energiaa CRM
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Rate limiting para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Usuários padrão (em produção, usar banco de dados)
const users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@energiaa.com.br',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'admin',
    name: 'Administrador',
    permissions: ['all']
  },
  {
    id: 2,
    username: 'vendedor',
    email: 'vendedor@energiaa.com.br',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'sales',
    name: 'Vendedor',
    permissions: ['clients:read', 'clients:write', 'campaigns:read', 'messages:read', 'simulation:all']
  },
  {
    id: 3,
    username: 'marketing',
    email: 'marketing@energiaa.com.br',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'marketing',
    name: 'Marketing',
    permissions: ['campaigns:all', 'clients:read', 'messages:read', 'metrics:read']
  }
];

/**
 * @route POST /api/auth/login
 * @desc Login do usuário
 * @access Public
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    
    // Validação
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username e senha são obrigatórios'
      });
    }
    
    // Buscar usuário
    const user = users.find(u => 
      u.username === username || u.email === username
    );
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }
    
    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }
    
    // Gerar token JWT
    const tokenExpiry = rememberMe ? '30d' : '24h';
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry }
    );
    
    // Dados do usuário (sem senha)
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions
    };
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: userData,
      expiresIn: rememberMe ? '30 dias' : '24 horas'
    });
    
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout do usuário
 * @access Private
 */
router.post('/logout', (req, res) => {
  // Em uma implementação real, você poderia invalidar o token
  // adicionando-o a uma blacklist no Redis ou banco de dados
  
  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
});

/**
 * @route GET /api/auth/me
 * @desc Obter dados do usuário atual
 * @access Private
 */
router.get('/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Usuário não encontrado'
    });
  }
  
  const userData = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions
  };
  
  res.json({
    success: true,
    user: userData
  });
});

/**
 * @route POST /api/auth/refresh
 * @desc Renovar token JWT
 * @access Private
 */
router.post('/refresh', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Gerar novo token
    const newToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token: newToken,
      message: 'Token renovado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/auth/change-password
 * @desc Alterar senha do usuário
 * @access Private
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Todos os campos são obrigatórios'
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha e confirmação não coincidem'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }
    
    // Buscar usuário
    const userIndex = users.findIndex(u => u.id === req.user.userId);
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    const user = users[userIndex];
    
    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Senha atual incorreta'
      });
    }
    
    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Atualizar senha (em produção, salvar no banco)
    users[userIndex].password = hashedPassword;
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/auth/permissions
 * @desc Obter permissões do usuário
 * @access Private
 */
router.get('/permissions', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Usuário não encontrado'
    });
  }
  
  res.json({
    success: true,
    permissions: user.permissions,
    role: user.role
  });
});

/**
 * Middleware de autenticação
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token de acesso requerido'
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(403).json({
        success: false,
        error: 'Token inválido'
      });
    }
    
    req.user = user;
    next();
  });
}

/**
 * Middleware de autorização
 */
function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }
    
    const user = users.find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Admin tem todas as permissões
    if (user.role === 'admin' || user.permissions.includes('all')) {
      return next();
    }
    
    // Verificar permissão específica
    if (!user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'Permissão insuficiente',
        required: permission
      });
    }
    
    next();
  };
}

// Exportar middlewares para uso em outras rotas
module.exports = {
  router,
  authenticateToken,
  authorize
};