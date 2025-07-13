/**
 * ROTAS DE CLIENTES
 * Sistema de gerenciamento de clientes para Energiaa CRM
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('./auth');

// Models
const Client = require('../models/Client');
// const Message = require('../models/Message'); // Comentado temporariamente

// Services
const SimulationService = require('../services/simulationService');
const simulationService = new SimulationService();

/**
 * @route GET /api/clients
 * @desc Listar clientes com filtros e paginação
 * @access Private
 */
router.get('/', authenticateToken, authorize('clients:read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      source,
      segment,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Construir filtros para SQLite
    const filters = {};
    
    // Filtros específicos
    if (status) filters.status = status;
    if (source) filters.source = source;
    if (segment) filters.segment = segment;
    
    // Configurar paginação
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    filters.limit = limitNum;
    
    // Executar query
    const clients = await Client.findAll(filters);
    
    // Para simplificar, vamos usar o total de clientes retornados
    // Em uma implementação completa, seria necessário uma query separada para contar
    const total = clients.length;
    
    // Calcular informações de paginação
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    res.json({
      success: true,
      data: clients,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/clients/:id
 * @desc Obter cliente específico
 * @access Private
 */
router.get('/:id', authenticateToken, authorize('clients:read'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    // Buscar mensagens recentes (temporariamente desabilitado)
    // const recentMessages = await Message.find({ clientId: client.id })
    //   .sort({ createdAt: -1 })
    //   .limit(10)
    //   .lean();
    
    res.json({
      success: true,
      data: {
        ...client,
        recentMessages: [] // Temporariamente vazio
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/clients
 * @desc Criar novo cliente
 * @access Private
 */
router.post('/', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const clientData = req.body;
    
    // Validações básicas
    if (!clientData.phone) {
      return res.status(400).json({
        success: false,
        error: 'Telefone é obrigatório'
      });
    }
    
    // Verificar se já existe cliente com este telefone
    const existingClient = await Client.findByPhone(clientData.phone);
    
    if (existingClient) {
      return res.status(409).json({
        success: false,
        error: 'Já existe um cliente com este telefone',
        existingClientId: existingClient.id
      });
    }
    
    // Criar cliente
    const client = new Client({
      ...clientData,
      createdBy: req.user ? req.user.username : 'system'
    });
    
    await client.save();
    
    res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      data: client
    });
    
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    
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
 * @route PUT /api/clients/:id
 * @desc Atualizar cliente
 * @access Private
 */
router.put('/:id', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const clientId = req.params.id;
    const updateData = req.body;
    
    // Remover campos que não devem ser atualizados diretamente
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.createdBy;
    
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    // Atualizar dados do cliente
    Object.assign(client, updateData);
    client.updatedBy = req.user ? req.user.username : 'system';
    await client.save();
    
    res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      data: client
    });
    
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    
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
 * @route DELETE /api/clients/:id
 * @desc Excluir cliente
 * @access Private
 */
router.delete('/:id', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    await client.delete();
    
    // Também excluir mensagens relacionadas (temporariamente desabilitado)
    // await Message.deleteMany({ clientId: client.id });
    
    res.json({
      success: true,
      message: 'Cliente excluído com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/clients/:id/interaction
 * @desc Adicionar interação ao cliente
 * @access Private
 */
router.post('/:id/interaction', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const { type, description, outcome, scheduledFollowUp } = req.body;
    
    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Tipo e descrição são obrigatórios'
      });
    }
    
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    // Adicionar interação
    await client.addInteraction({
      type,
      message: description,
      direction: 'outbound',
      agent: req.user ? req.user.username : 'system',
      metadata: { outcome, scheduledFollowUp }
    });
    
    res.json({
      success: true,
      message: 'Interação adicionada com sucesso',
      data: client
    });
    
  } catch (error) {
    console.error('Erro ao adicionar interação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/clients/:id/simulation
 * @desc Realizar simulação de economia para cliente
 * @access Private
 */
router.post('/:id/simulation', authenticateToken, authorize('simulation:all'), async (req, res) => {
  try {
    const clientId = req.params.id;
    const simulationData = req.body;
    
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    // Realizar simulação
    const simulation = await simulationService.simulateEconomy({
      ...simulationData,
      propertyType: client.energyInfo?.propertyType || 'residencial',
      location: client.contact?.address || {}
    });
    
    if (!simulation.success) {
      return res.status(400).json(simulation);
    }
    
    // Salvar simulação no cliente
    await simulationService.saveSimulationToClient(clientId, simulation);
    
    // Adicionar interação
    await client.addInteraction({
      type: 'simulacao',
      description: `Simulação realizada - Economia: ${simulation.economyCalculation.clientSavingsPercentage}%`,
      outcome: simulation.economyCalculation.isViable ? 'positivo' : 'negativo',
      agent: req.user.username
    });
    
    res.json({
      success: true,
      message: 'Simulação realizada com sucesso',
      data: simulation
    });
    
  } catch (error) {
    console.error('Erro ao realizar simulação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/clients/:id/messages
 * @desc Obter mensagens do cliente
 * @access Private
 */
router.get('/:id/messages', authenticateToken, authorize('messages:read'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const [messages, total] = await Promise.all([
      Message.find({ clientId: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Message.countDocuments({ clientId: req.params.id })
    ]);
    
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      success: true,
      data: messages,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter mensagens:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route PUT /api/clients/:id/status
 * @desc Atualizar status do cliente
 * @access Private
 */
router.put('/:id/status', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const { status, reason } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status é obrigatório'
      });
    }
    
    const validStatuses = ['lead', 'contato', 'interessado', 'proposta', 'negociacao', 'fechado', 'perdido'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido',
        validStatuses
      });
    }
    
    const client = await ClientModel.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    const oldStatus = client.status;
    client.status = status;
    client.updatedAt = new Date();
    
    await client.save();
    
    // Adicionar interação de mudança de status
    await client.addInteraction({
      type: 'status_change',
      description: `Status alterado de '${oldStatus}' para '${status}'${reason ? ` - ${reason}` : ''}`,
      outcome: 'neutro',
      agent: req.user.username
    });
    
    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: {
        oldStatus,
        newStatus: status,
        client
      }
    });
    
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/clients/:id/tags
 * @desc Adicionar tags ao cliente
 * @access Private
 */
router.post('/:id/tags', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const { tags } = req.body;
    
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags devem ser um array não vazio'
      });
    }
    
    const client = await ClientModel.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    // Adicionar tags únicas
    const newTags = tags.filter(tag => !client.tags.includes(tag));
    client.tags.push(...newTags);
    client.updatedAt = new Date();
    
    await client.save();
    
    res.json({
      success: true,
      message: 'Tags adicionadas com sucesso',
      data: {
        addedTags: newTags,
        allTags: client.tags
      }
    });
    
  } catch (error) {
    console.error('Erro ao adicionar tags:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route DELETE /api/clients/:id/tags
 * @desc Remover tags do cliente
 * @access Private
 */
router.delete('/:id/tags', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const { tags } = req.body;
    
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags devem ser um array não vazio'
      });
    }
    
    const client = await ClientModel.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    // Remover tags
    client.tags = client.tags.filter(tag => !tags.includes(tag));
    client.updatedAt = new Date();
    
    await client.save();
    
    res.json({
      success: true,
      message: 'Tags removidas com sucesso',
      data: {
        removedTags: tags,
        remainingTags: client.tags
      }
    });
    
  } catch (error) {
    console.error('Erro ao remover tags:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/clients/stats/overview
 * @desc Obter estatísticas gerais dos clientes
 * @access Private
 */
router.get('/stats/overview', authenticateToken, authorize('clients:read'), async (req, res) => {
  try {
    const stats = await ClientModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          },
          bySource: {
            $push: {
              source: '$source',
              count: 1
            }
          },
          bySegment: {
            $push: {
              segment: '$segment',
              count: 1
            }
          },
          avgMonthlyBill: { $avg: '$energyInfo.monthlyBill' },
          totalPotentialRevenue: { $sum: '$simulation.investmentValue' }
        }
      }
    ]);
    
    // Processar dados agregados
    const result = stats[0] || {
      total: 0,
      byStatus: [],
      bySource: [],
      bySegment: [],
      avgMonthlyBill: 0,
      totalPotentialRevenue: 0
    };
    
    // Agrupar por status
    const statusCounts = {};
    result.byStatus.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });
    
    // Agrupar por fonte
    const sourceCounts = {};
    result.bySource.forEach(item => {
      sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
    });
    
    // Agrupar por segmento
    const segmentCounts = {};
    result.bySegment.forEach(item => {
      segmentCounts[item.segment] = (segmentCounts[item.segment] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        total: result.total,
        byStatus: statusCounts,
        bySource: sourceCounts,
        bySegment: segmentCounts,
        avgMonthlyBill: Math.round(result.avgMonthlyBill || 0),
        totalPotentialRevenue: Math.round(result.totalPotentialRevenue || 0)
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;