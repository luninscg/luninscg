/**
 * ROTAS DE CAMPANHAS
 * Sistema de gerenciamento de campanhas de disparo para Energiaa CRM
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('./auth');

// Models
const Campaign = require('../models/Campaign');
const ClientModel = require('../models/Client');
const Message = require('../models/Message');

// Services
const CampaignService = require('../services/campaignService');
const campaignService = new CampaignService();

/**
 * @route GET /api/campaigns
 * @desc Listar campanhas com filtros e paginação
 * @access Private
 */
router.get('/', authenticateToken, authorize('campaigns:read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Construir query
    let query = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Configurar paginação
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Configurar ordenação
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Executar query
    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Campaign.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      success: true,
      data: campaigns,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar campanhas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/campaigns/:id
 * @desc Obter campanha específica
 * @access Private
 */
router.get('/:id', authenticateToken, authorize('campaigns:read'), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }
    
    // Buscar mensagens da campanha
    const messages = await Message.find({ campaignId: campaign._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    res.json({
      success: true,
      data: {
        ...campaign.toObject(),
        messages
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/campaigns
 * @desc Criar nova campanha
 * @access Private
 */
router.post('/', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdBy: req.user.username
    };
    
    const result = await campaignService.createCampaign(campaignData);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json({
      success: true,
      message: 'Campanha criada com sucesso',
      data: result.campaign
    });
    
  } catch (error) {
    console.error('Erro ao criar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route PUT /api/campaigns/:id
 * @desc Atualizar campanha
 * @access Private
 */
router.put('/:id', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const updateData = req.body;
    
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }
    
    // Verificar se campanha pode ser editada
    if (['executando', 'concluida'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível editar campanha em execução ou concluída'
      });
    }
    
    // Remover campos que não devem ser atualizados
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.createdBy;
    delete updateData.metrics;
    delete updateData.execution;
    
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      campaignId,
      {
        ...updateData,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Campanha atualizada com sucesso',
      data: updatedCampaign
    });
    
  } catch (error) {
    console.error('Erro ao atualizar campanha:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route DELETE /api/campaigns/:id
 * @desc Excluir campanha
 * @access Private
 */
router.delete('/:id', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }
    
    // Verificar se campanha pode ser excluída
    if (campaign.status === 'executando') {
      return res.status(400).json({
        success: false,
        error: 'Não é possível excluir campanha em execução. Pause primeiro.'
      });
    }
    
    await Campaign.findByIdAndDelete(req.params.id);
    
    // Também excluir mensagens relacionadas
    await Message.deleteMany({ campaignId: campaign._id });
    
    res.json({
      success: true,
      message: 'Campanha excluída com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao excluir campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/campaigns/:id/start
 * @desc Iniciar execução da campanha
 * @access Private
 */
router.post('/:id/start', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }
    
    if (campaign.status !== 'agendada') {
      return res.status(400).json({
        success: false,
        error: 'Campanha deve estar agendada para ser iniciada',
        currentStatus: campaign.status
      });
    }
    
    // Adicionar à fila de execução
    campaignService.queueCampaign(campaignId);
    
    res.json({
      success: true,
      message: 'Campanha adicionada à fila de execução'
    });
    
  } catch (error) {
    console.error('Erro ao iniciar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/campaigns/:id/pause
 * @desc Pausar execução da campanha
 * @access Private
 */
router.post('/:id/pause', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const result = await campaignService.pauseCampaign(req.params.id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Campanha pausada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao pausar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/campaigns/:id/resume
 * @desc Retomar execução da campanha
 * @access Private
 */
router.post('/:id/resume', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const result = await campaignService.resumeCampaign(req.params.id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Campanha retomada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao retomar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/campaigns/:id/cancel
 * @desc Cancelar campanha
 * @access Private
 */
router.post('/:id/cancel', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const result = await campaignService.cancelCampaign(req.params.id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Campanha cancelada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao cancelar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/campaigns/:id/audience
 * @desc Obter audiência da campanha
 * @access Private
 */
router.get('/:id/audience', authenticateToken, authorize('campaigns:read'), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }
    
    const audience = await campaignService.getAudience(campaign);
    
    res.json({
      success: true,
      data: {
        totalContacts: audience.length,
        contacts: audience.slice(0, 100), // Limitar a 100 para preview
        criteria: campaign.audience.criteria
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter audiência:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/campaigns/:id/test
 * @desc Enviar teste da campanha
 * @access Private
 */
router.post('/:id/test', authenticateToken, authorize('campaigns:write'), async (req, res) => {
  try {
    const { testContacts } = req.body;
    
    if (!Array.isArray(testContacts) || testContacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Contatos de teste são obrigatórios'
      });
    }
    
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }
    
    // Criar campanha de teste
    const testCampaign = {
      name: `TESTE - ${campaign.name}`,
      description: `Teste da campanha ${campaign.name}`,
      type: 'teste',
      message: campaign.message,
      audience: {
        type: 'custom',
        criteria: {},
        excludeRecent: false,
        excludeOptOut: false
      },
      scheduling: {
        type: 'imediato'
      },
      sendingConfig: {
        batchSize: 1,
        delayBetweenMessages: 1000
      },
      createdBy: req.user.username
    };
    
    const result = await campaignService.createCampaign(testCampaign);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Teste da campanha iniciado',
      testCampaignId: result.campaignId
    });
    
  } catch (error) {
    console.error('Erro ao testar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/campaigns/:id/metrics
 * @desc Obter métricas detalhadas da campanha
 * @access Private
 */
router.get('/:id/metrics', authenticateToken, authorize('campaigns:read'), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }
    
    // Métricas básicas da campanha
    const basicMetrics = campaign.metrics;
    
    // Métricas detalhadas das mensagens
    const messageMetrics = await Message.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          sentMessages: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          deliveredMessages: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          readMessages: {
            $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
          },
          repliedMessages: {
            $sum: { $cond: [{ $ne: ['$context.hasReply', null] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$engagement.responseTime' },
          avgWordCount: { $avg: '$engagement.wordCount' }
        }
      }
    ]);
    
    // Métricas por hora (últimas 24h)
    const hourlyMetrics = await Message.aggregate([
      {
        $match: {
          campaignId: campaign._id,
          createdAt: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' },
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.date': 1, '_id.hour': 1 } }
    ]);
    
    const detailedMetrics = messageMetrics[0] || {
      totalMessages: 0,
      sentMessages: 0,
      deliveredMessages: 0,
      readMessages: 0,
      repliedMessages: 0,
      avgResponseTime: 0,
      avgWordCount: 0
    };
    
    // Calcular taxas
    const deliveryRate = detailedMetrics.sentMessages > 0 
      ? (detailedMetrics.deliveredMessages / detailedMetrics.sentMessages * 100).toFixed(2)
      : 0;
    
    const readRate = detailedMetrics.deliveredMessages > 0
      ? (detailedMetrics.readMessages / detailedMetrics.deliveredMessages * 100).toFixed(2)
      : 0;
    
    const replyRate = detailedMetrics.deliveredMessages > 0
      ? (detailedMetrics.repliedMessages / detailedMetrics.deliveredMessages * 100).toFixed(2)
      : 0;
    
    res.json({
      success: true,
      data: {
        basic: basicMetrics,
        detailed: {
          ...detailedMetrics,
          deliveryRate: parseFloat(deliveryRate),
          readRate: parseFloat(readRate),
          replyRate: parseFloat(replyRate)
        },
        hourly: hourlyMetrics,
        performance: {
          efficiency: campaign.execution.duration 
            ? Math.round(detailedMetrics.sentMessages / (campaign.execution.duration / 60))
            : 0, // mensagens por minuto
          errorRate: detailedMetrics.totalMessages > 0
            ? ((detailedMetrics.totalMessages - detailedMetrics.sentMessages) / detailedMetrics.totalMessages * 100).toFixed(2)
            : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas da campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/campaigns/templates
 * @desc Obter templates de campanhas
 * @access Private
 */
router.get('/templates', authenticateToken, authorize('campaigns:read'), (req, res) => {
  const templates = [
    {
      id: 'welcome',
      name: 'Boas-vindas',
      description: 'Mensagem de boas-vindas para novos leads',
      type: 'promocional',
      message: {
        text: 'Olá {primeiro_nome}! 👋\n\nSeja bem-vindo(a) à Energiaa! ☀️\n\nVi que você tem interesse em energia solar. Que tal descobrir quanto você pode economizar na sua conta de luz?\n\nPosso fazer uma simulação gratuita para você agora mesmo! 📊\n\nQual o valor da sua conta de energia atual?',
        variables: [
          { name: 'primeiro_nome', description: 'Primeiro nome do cliente' }
        ]
      },
      audience: {
        type: 'status',
        criteria: {
          status: ['lead']
        }
      }
    },
    {
      id: 'follow_up',
      name: 'Follow-up',
      description: 'Acompanhamento para clientes interessados',
      type: 'follow_up',
      message: {
        text: 'Oi {primeiro_nome}! 😊\n\nLembra da nossa conversa sobre energia solar?\n\nFiz uma simulação personalizada para você e os resultados são incríveis! 🚀\n\nVocê pode economizar até R$ {economia_estimada} por mês na sua conta de luz!\n\nQuer que eu te explique como funciona?',
        variables: [
          { name: 'primeiro_nome', description: 'Primeiro nome do cliente' },
          { name: 'economia_estimada', description: 'Valor estimado de economia' }
        ]
      },
      audience: {
        type: 'status',
        criteria: {
          status: ['interessado']
        }
      }
    },
    {
      id: 'reactivation',
      name: 'Reativação',
      description: 'Reativar leads inativos',
      type: 'reativacao',
      message: {
        text: 'Oi {primeiro_nome}! ✨\n\nNotei que você demonstrou interesse em energia solar, mas não conseguimos finalizar nossa conversa...\n\nQue tal retomar? Tenho novidades incríveis! 🎉\n\n🔥 PROMOÇÃO ESPECIAL:\n• Instalação SEM CUSTO\n• Economia IMEDIATA na conta\n• Garantia de 25 anos\n\nVamos conversar? É só responder aqui! 💬',
        variables: [
          { name: 'primeiro_nome', description: 'Primeiro nome do cliente' }
        ]
      },
      audience: {
        type: 'status',
        criteria: {
          status: ['perdido']
        }
      }
    },
    {
      id: 'promotion',
      name: 'Promoção',
      description: 'Campanha promocional',
      type: 'promocional',
      message: {
        text: '🚨 OFERTA LIMITADA! 🚨\n\nOlá {primeiro_nome}!\n\n⚡ ENERGIA SOLAR SEM INVESTIMENTO INICIAL!\n\n✅ Instalação GRATUITA\n✅ Economia de até 95% na conta\n✅ Sem obras na sua casa\n✅ Garantia de 25 anos\n\n🎯 Apenas para os primeiros 50 clientes!\n\nQuer saber se sua casa se qualifica?\n\nResponda com SIM e faço sua simulação AGORA! 📱',
        variables: [
          { name: 'primeiro_nome', description: 'Primeiro nome do cliente' }
        ]
      },
      audience: {
        type: 'all',
        criteria: {}
      }
    }
  ];
  
  res.json({
    success: true,
    data: templates
  });
});

/**
 * @route GET /api/campaigns/status
 * @desc Obter status do serviço de campanhas
 * @access Private
 */
router.get('/status', authenticateToken, authorize('campaigns:read'), (req, res) => {
  try {
    const status = campaignService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('Erro ao obter status das campanhas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/campaigns/stats/overview
 * @desc Obter estatísticas gerais das campanhas
 * @access Private
 */
router.get('/stats/overview', authenticateToken, authorize('campaigns:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    const metrics = await campaignService.getCampaignMetrics(period);
    
    if (!metrics) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter métricas'
      });
    }
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas das campanhas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;