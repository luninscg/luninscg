const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const promptService = require('../services/promptService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validatePromptData, validatePromptExecution } = require('../middleware/validation');
const winston = require('winston');

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/prompts-api.log' }),
    new winston.transports.Console()
  ]
});

// Rate limiting para execução de prompts
const promptExecutionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // máximo 100 execuções por minuto
  message: {
    error: 'Muitas execuções de prompt. Tente novamente em 1 minuto.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para operações administrativas
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // máximo 20 operações administrativas por minuto
  message: {
    error: 'Muitas operações administrativas. Tente novamente em 1 minuto.',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route GET /api/prompts
 * @desc Listar todos os prompts
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      active,
      search,
      sortBy = 'category',
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    let prompts = await promptService.getAllPrompts();

    // Filtros
    if (category) {
      prompts = prompts.filter(p => p.category === category);
    }

    if (active !== undefined) {
      const isActive = active === 'true';
      prompts = prompts.filter(p => p.active === isActive);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      prompts = prompts.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower)
      );
    }

    // Ordenação
    prompts.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'usage' && a.metrics && b.metrics) {
        aVal = a.metrics.usage || 0;
        bVal = b.metrics.usage || 0;
      }
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    // Paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedPrompts = prompts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedPrompts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(prompts.length / limit),
        totalItems: prompts.length,
        itemsPerPage: parseInt(limit)
      },
      filters: {
        category,
        active,
        search,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    logger.error('Erro ao listar prompts:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route GET /api/prompts/categories
 * @desc Listar categorias de prompts disponíveis
 * @access Private
 */
router.get('/categories', async (req, res) => {
  try {
    const prompts = await promptService.getAllPrompts();
    const categories = [...new Set(prompts.map(p => p.category))];
    
    const categoriesWithCount = categories.map(category => {
      const categoryPrompts = prompts.filter(p => p.category === category);
      return {
        name: category,
        count: categoryPrompts.length,
        activeCount: categoryPrompts.filter(p => p.active).length
      };
    });

    res.json({
      success: true,
      data: categoriesWithCount
    });

  } catch (error) {
    logger.error('Erro ao listar categorias:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/prompts/stats
 * @desc Obter estatísticas gerais dos prompts
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await promptService.getSystemStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/prompts/:category
 * @desc Obter prompt específico por categoria
 * @access Private
 */
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { includeMetrics = true } = req.query;

    const prompt = await promptService.getPrompt(category);
    
    let response = { ...prompt };
    
    if (includeMetrics === 'true') {
      const metrics = await promptService.getPromptMetrics(category);
      response.metrics = metrics;
    }

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error(`Erro ao obter prompt ${req.params.category}:`, error);
    
    if (error.message.includes('não ativo') || error.message.includes('não encontrado')) {
      res.status(404).json({
        success: false,
        error: 'Prompt não encontrado',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
});

/**
 * @route POST /api/prompts
 * @desc Criar novo prompt
 * @access Admin
 */
router.post('/', requireRole('admin'), adminLimiter, validatePromptData, async (req, res) => {
  try {
    const {
      category,
      name,
      description,
      template,
      parameters = {},
      version = '1.0'
    } = req.body;

    const promptData = {
      name,
      description,
      template,
      parameters: {
        temperature: 0.7,
        max_tokens: 500,
        top_p: 0.9,
        ...parameters
      },
      version,
      active: true
    };

    const promptId = await promptService.createPrompt(category, promptData);

    logger.info(`Prompt criado: ${category} por usuário ${req.user.id}`);

    res.status(201).json({
      success: true,
      data: {
        id: promptId,
        category,
        message: 'Prompt criado com sucesso'
      }
    });

  } catch (error) {
    logger.error('Erro ao criar prompt:', error);
    
    if (error.message.includes('já existe')) {
      res.status(409).json({
        success: false,
        error: 'Prompt já existe',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
});

/**
 * @route PUT /api/prompts/:category
 * @desc Atualizar prompt existente
 * @access Admin
 */
router.put('/:category', requireRole('admin'), adminLimiter, validatePromptData, async (req, res) => {
  try {
    const { category } = req.params;
    const updates = req.body;

    // Remover campos que não devem ser atualizados diretamente
    delete updates.id;
    delete updates.createdAt;
    delete updates.metrics;

    const updatedPrompt = await promptService.updatePrompt(category, updates);

    logger.info(`Prompt atualizado: ${category} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: updatedPrompt,
      message: 'Prompt atualizado com sucesso'
    });

  } catch (error) {
    logger.error(`Erro ao atualizar prompt ${req.params.category}:`, error);
    
    if (error.message.includes('não encontrado')) {
      res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
});

/**
 * @route POST /api/prompts/:category/execute
 * @desc Executar prompt com variáveis
 * @access Private
 */
router.post('/:category/execute', promptExecutionLimiter, validatePromptExecution, async (req, res) => {
  try {
    const { category } = req.params;
    const { variables = {}, options = {} } = req.body;

    const result = await promptService.executePrompt(category, variables, options);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Erro ao executar prompt ${req.params.category}:`, error);
    
    if (error.message.includes('não ativo') || error.message.includes('não encontrado')) {
      res.status(404).json({
        success: false,
        error: 'Prompt não encontrado ou inativo'
      });
    } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
      res.status(429).json({
        success: false,
        error: 'Limite de uso da API atingido'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro na execução do prompt',
        message: error.message
      });
    }
  }
});

/**
 * @route POST /api/prompts/:category/test
 * @desc Testar prompt com dados de teste
 * @access Admin
 */
router.post('/:category/test', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const { category } = req.params;
    const { testData } = req.body;

    if (!testData || !Array.isArray(testData)) {
      return res.status(400).json({
        success: false,
        error: 'Dados de teste inválidos',
        message: 'testData deve ser um array de objetos de teste'
      });
    }

    const results = await promptService.testPrompt(category, testData);

    logger.info(`Teste de prompt executado: ${category} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.error(`Erro ao testar prompt ${req.params.category}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro no teste do prompt',
      message: error.message
    });
  }
});

/**
 * @route PATCH /api/prompts/:category/toggle
 * @desc Ativar/desativar prompt
 * @access Admin
 */
router.patch('/:category/toggle', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const { category } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro active deve ser boolean'
      });
    }

    await promptService.togglePrompt(category, active);

    logger.info(`Prompt ${active ? 'ativado' : 'desativado'}: ${category} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        category,
        active,
        message: `Prompt ${active ? 'ativado' : 'desativado'} com sucesso`
      }
    });

  } catch (error) {
    logger.error(`Erro ao alterar status do prompt ${req.params.category}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/prompts/:category/versions
 * @desc Listar versões do prompt
 * @access Admin
 */
router.get('/:category/versions', requireRole('admin'), async (req, res) => {
  try {
    const { category } = req.params;
    
    const versions = await promptService.getPromptVersions(category);

    res.json({
      success: true,
      data: versions
    });

  } catch (error) {
    logger.error(`Erro ao listar versões do prompt ${req.params.category}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/prompts/:category/revert
 * @desc Reverter prompt para versão anterior
 * @access Admin
 */
router.post('/:category/revert', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const { category } = req.params;
    const { versionFile } = req.body;

    if (!versionFile) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo de versão é obrigatório'
      });
    }

    await promptService.revertPromptVersion(category, versionFile);

    logger.info(`Prompt revertido: ${category} para ${versionFile} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        category,
        versionFile,
        message: 'Prompt revertido com sucesso'
      }
    });

  } catch (error) {
    logger.error(`Erro ao reverter prompt ${req.params.category}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/prompts/:category/metrics
 * @desc Obter métricas detalhadas do prompt
 * @access Private
 */
router.get('/:category/metrics', async (req, res) => {
  try {
    const { category } = req.params;
    const { period = '7d' } = req.query;

    const metrics = await promptService.getPromptMetrics(category);
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Métricas não encontradas para este prompt'
      });
    }

    res.json({
      success: true,
      data: {
        ...metrics,
        period
      }
    });

  } catch (error) {
    logger.error(`Erro ao obter métricas do prompt ${req.params.category}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route DELETE /api/prompts/:category
 * @desc Deletar prompt
 * @access Admin
 */
router.delete('/:category', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const { category } = req.params;
    const { confirm } = req.query;

    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Confirmação necessária',
        message: 'Adicione ?confirm=true para confirmar a exclusão'
      });
    }

    await promptService.deletePrompt(category);

    logger.info(`Prompt deletado: ${category} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        category,
        message: 'Prompt deletado com sucesso'
      }
    });

  } catch (error) {
    logger.error(`Erro ao deletar prompt ${req.params.category}:`, error);
    
    if (error.message.includes('não encontrado')) {
      res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
});

/**
 * @route POST /api/prompts/export
 * @desc Exportar todos os prompts
 * @access Admin
 */
router.post('/export', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const exportPath = await promptService.exportPrompts();
    
    logger.info(`Prompts exportados por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        exportPath,
        message: 'Prompts exportados com sucesso'
      }
    });

  } catch (error) {
    logger.error('Erro ao exportar prompts:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/prompts/import
 * @desc Importar prompts de arquivo
 * @access Admin
 */
router.post('/import', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'Caminho do arquivo é obrigatório'
      });
    }

    await promptService.importPrompts(filePath);

    logger.info(`Prompts importados de ${filePath} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        filePath,
        message: 'Prompts importados com sucesso'
      }
    });

  } catch (error) {
    logger.error('Erro ao importar prompts:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route POST /api/prompts/batch-execute
 * @desc Executar múltiplos prompts em lote
 * @access Private
 */
router.post('/batch-execute', promptExecutionLimiter, async (req, res) => {
  try {
    const { executions } = req.body;

    if (!executions || !Array.isArray(executions)) {
      return res.status(400).json({
        success: false,
        error: 'Executions deve ser um array'
      });
    }

    if (executions.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 10 execuções por lote'
      });
    }

    const results = [];
    
    for (const execution of executions) {
      try {
        const result = await promptService.executePrompt(
          execution.category,
          execution.variables || {},
          execution.options || {}
        );
        
        results.push({
          category: execution.category,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          category: execution.category,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: executions.length,
          successful: successCount,
          failed: executions.length - successCount
        }
      }
    });

  } catch (error) {
    logger.error('Erro na execução em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/prompts/health
 * @desc Verificar saúde do sistema de prompts
 * @access Private
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await promptService.getSystemStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      stats,
      checks: {
        promptsLoaded: stats.totalPrompts > 0,
        activePrompts: stats.activePrompts > 0,
        averageResponseTime: stats.avgResponseTime < 5000, // menos de 5 segundos
        successRate: stats.successRate > 90 // mais de 90%
      }
    };

    // Determinar status geral
    const failedChecks = Object.values(health.checks).filter(check => !check).length;
    
    if (failedChecks === 0) {
      health.status = 'healthy';
    } else if (failedChecks <= 2) {
      health.status = 'degraded';
    } else {
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error('Erro ao verificar saúde dos prompts:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      }
    });
  }
});

module.exports = router;