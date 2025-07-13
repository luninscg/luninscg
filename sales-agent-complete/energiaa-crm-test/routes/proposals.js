const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const proposalService = require('../services/proposalService');
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
    new winston.transports.File({ filename: './logs/proposals-api.log' }),
    new winston.transports.Console()
  ]
});

// Configuração do multer para upload de templates
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/templates/';
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `template-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 3
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.hbs', '.html', '.css', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use HBS, HTML, CSS ou JS'), false);
    }
  }
});

// Rate limiting para geração de propostas
const proposalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 gerações por minuto
  message: {
    error: 'Muitas gerações de proposta. Tente novamente em 1 minuto.',
    code: 'PROPOSAL_RATE_LIMIT_EXCEEDED'
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
 * @route POST /api/proposals/generate
 * @desc Gerar nova proposta
 * @access Private
 */
router.post('/generate', proposalLimiter, async (req, res) => {
  try {
    const {
      clientId,
      simulationId,
      templateType = 'standard',
      customData = {},
      format = 'html',
      includeAttachments = true
    } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    const options = {
      templateType,
      format,
      includeAttachments,
      customData,
      userId: req.user.id
    };

    logger.info(`Iniciando geração de proposta para cliente ${clientId} por usuário ${req.user.id}`);

    const proposal = await proposalService.generateProposal(clientId, simulationId, options);

    logger.info(`Proposta gerada com sucesso: ${proposal.proposalNumber}`);

    res.json({
      success: true,
      data: proposal
    });

  } catch (error) {
    logger.error('Erro na geração de proposta:', error);
    
    if (error.message.includes('cliente não encontrado')) {
      res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    } else if (error.message.includes('simulação não encontrada')) {
      res.status(404).json({
        success: false,
        error: 'Simulação não encontrada'
      });
    } else if (error.message.includes('template não encontrado')) {
      res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro na geração de proposta',
        message: error.message
      });
    }
  }
});

/**
 * @route GET /api/proposals
 * @desc Listar propostas
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const {
      clientId,
      status,
      dateFrom,
      dateTo,
      templateType,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    
    if (clientId) filters.clientId = clientId;
    if (status) filters.status = status;
    if (templateType) filters.templateType = templateType;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (search) filters.search = search;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    const proposals = await proposalService.getProposals(filters, options);

    res.json({
      success: true,
      data: proposals
    });

  } catch (error) {
    logger.error('Erro ao listar propostas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/proposals/:proposalId
 * @desc Obter proposta específica
 * @access Private
 */
router.get('/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { includeContent = false } = req.query;
    
    const proposal = await proposalService.getProposal(proposalId, {
      includeContent: includeContent === 'true'
    });
    
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposta não encontrada'
      });
    }

    res.json({
      success: true,
      data: proposal
    });

  } catch (error) {
    logger.error(`Erro ao obter proposta ${req.params.proposalId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/proposals/:proposalId/download
 * @desc Download da proposta em PDF
 * @access Private
 */
router.get('/:proposalId/download', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { format = 'pdf' } = req.query;
    
    const proposal = await proposalService.getProposal(proposalId, { includeContent: true });
    
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposta não encontrada'
      });
    }

    let filePath;
    let contentType;
    let filename;

    if (format === 'pdf') {
      filePath = proposal.pdfPath;
      contentType = 'application/pdf';
      filename = `proposta-${proposal.proposalNumber}.pdf`;
    } else if (format === 'html') {
      filePath = proposal.htmlPath;
      contentType = 'text/html';
      filename = `proposta-${proposal.proposalNumber}.html`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Formato não suportado. Use pdf ou html'
      });
    }

    if (!filePath || !await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo da proposta não encontrado'
      });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    logger.info(`Download de proposta: ${proposalId} por usuário ${req.user.id}`);

  } catch (error) {
    logger.error(`Erro no download da proposta ${req.params.proposalId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route PUT /api/proposals/:proposalId/status
 * @desc Atualizar status da proposta
 * @access Private
 */
router.put('/:proposalId/status', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido',
        validStatuses
      });
    }

    const updatedProposal = await proposalService.updateProposalStatus(proposalId, status, {
      notes,
      updatedBy: req.user.id
    });

    logger.info(`Status da proposta atualizado: ${proposalId} para ${status} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: updatedProposal
    });

  } catch (error) {
    logger.error(`Erro ao atualizar status da proposta ${req.params.proposalId}:`, error);
    
    if (error.message.includes('não encontrada')) {
      res.status(404).json({
        success: false,
        error: 'Proposta não encontrada'
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
 * @route POST /api/proposals/:proposalId/regenerate
 * @desc Regenerar proposta com novos dados
 * @access Private
 */
router.post('/:proposalId/regenerate', proposalLimiter, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const {
      templateType,
      customData = {},
      format = 'html'
    } = req.body;

    const options = {
      templateType,
      format,
      customData,
      userId: req.user.id
    };

    const regeneratedProposal = await proposalService.regenerateProposal(proposalId, options);

    logger.info(`Proposta regenerada: ${proposalId} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: regeneratedProposal
    });

  } catch (error) {
    logger.error(`Erro ao regenerar proposta ${req.params.proposalId}:`, error);
    
    if (error.message.includes('não encontrada')) {
      res.status(404).json({
        success: false,
        error: 'Proposta não encontrada'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro na regeneração da proposta',
        message: error.message
      });
    }
  }
});

/**
 * @route GET /api/proposals/templates
 * @desc Listar templates disponíveis
 * @access Private
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await proposalService.getAvailableTemplates();
    
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
 * @route POST /api/proposals/templates
 * @desc Criar novo template
 * @access Admin
 */
router.post('/templates', requireRole('admin'), adminLimiter, upload.fields([
  { name: 'template', maxCount: 1 },
  { name: 'styles', maxCount: 1 },
  { name: 'scripts', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      name,
      description,
      category = 'custom',
      variables = []
    } = req.body;

    if (!name || !req.files.template) {
      return res.status(400).json({
        success: false,
        error: 'Nome e arquivo de template são obrigatórios'
      });
    }

    const templateData = {
      name,
      description,
      category,
      variables: Array.isArray(variables) ? variables : JSON.parse(variables || '[]'),
      templatePath: req.files.template[0].path,
      stylesPath: req.files.styles ? req.files.styles[0].path : null,
      scriptsPath: req.files.scripts ? req.files.scripts[0].path : null,
      createdBy: req.user.id
    };

    const templateId = await proposalService.createTemplate(templateData);

    logger.info(`Template criado: ${name} por usuário ${req.user.id}`);

    res.status(201).json({
      success: true,
      data: {
        id: templateId,
        name,
        message: 'Template criado com sucesso'
      }
    });

  } catch (error) {
    logger.error('Erro ao criar template:', error);
    
    // Limpar arquivos em caso de erro
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.remove(file.path).catch(err => 
          logger.warn(`Erro ao remover arquivo ${file.path}:`, err)
        );
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao criar template',
      message: error.message
    });
  }
});

/**
 * @route GET /api/proposals/stats
 * @desc Obter estatísticas de propostas
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const stats = await proposalService.getProposalStats(period);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Erro ao obter estatísticas de propostas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/proposals/batch-generate
 * @desc Gerar propostas em lote
 * @access Private
 */
router.post('/batch-generate', proposalLimiter, async (req, res) => {
  try {
    const {
      proposals = [],
      templateType = 'standard',
      format = 'html'
    } = req.body;

    if (!Array.isArray(proposals) || proposals.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista de propostas é obrigatória'
      });
    }

    if (proposals.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 20 propostas por lote'
      });
    }

    const batchId = `batch_${Date.now()}_${req.user.id}`;
    
    logger.info(`Iniciando geração em lote: ${proposals.length} propostas por usuário ${req.user.id}`);

    // Processar em lote de forma assíncrona
    setImmediate(async () => {
      try {
        const results = await proposalService.generateBatchProposals(proposals, {
          templateType,
          format,
          batchId,
          userId: req.user.id
        });
        
        logger.info(`Geração em lote concluída: ${batchId}`);
      } catch (error) {
        logger.error(`Erro na geração em lote ${batchId}:`, error);
      }
    });

    res.json({
      success: true,
      data: {
        batchId,
        proposalsCount: proposals.length,
        status: 'processing',
        message: 'Geração em lote iniciada',
        estimatedTime: `${Math.ceil(proposals.length * 0.3)} minutos`
      }
    });

  } catch (error) {
    logger.error('Erro na geração em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro na geração em lote',
      message: error.message
    });
  }
});

/**
 * @route GET /api/proposals/batch/:batchId
 * @desc Obter status da geração em lote
 * @access Private
 */
router.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batchStatus = await proposalService.getBatchStatus(batchId);
    
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
 * @route POST /api/proposals/preview
 * @desc Visualizar proposta sem salvar
 * @access Private
 */
router.post('/preview', proposalLimiter, async (req, res) => {
  try {
    const {
      clientId,
      simulationId,
      templateType = 'standard',
      customData = {}
    } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    const preview = await proposalService.generatePreview(clientId, simulationId, {
      templateType,
      customData
    });

    res.json({
      success: true,
      data: preview
    });

  } catch (error) {
    logger.error('Erro na geração de preview:', error);
    res.status(500).json({
      success: false,
      error: 'Erro na geração de preview',
      message: error.message
    });
  }
});

/**
 * @route GET /api/proposals/client/:clientId
 * @desc Obter histórico de propostas do cliente
 * @access Private
 */
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      page = 1,
      limit = 10,
      includeContent = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      includeContent: includeContent === 'true'
    };

    const clientProposals = await proposalService.getClientProposals(clientId, options);

    res.json({
      success: true,
      data: clientProposals
    });

  } catch (error) {
    logger.error(`Erro ao obter propostas do cliente ${req.params.clientId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route DELETE /api/proposals/:proposalId
 * @desc Deletar proposta
 * @access Admin
 */
router.delete('/:proposalId', requireRole('admin'), adminLimiter, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { confirm } = req.query;

    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Confirmação necessária',
        message: 'Adicione ?confirm=true para confirmar a exclusão'
      });
    }

    await proposalService.deleteProposal(proposalId);

    logger.info(`Proposta deletada: ${proposalId} por usuário ${req.user.id}`);

    res.json({
      success: true,
      data: {
        proposalId,
        message: 'Proposta deletada com sucesso'
      }
    });

  } catch (error) {
    logger.error(`Erro ao deletar proposta ${req.params.proposalId}:`, error);
    
    if (error.message.includes('não encontrada')) {
      res.status(404).json({
        success: false,
        error: 'Proposta não encontrada'
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
 * @route GET /api/proposals/health
 * @desc Verificar saúde do sistema de propostas
 * @access Private
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await proposalService.getProposalStats('1d');
    
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      stats,
      checks: {
        templatesAvailable: stats.availableTemplates > 0,
        recentGeneration: stats.totalGenerated > 0,
        successRate: stats.successRate > 85, // mais de 85%
        averageGenerationTime: stats.avgGenerationTime < 5000 // menos de 5 segundos
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
    logger.error('Erro ao verificar saúde das propostas:', error);
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