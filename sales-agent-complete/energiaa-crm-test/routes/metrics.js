/**
 * ROTAS DE MÉTRICAS E ANALYTICS
 * Sistema de métricas e analytics para Energiaa CRM
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('./auth');

// Models
const Metrics = require('../models/Metrics');
const ClientModel = require('../models/Client');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');

// Services
const MetricsService = require('../services/metricsService');
const metricsService = new MetricsService();

/**
 * @route GET /api/metrics/dashboard
 * @desc Obter métricas do dashboard principal
 * @access Private
 */
router.get('/dashboard', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    // Métricas em tempo real
    const realTimeMetrics = await metricsService.getRealTimeMetrics();
    
    // Métricas do período
    const periodMetrics = await metricsService.getMetrics(period);
    
    // Métricas de comparação (período anterior)
    const comparisonMetrics = await metricsService.getComparisonMetrics(period);
    
    // Tendências
    const trends = await metricsService.getTrends(period);
    
    res.json({
      success: true,
      data: {
        realTime: realTimeMetrics,
        period: periodMetrics,
        comparison: comparisonMetrics,
        trends
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas do dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/metrics/clients
 * @desc Obter métricas de clientes
 * @access Private
 */
router.get('/clients', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily', groupBy = 'status' } = req.query;
    
    let aggregationPipeline = [];
    
    // Filtro de período
    const periodFilter = metricsService.getPeriodFilter(period);
    if (periodFilter) {
      aggregationPipeline.push({ $match: periodFilter });
    }
    
    // Agrupamento
    switch (groupBy) {
      case 'status':
        aggregationPipeline.push({
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgBill: { $avg: '$energyInfo.monthlyBill' },
            totalRevenue: { $sum: '$simulation.monthlyEconomy' }
          }
        });
        break;
        
      case 'source':
        aggregationPipeline.push({
          $group: {
            _id: '$source',
            count: { $sum: 1 },
            conversionRate: {
              $avg: {
                $cond: [
                  { $in: ['$status', ['cliente', 'proposta']] },
                  1,
                  0
                ]
              }
            }
          }
        });
        break;
        
      case 'segment':
        aggregationPipeline.push({
          $group: {
            _id: '$segment',
            count: { $sum: 1 },
            avgBill: { $avg: '$energyInfo.monthlyBill' },
            avgEconomy: { $avg: '$simulation.monthlyEconomy' }
          }
        });
        break;
        
      case 'location':
        aggregationPipeline.push({
          $group: {
            _id: {
              city: '$address.city',
              state: '$address.state'
            },
            count: { $sum: 1 },
            avgBill: { $avg: '$energyInfo.monthlyBill' }
          }
        });
        break;
        
      default:
        aggregationPipeline.push({
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgBill: { $avg: '$energyInfo.monthlyBill' },
            totalRevenue: { $sum: '$simulation.monthlyEconomy' }
          }
        });
    }
    
    aggregationPipeline.push({ $sort: { count: -1 } });
    
    const results = await ClientModel.aggregate(aggregationPipeline);
    
    // Métricas adicionais
    const totalClients = await ClientModel.countDocuments(periodFilter || {});
    const newClients = await ClientModel.countDocuments({
      ...periodFilter,
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // últimas 24h
      }
    });
    
    res.json({
      success: true,
      data: {
        groupedData: results,
        summary: {
          total: totalClients,
          new: newClients,
          groupBy
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas de clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/metrics/campaigns
 * @desc Obter métricas de campanhas
 * @access Private
 */
router.get('/campaigns', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    const periodFilter = metricsService.getPeriodFilter(period);
    
    // Métricas gerais de campanhas
    const campaignStats = await Campaign.aggregate([
      { $match: periodFilter || {} },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalSent: { $sum: '$metrics.sent' },
          totalDelivered: { $sum: '$metrics.delivered' },
          totalRead: { $sum: '$metrics.read' },
          totalReplies: { $sum: '$metrics.replies' },
          totalRevenue: { $sum: '$metrics.revenue' }
        }
      }
    ]);
    
    // Performance por tipo de campanha
    const performanceByType = await Campaign.aggregate([
      { $match: periodFilter || {} },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgDeliveryRate: {
            $avg: {
              $cond: [
                { $gt: ['$metrics.sent', 0] },
                { $divide: ['$metrics.delivered', '$metrics.sent'] },
                0
              ]
            }
          },
          avgReadRate: {
            $avg: {
              $cond: [
                { $gt: ['$metrics.delivered', 0] },
                { $divide: ['$metrics.read', '$metrics.delivered'] },
                0
              ]
            }
          },
          avgReplyRate: {
            $avg: {
              $cond: [
                { $gt: ['$metrics.delivered', 0] },
                { $divide: ['$metrics.replies', '$metrics.delivered'] },
                0
              ]
            }
          }
        }
      }
    ]);
    
    // Top campanhas por performance
    const topCampaigns = await Campaign.find(periodFilter || {})
      .select('name type metrics createdAt')
      .sort({ 'metrics.replies': -1 })
      .limit(10)
      .lean();
    
    res.json({
      success: true,
      data: {
        general: campaignStats,
        performanceByType,
        topCampaigns
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas de campanhas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/metrics/messages
 * @desc Obter métricas de mensagens
 * @access Private
 */
router.get('/messages', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily', groupBy = 'hour' } = req.query;
    
    const periodFilter = metricsService.getPeriodFilter(period);
    
    let groupByField;
    switch (groupBy) {
      case 'hour':
        groupByField = {
          hour: { $hour: '$createdAt' },
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        };
        break;
      case 'day':
        groupByField = {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        };
        break;
      case 'week':
        groupByField = {
          week: { $week: '$createdAt' },
          year: { $year: '$createdAt' }
        };
        break;
      case 'month':
        groupByField = {
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' }
        };
        break;
      default:
        groupByField = null;
    }
    
    // Volume de mensagens por período
    const volumeData = await Message.aggregate([
      { $match: periodFilter || {} },
      {
        $group: {
          _id: groupByField,
          total: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
          },
          received: {
            $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$engagement.responseTime' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Status das mensagens
    const statusData = await Message.aggregate([
      { $match: periodFilter || {} },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Tipos de mensagem
    const typeData = await Message.aggregate([
      { $match: periodFilter || {} },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Análise de sentimento
    const sentimentData = await Message.aggregate([
      {
        $match: {
          ...periodFilter,
          direction: 'inbound',
          'analysis.sentiment': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$analysis.sentiment',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$analysis.confidence' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        volume: volumeData,
        status: statusData,
        types: typeData,
        sentiment: sentimentData,
        groupBy
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas de mensagens:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/metrics/conversions
 * @desc Obter métricas de conversão
 * @access Private
 */
router.get('/conversions', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    const periodFilter = metricsService.getPeriodFilter(period);
    
    // Funil de conversão
    const funnelData = await ClientModel.aggregate([
      { $match: periodFilter || {} },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          leads: {
            $sum: { $cond: [{ $eq: ['$status', 'lead'] }, 1, 0] }
          },
          interessados: {
            $sum: { $cond: [{ $eq: ['$status', 'interessado'] }, 1, 0] }
          },
          qualificados: {
            $sum: { $cond: [{ $eq: ['$status', 'qualificado'] }, 1, 0] }
          },
          propostas: {
            $sum: { $cond: [{ $eq: ['$status', 'proposta'] }, 1, 0] }
          },
          clientes: {
            $sum: { $cond: [{ $eq: ['$status', 'cliente'] }, 1, 0] }
          }
        }
      }
    ]);
    
    // Conversão por fonte
    const conversionBySource = await ClientModel.aggregate([
      { $match: periodFilter || {} },
      {
        $group: {
          _id: '$source',
          total: { $sum: 1 },
          converted: {
            $sum: {
              $cond: [
                { $in: ['$status', ['cliente', 'proposta']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $divide: ['$converted', '$total'] },
              0
            ]
          }
        }
      },
      { $sort: { conversionRate: -1 } }
    ]);
    
    // Tempo médio de conversão
    const avgConversionTime = await ClientModel.aggregate([
      {
        $match: {
          ...periodFilter,
          status: { $in: ['cliente', 'proposta'] },
          'interactions.0': { $exists: true }
        }
      },
      {
        $addFields: {
          firstInteraction: { $arrayElemAt: ['$interactions.date', 0] },
          lastInteraction: { $arrayElemAt: ['$interactions.date', -1] }
        }
      },
      {
        $addFields: {
          conversionTime: {
            $divide: [
              { $subtract: ['$lastInteraction', '$firstInteraction'] },
              1000 * 60 * 60 * 24 // converter para dias
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$conversionTime' },
          minDays: { $min: '$conversionTime' },
          maxDays: { $max: '$conversionTime' }
        }
      }
    ]);
    
    // Valor médio por conversão
    const avgDealValue = await ClientModel.aggregate([
      {
        $match: {
          ...periodFilter,
          status: { $in: ['cliente', 'proposta'] },
          'simulation.monthlyEconomy': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgMonthlyEconomy: { $avg: '$simulation.monthlyEconomy' },
          totalRevenue: { $sum: '$simulation.monthlyEconomy' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const funnel = funnelData[0] || {};
    const conversionRates = {
      leadToInterested: funnel.total > 0 ? (funnel.interessados / funnel.total * 100).toFixed(2) : 0,
      interestedToQualified: funnel.interessados > 0 ? (funnel.qualificados / funnel.interessados * 100).toFixed(2) : 0,
      qualifiedToProposal: funnel.qualificados > 0 ? (funnel.propostas / funnel.qualificados * 100).toFixed(2) : 0,
      proposalToClient: funnel.propostas > 0 ? (funnel.clientes / funnel.propostas * 100).toFixed(2) : 0,
      overallConversion: funnel.total > 0 ? (funnel.clientes / funnel.total * 100).toFixed(2) : 0
    };
    
    res.json({
      success: true,
      data: {
        funnel,
        conversionRates,
        bySource: conversionBySource,
        avgConversionTime: avgConversionTime[0] || { avgDays: 0, minDays: 0, maxDays: 0 },
        avgDealValue: avgDealValue[0] || { avgMonthlyEconomy: 0, totalRevenue: 0, count: 0 }
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas de conversão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/metrics/ai
 * @desc Obter métricas de IA
 * @access Private
 */
router.get('/ai', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    const periodFilter = metricsService.getPeriodFilter(period);
    
    // Métricas de uso da IA
    const aiUsage = await Message.aggregate([
      {
        $match: {
          ...periodFilter,
          'analysis.aiGenerated': true
        }
      },
      {
        $group: {
          _id: null,
          totalAiMessages: { $sum: 1 },
          avgConfidence: { $avg: '$analysis.confidence' },
          avgResponseTime: { $avg: '$analysis.processingTime' },
          totalTokens: { $sum: '$analysis.tokensUsed' }
        }
      }
    ]);
    
    // Análise de intenções detectadas
    const intentionAnalysis = await Message.aggregate([
      {
        $match: {
          ...periodFilter,
          'analysis.intention': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$analysis.intention',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$analysis.confidence' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Entidades extraídas
    const entityAnalysis = await Message.aggregate([
      {
        $match: {
          ...periodFilter,
          'analysis.entities': { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$analysis.entities' },
      {
        $group: {
          _id: '$analysis.entities.type',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$analysis.entities.confidence' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Performance da IA por hora
    const hourlyPerformance = await Message.aggregate([
      {
        $match: {
          ...periodFilter,
          'analysis.aiGenerated': true
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' },
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 },
          avgProcessingTime: { $avg: '$analysis.processingTime' },
          avgConfidence: { $avg: '$analysis.confidence' }
        }
      },
      { $sort: { '_id.date': 1, '_id.hour': 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        usage: aiUsage[0] || {
          totalAiMessages: 0,
          avgConfidence: 0,
          avgResponseTime: 0,
          totalTokens: 0
        },
        intentions: intentionAnalysis,
        entities: entityAnalysis,
        hourlyPerformance
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas de IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/metrics/export
 * @desc Exportar métricas
 * @access Private
 */
router.get('/export', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily', format = 'json', type = 'all' } = req.query;
    
    let data = {};
    
    switch (type) {
      case 'clients':
        data = await metricsService.getClientMetrics(period);
        break;
      case 'campaigns':
        data = await metricsService.getCampaignMetrics(period);
        break;
      case 'messages':
        data = await metricsService.getMessageMetrics(period);
        break;
      case 'conversions':
        data = await metricsService.getConversionMetrics(period);
        break;
      default:
        data = await metricsService.getAllMetrics(period);
    }
    
    if (format === 'csv') {
      // Converter para CSV
      const csv = metricsService.convertToCSV(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="metrics-${type}-${period}-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // Retornar JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="metrics-${type}-${period}-${Date.now()}.json"`);
      res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        period,
        type,
        data
      });
    }
    
  } catch (error) {
    console.error('Erro ao exportar métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/metrics/collect
 * @desc Forçar coleta de métricas
 * @access Private
 */
router.post('/collect', authenticateToken, authorize('metrics:write'), async (req, res) => {
  try {
    const { type = 'all' } = req.body;
    
    let result;
    
    switch (type) {
      case 'hourly':
        result = await metricsService.collectHourlyMetrics();
        break;
      case 'daily':
        result = await metricsService.collectDailyMetrics();
        break;
      case 'weekly':
        result = await metricsService.collectWeeklyMetrics();
        break;
      case 'monthly':
        result = await metricsService.collectMonthlyMetrics();
        break;
      default:
        result = await metricsService.collectAllMetrics();
    }
    
    res.json({
      success: true,
      message: 'Coleta de métricas iniciada',
      type,
      result
    });
    
  } catch (error) {
    console.error('Erro ao coletar métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/metrics/realtime
 * @desc Obter métricas em tempo real
 * @access Private
 */
router.get('/realtime', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const realTimeData = await metricsService.getRealTimeMetrics();
    
    res.json({
      success: true,
      data: realTimeData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao obter métricas em tempo real:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;