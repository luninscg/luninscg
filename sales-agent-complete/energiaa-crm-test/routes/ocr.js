const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const ocrService = require('../services/ocrService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const winston = require('winston');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/ocr-api.log' }),
    new winston.transports.Console()
  ]
});

// Configuração do multer para upload de faturas
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/invoices/';
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `invoice-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG, PNG, TIFF ou BMP'), false);
    }
  }
});

// Rate limiting para processamento OCR
const ocrLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // máximo 20 processamentos por minuto
  message: {
    error: 'Muitos processamentos OCR. Tente novamente em 1 minuto.',
    code: 'OCR_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para upload em lote
const batchUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // máximo 5 uploads em lote por 5 minutos
  message: {
    error: 'Muitos uploads em lote. Tente novamente em 5 minutos.',
    code: 'BATCH_UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route POST /api/ocr/process
 * @desc Processar fatura individual
 * @access Private
 */
router.post('/process', ocrLimiter, upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const {
      clientId,
      validateData = true,
      associateClient = true,
      extractHistorical = true
    } = req.body;

    const options = {
      validateData: validateData === 'true',
      associateClient: associateClient === 'true',
      extractHistorical: extractHistorical === 'true',
      userId: req.user.id
    };

    logger.info(`Iniciando processamento OCR: ${req.file.filename} por usuário ${req.user.id}`);

    const result = await ocrService.processInvoice(req.file.path, options);

    // Se clientId foi fornecido, tentar associar
    if (clientId && options.associateClient) {
      try {
        await ocrService.associateInvoiceToClient(result.invoiceData, clientId);
        result.clientAssociation = {
          success: true,
          clientId
        };
      } catch (error) {
        logger.warn(`Erro ao associar fatura ao cliente ${clientId}:`, error);
        result.clientAssociation = {
          success: false,
          error: error.message
        };
      }
    }

    // Limpar arquivo temporário após processamento
    setTimeout(() => {
      fs.remove(req.file.path).catch(err => 
        logger.warn(`Erro ao remover arquivo temporário ${req.file.path}:`, err)
      );
    }, 5000);

    logger.info(`OCR processado com sucesso: ${req.file.filename}`);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        processedAt: new Date(),
        ...result
      }
    });

  } catch (error) {
    logger.error('Erro no processamento OCR:', error);
    
    // Limpar arquivo em caso de erro
    if (req.file) {
      fs.remove(req.file.path).catch(err => 
        logger.warn(`Erro ao remover arquivo após falha ${req.file.path}:`, err)
      );
    }

    if (error.message.includes('formato não suportado')) {
      res.status(400).json({
        success: false,
        error: 'Formato de arquivo não suportado',
        message: error.message
      });
    } else if (error.message.includes('qualidade')) {
      res.status(400).json({
        success: false,
        error: 'Qualidade da imagem insuficiente',
        message: error.message,
        suggestions: [
          'Verifique se a imagem está nítida',
          'Certifique-se de que o texto está legível',
          'Tente uma resolução maior',
          'Evite sombras ou reflexos'
        ]
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro no processamento OCR',
        message: error.message
      });
    }
  }
});

/**
 * @route POST /api/ocr/batch
 * @desc Processar múltiplas faturas em lote
 * @access Private
 */
router.post('/batch', batchUploadLimiter, upload.array('invoices', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const {
      validateData = true,
      associateClients = true,
      extractHistorical = true,
      continueOnError = true
    } = req.body;

    const options = {
      validateData: validateData === 'true',
      associateClients: associateClients === 'true',
      extractHistorical: extractHistorical === 'true',
      continueOnError: continueOnError === 'true',
      userId: req.user.id
    };

    const filePaths = req.files.map(file => file.path);

    logger.info(`Iniciando processamento OCR em lote: ${filePaths.length} arquivos por usuário ${req.user.id}`);

    // Processar em lote de forma assíncrona
    const batchId = `batch_${Date.now()}_${req.user.id}`;
    
    // Não aguardar processamento completo para resposta rápida
    setImmediate(async () => {
      try {
        const results = await ocrService.processBatch(filePaths, options);
        
        // Salvar resultados do lote
        await ocrService.saveBatchResults(batchId, results);
        
        // Limpar arquivos temporários
        for (const filePath of filePaths) {
          fs.remove(filePath).catch(err => 
            logger.warn(`Erro ao remover arquivo temporário ${filePath}:`, err)
          );
        }
        
        logger.info(`Processamento em lote concluído: ${batchId}`);
      } catch (error) {
        logger.error(`Erro no processamento em lote ${batchId}:`, error);
      }
    });

    res.json({
      success: true,
      data: {
        batchId,
        filesCount: req.files.length,
        status: 'processing',
        message: 'Processamento em lote iniciado',
        estimatedTime: `${Math.ceil(req.files.length * 0.5)} minutos`
      }
    });

  } catch (error) {
    logger.error('Erro no processamento OCR em lote:', error);
    
    // Limpar arquivos em caso de erro
    if (req.files) {
      req.files.forEach(file => {
        fs.remove(file.path).catch(err => 
          logger.warn(`Erro ao remover arquivo após falha ${file.path}:`, err)
        );
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro no processamento em lote',
      message: error.message
    });
  }
});

/**
 * @route GET /api/ocr/batch/:batchId
 * @desc Obter status do processamento em lote
 * @access Private
 */
router.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batchStatus = await ocrService.getBatchStatus(batchId);
    
    if (!batchStatus) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado'
      });
    }

    res.json({
      success: true,
      data: batchStatus
    });

  } catch (error) {
    logger.error(`Erro ao obter status do lote ${req.params.batchId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/ocr/history
 * @desc Listar histórico de processamentos OCR
 * @access Private
 */
router.get('/history', async (req, res) => {
  try {
    const {
      clientId,
      dateFrom,
      dateTo,
      status,
      page = 1,
      limit = 20,
      sortBy = 'processedAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    
    if (clientId) filters.clientId = clientId;
    if (status) filters.status = status;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    const history = await ocrService.getProcessingHistory(filters, options);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Erro ao obter histórico OCR:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/ocr/stats
 * @desc Obter estatísticas de processamento OCR
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const stats = await ocrService.getProcessingStats(period);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Erro ao obter estatísticas OCR:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/ocr/validate
 * @desc Validar dados extraídos de fatura
 * @access Private
 */
router.post('/validate', async (req, res) => {
  try {
    const { invoiceData } = req.body;
    
    if (!invoiceData) {
      return res.status(400).json({
        success: false,
        error: 'Dados da fatura são obrigatórios'
      });
    }

    const validation = await ocrService.validateInvoiceData(invoiceData);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    logger.error('Erro na validação de dados:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * @route POST /api/ocr/extract-text
 * @desc Extrair apenas texto da imagem (sem processamento)
 * @access Private
 */
router.post('/extract-text', ocrLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const { language = 'por' } = req.body;

    const extractedText = await ocrService.extractTextOnly(req.file.path, { language });

    // Limpar arquivo temporário
    setTimeout(() => {
      fs.remove(req.file.path).catch(err => 
        logger.warn(`Erro ao remover arquivo temporário ${req.file.path}:`, err)
      );
    }, 2000);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        extractedText,
        extractedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Erro na extração de texto:', error);
    
    if (req.file) {
      fs.remove(req.file.path).catch(err => 
        logger.warn(`Erro ao remover arquivo após falha ${req.file.path}:`, err)
      );
    }

    res.status(500).json({
      success: false,
      error: 'Erro na extração de texto',
      message: error.message
    });
  }
});

/**
 * @route GET /api/ocr/templates
 * @desc Listar templates de faturas suportados
 * @access Private
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'energisa_padrao',
        name: 'Energisa - Padrão',
        description: 'Template padrão para faturas da Energisa',
        fields: [
          'numeroCliente',
          'numeroInstalacao',
          'cpfCnpj',
          'consumoKwh',
          'valorTotal',
          'dataVencimento',
          'dataLeitura',
          'endereco',
          'modalidadeTarifaria'
        ],
        supported: true
      },
      {
        id: 'energisa_comercial',
        name: 'Energisa - Comercial',
        description: 'Template para faturas comerciais da Energisa',
        fields: [
          'numeroCliente',
          'numeroInstalacao',
          'cnpj',
          'consumoKwh',
          'demandaKw',
          'valorTotal',
          'dataVencimento',
          'endereco',
          'modalidadeTarifaria',
          'bandeiraTarifaria'
        ],
        supported: true
      },
      {
        id: 'energisa_industrial',
        name: 'Energisa - Industrial',
        description: 'Template para faturas industriais da Energisa',
        fields: [
          'numeroCliente',
          'numeroInstalacao',
          'cnpj',
          'consumoPontaKwh',
          'consumoForaPontaKwh',
          'demandaPontaKw',
          'demandaForaPontaKw',
          'valorTotal',
          'dataVencimento',
          'endereco',
          'modalidadeTarifaria'
        ],
        supported: true
      }
    ];

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    logger.error('Erro ao listar templates:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/ocr/test-extraction
 * @desc Testar extração com diferentes configurações
 * @access Admin
 */
router.post('/test-extraction', requireRole('admin'), upload.single('testImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const {
      testConfigs = [
        { language: 'por', psm: 6 },
        { language: 'por', psm: 8 },
        { language: 'por+eng', psm: 6 }
      ]
    } = req.body;

    const results = [];
    
    for (const config of testConfigs) {
      try {
        const result = await ocrService.testExtraction(req.file.path, config);
        results.push({
          config,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          config,
          success: false,
          error: error.message
        });
      }
    }

    // Limpar arquivo temporário
    setTimeout(() => {
      fs.remove(req.file.path).catch(err => 
        logger.warn(`Erro ao remover arquivo de teste ${req.file.path}:`, err)
      );
    }, 2000);

    logger.info(`Teste de extração executado por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        results,
        testedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Erro no teste de extração:', error);
    
    if (req.file) {
      fs.remove(req.file.path).catch(err => 
        logger.warn(`Erro ao remover arquivo após falha ${req.file.path}:`, err)
      );
    }

    res.status(500).json({
      success: false,
      error: 'Erro no teste de extração',
      message: error.message
    });
  }
});

/**
 * @route GET /api/ocr/health
 * @desc Verificar saúde do sistema OCR
 * @access Private
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await ocrService.getProcessingStats('1d');
    
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      stats,
      checks: {
        tesseractInitialized: await ocrService.isInitialized(),
        recentProcessing: stats.totalProcessed > 0,
        successRate: stats.successRate > 70, // mais de 70%
        averageProcessingTime: stats.avgProcessingTime < 10000 // menos de 10 segundos
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
    logger.error('Erro ao verificar saúde do OCR:', error);
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

/**
 * @route DELETE /api/ocr/cleanup
 * @desc Limpar arquivos temporários e dados antigos
 * @access Admin
 */
router.delete('/cleanup', requireRole('admin'), async (req, res) => {
  try {
    const { olderThanDays = 7 } = req.query;
    
    const cleanupResult = await ocrService.cleanup(parseInt(olderThanDays));

    logger.info(`Limpeza OCR executada por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: cleanupResult
    });

  } catch (error) {
    logger.error('Erro na limpeza OCR:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;