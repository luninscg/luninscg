const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const testService = require('../services/testService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const winston = require('winston');
const multer = require('multer');
const path = require('path');

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/tests-api.log' }),
    new winston.transports.Console()
  ]
});

// Configuração do multer para upload de arquivos de teste
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './tests/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.json', '.csv', '.txt', '.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'), false);
    }
  }
});

// Rate limiting para execução de testes
const testExecutionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 execuções de teste por minuto
  message: {
    error: 'Muitas execuções de teste. Tente novamente em 1 minuto.',
    code: 'TEST_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para operações administrativas
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 operações administrativas por minuto
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
 * @route GET /api/tests
 * @desc Listar todas as suítes de teste
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      status,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    let testSuites = await testService.getTestSuites();

    // Filtros
    if (category) {
      testSuites = testSuites.filter(suite => suite.category === category);
    }

    if (status) {
      testSuites = testSuites.filter(suite => suite.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      testSuites = testSuites.filter(suite => 
        suite.name.toLowerCase().includes(searchLower) ||
        suite.description.toLowerCase().includes(searchLower) ||
        suite.category.toLowerCase().includes(searchLower)
      );
    }

    // Ordenação
    testSuites.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
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
    const paginatedSuites = testSuites.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedSuites,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(testSuites.length / limit),
        totalItems: testSuites.length,
        itemsPerPage: parseInt(limit)
      },
      filters: {
        category,
        status,
        search,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    logger.error('Erro ao listar suítes de teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route GET /api/tests/categories
 * @desc Listar categorias de teste disponíveis
 * @access Private
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      {
        name: 'whatsapp',
        displayName: 'Integração WhatsApp',
        description: 'Testes de conectividade e funcionalidades do WhatsApp'
      },
      {
        name: 'ai',
        displayName: 'Processamento IA',
        description: 'Testes dos serviços de inteligência artificial'
      },
      {
        name: 'simulation',
        displayName: 'Motor de Simulação',
        description: 'Testes do sistema de simulação solar'
      },
      {
        name: 'ocr',
        displayName: 'Processamento OCR',
        description: 'Testes de reconhecimento óptico de caracteres'
      },
      {
        name: 'proposal',
        displayName: 'Geração de Propostas',
        description: 'Testes do sistema de geração de propostas'
      },
      {
        name: 'database',
        displayName: 'Operações de Banco',
        description: 'Testes das operações de banco de dados'
      },
      {
        name: 'api',
        displayName: 'Endpoints da API',
        description: 'Testes dos endpoints da API REST'
      },
      {
        name: 'performance',
        displayName: 'Performance',
        description: 'Testes de performance e carga do sistema'
      }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    logger.error('Erro ao listar categorias de teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/tests/stats
 * @desc Obter estatísticas gerais dos testes
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await testService.getSystemStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Erro ao obter estatísticas de teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/tests/suites
 * @desc Criar nova suíte de teste
 * @access Admin
 */
router.post('/suites', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      tests = []
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Nome e categoria são obrigatórios'
      });
    }

    const suiteData = {
      name,
      description: description || '',
      category,
      tests,
      createdBy: req.user.id,
      createdAt: new Date()
    };

    const suiteId = await testService.createTestSuite(suiteData);

    logger.info(`Suíte de teste criada: ${name} por usuário ${req.user.id}`);

    res.status(201).json({
      success: true,
      data: {
        id: suiteId,
        name,
        category,
        message: 'Suíte de teste criada com sucesso'
      }
    });

  } catch (error) {
    logger.error('Erro ao criar suíte de teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route POST /api/tests/execute/:category
 * @desc Executar suíte de teste por categoria
 * @access Private
 */
router.post('/execute/:category', testExecutionLimiter, async (req, res) => {
  try {
    const { category } = req.params;
    const { options = {} } = req.body;

    const validCategories = ['whatsapp', 'ai', 'simulation', 'ocr', 'proposal', 'database', 'api', 'performance'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Categoria de teste inválida',
        validCategories
      });
    }

    logger.info(`Iniciando execução de testes: ${category} por usuário ${req.user.id}`);

    // Executar testes de forma assíncrona
    const executionId = `test_${category}_${Date.now()}`;
    
    // Não aguardar a execução completa para resposta rápida
    setImmediate(async () => {
      try {
        await testService.runTestSuite(category, {
          ...options,
          executionId,
          userId: req.user.id
        });
      } catch (error) {
        logger.error(`Erro na execução de testes ${category}:`, error);
      }
    });

    res.json({
      success: true,
      data: {
        executionId,
        category,
        status: 'started',
        message: 'Execução de testes iniciada',
        estimatedDuration: getEstimatedDuration(category)
      }
    });

  } catch (error) {
    logger.error(`Erro ao executar testes ${req.params.category}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route GET /api/tests/execution/:executionId
 * @desc Obter status de execução de teste
 * @access Private
 */
router.get('/execution/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    
    const execution = await testService.getExecutionStatus(executionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execução não encontrada'
      });
    }

    res.json({
      success: true,
      data: execution
    });

  } catch (error) {
    logger.error(`Erro ao obter status de execução ${req.params.executionId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/tests/individual
 * @desc Executar teste individual
 * @access Private
 */
router.post('/individual', testExecutionLimiter, async (req, res) => {
  try {
    const {
      testName,
      category,
      testData = {},
      options = {}
    } = req.body;

    if (!testName || !category) {
      return res.status(400).json({
        success: false,
        error: 'Nome do teste e categoria são obrigatórios'
      });
    }

    const result = await testService.runIndividualTest(testName, category, testData, options);

    logger.info(`Teste individual executado: ${testName} (${category}) por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Erro ao executar teste individual:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route GET /api/tests/results
 * @desc Listar resultados de testes
 * @access Private
 */
router.get('/results', async (req, res) => {
  try {
    const {
      category,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = req.query;

    const filters = {};
    
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    const results = await testService.getTestResults(filters, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.error('Erro ao listar resultados de teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/tests/results/:resultId
 * @desc Obter resultado específico de teste
 * @access Private
 */
router.get('/results/:resultId', async (req, res) => {
  try {
    const { resultId } = req.params;
    
    const result = await testService.getTestResult(resultId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Resultado não encontrado'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Erro ao obter resultado ${req.params.resultId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/tests/mock-data
 * @desc Gerar dados mock para testes
 * @access Admin
 */
router.post('/mock-data', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const {
      type,
      count = 10,
      options = {}
    } = req.body;

    const validTypes = ['clients', 'messages', 'invoices'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de dados mock inválido',
        validTypes
      });
    }

    const mockData = await testService.generateMockData(type, count, options);

    logger.info(`Dados mock gerados: ${type} (${count}) por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        type,
        count: mockData.length,
        data: mockData
      }
    });

  } catch (error) {
    logger.error('Erro ao gerar dados mock:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route POST /api/tests/upload
 * @desc Upload de arquivos para testes
 * @access Private
 */
router.post('/upload', upload.array('testFiles', 5), async (req, res) => {
  try {
    const { testType, description } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));

    logger.info(`Arquivos de teste enviados: ${uploadedFiles.length} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        testType,
        description,
        files: uploadedFiles,
        message: 'Arquivos enviados com sucesso'
      }
    });

  } catch (error) {
    logger.error('Erro no upload de arquivos de teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route POST /api/tests/reports/generate
 * @desc Gerar relatório de testes
 * @access Private
 */
router.post('/reports/generate', adminLimiter, async (req, res) => {
  try {
    const {
      category,
      dateFrom,
      dateTo,
      format = 'json',
      includeDetails = false
    } = req.body;

    const reportData = {
      category,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
      format,
      includeDetails,
      generatedBy: req.user.id,
      generatedAt: new Date()
    };

    const report = await testService.generateTestReport(reportData);

    logger.info(`Relatório de testes gerado por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Erro ao gerar relatório de testes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/tests/results/cleanup
 * @desc Limpar resultados antigos de testes
 * @access Admin
 */
router.delete('/results/cleanup', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.query;
    
    const cleanupResult = await testService.cleanupTestResults(parseInt(olderThanDays));

    logger.info(`Limpeza de resultados executada: ${cleanupResult.deletedCount} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: cleanupResult
    });

  } catch (error) {
    logger.error('Erro na limpeza de resultados:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/tests/health
 * @desc Verificar saúde do sistema de testes
 * @access Private
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await testService.getSystemStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      stats,
      checks: {
        testSuitesAvailable: stats.totalSuites > 0,
        recentExecutions: stats.recentExecutions > 0,
        successRate: stats.successRate > 80, // mais de 80%
        averageExecutionTime: stats.avgExecutionTime < 30000 // menos de 30 segundos
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
    logger.error('Erro ao verificar saúde dos testes:', error);
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

// Função auxiliar para estimar duração dos testes
function getEstimatedDuration(category) {
  const durations = {
    whatsapp: '2-3 minutos',
    ai: '3-5 minutos',
    simulation: '1-2 minutos',
    ocr: '4-6 minutos',
    proposal: '2-3 minutos',
    database: '1-2 minutos',
    api: '3-4 minutos',
    performance: '5-10 minutos'
  };
  
  return durations[category] || '2-5 minutos';
}

module.exports = router;