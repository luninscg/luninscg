/**
 * ROTAS DO DASHBOARD
 * Sistema de dashboard principal para Energiaa CRM
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('./auth');

// Models
const ClientModel = require('../models/Client');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');
const Metrics = require('../models/Metrics');

// Services
const MetricsService = require('../services/metricsService');
const WhatsAppService = require('../services/whatsappService');
const ChatbotService = require('../services/chatbotService');

const metricsService = new MetricsService();

/**
 * @route GET /api/dashboard/overview
 * @desc Obter visão geral do dashboard
 * @access Private
 */
router.get('/overview', authenticateToken, authorize('dashboard:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    // Métricas em tempo real
    const realTimeMetrics = await metricsService.getRealTimeMetrics();
    
    // Métricas de clientes
    const clientMetrics = await getClientMetrics(period);
    
    // Métricas de campanhas
    const campaignMetrics = await getCampaignMetrics(period);
    
    // Métricas de WhatsApp
    const whatsappMetrics = await getWhatsAppMetrics(period);
    
    // Métricas de vendas
    const salesMetrics = await getSalesMetrics(period);
    
    // Status dos serviços
    const servicesStatus = {
      whatsapp: WhatsAppService.getStatus(),
      chatbot: ChatbotService.getStatus(),
      database: await getDatabaseStatus()
    };
    
    res.json({
      success: true,
      data: {
        realTime: realTimeMetrics,
        clients: clientMetrics,
        campaigns: campaignMetrics,
        whatsapp: whatsappMetrics,
        sales: salesMetrics,
        services: servicesStatus,
        period
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter overview do dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/dashboard/widgets
 * @desc Obter dados para widgets específicos
 * @access Private
 */
router.get('/widgets', authenticateToken, authorize('dashboard:read'), async (req, res) => {
  try {
    const { widgets, period = 'daily' } = req.query;
    
    if (!widgets) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro widgets é obrigatório'
      });
    }
    
    const requestedWidgets = widgets.split(',');
    const widgetData = {};
    
    for (const widget of requestedWidgets) {
      switch (widget) {
        case 'leads_funnel':
          widgetData.leads_funnel = await getLeadsFunnelData(period);
          break;
          
        case 'conversion_chart':
          widgetData.conversion_chart = await getConversionChartData(period);
          break;
          
        case 'revenue_chart':
          widgetData.revenue_chart = await getRevenueChartData(period);
          break;
          
        case 'campaign_performance':
          widgetData.campaign_performance = await getCampaignPerformanceData(period);
          break;
          
        case 'top_sources':
          widgetData.top_sources = await getTopSourcesData(period);
          break;
          
        case 'recent_activities':
          widgetData.recent_activities = await getRecentActivitiesData();
          break;
          
        case 'ai_insights':
          widgetData.ai_insights = await getAIInsightsData(period);
          break;
          
        case 'geographic_distribution':
          widgetData.geographic_distribution = await getGeographicDistributionData(period);
          break;
          
        case 'response_times':
          widgetData.response_times = await getResponseTimesData(period);
          break;
          
        case 'system_health':
          widgetData.system_health = await getSystemHealthData();
          break;
      }
    }
    
    res.json({
      success: true,
      data: widgetData
    });
    
  } catch (error) {
    console.error('Erro ao obter dados dos widgets:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/dashboard/alerts
 * @desc Obter alertas do sistema
 * @access Private
 */
router.get('/alerts', authenticateToken, authorize('dashboard:read'), async (req, res) => {
  try {
    const alerts = [];
    
    // Verificar status do WhatsApp
    const whatsappStatus = WhatsAppService.getStatus();
    if (!whatsappStatus.connected) {
      alerts.push({
        type: 'warning',
        title: 'WhatsApp Desconectado',
        message: 'O WhatsApp não está conectado. Campanhas podem não funcionar.',
        action: 'Conectar WhatsApp',
        actionUrl: '/whatsapp/connect'
      });
    }
    
    // Verificar campanhas com problemas
    const problematicCampaigns = await Campaign.find({
      status: 'erro',
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).countDocuments();
    
    if (problematicCampaigns > 0) {
      alerts.push({
        type: 'error',
        title: 'Campanhas com Erro',
        message: `${problematicCampaigns} campanha(s) com erro nas últimas 24h`,
        action: 'Ver Campanhas',
        actionUrl: '/campaigns?status=erro'
      });
    }
    
    // Verificar leads não respondidos
    const unrespondedLeads = await Message.find({
      direction: 'inbound',
      'context.hasReply': false,
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // 2 horas
    }).countDocuments();
    
    if (unrespondedLeads > 5) {
      alerts.push({
        type: 'info',
        title: 'Leads Aguardando Resposta',
        message: `${unrespondedLeads} leads aguardando resposta há mais de 2 horas`,
        action: 'Ver Conversas',
        actionUrl: '/whatsapp/conversations?status=unread'
      });
    }
    
    // Verificar uso de tokens da IA
    const todayTokens = await Message.aggregate([
      {
        $match: {
          'analysis.aiGenerated': true,
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$analysis.tokensUsed' }
        }
      }
    ]);
    
    const tokensUsed = todayTokens[0]?.totalTokens || 0;
    const tokenLimit = parseInt(process.env.DAILY_TOKEN_LIMIT) || 100000;
    
    if (tokensUsed > tokenLimit * 0.8) {
      alerts.push({
        type: 'warning',
        title: 'Limite de Tokens IA',
        message: `Uso de tokens hoje: ${tokensUsed}/${tokenLimit} (${Math.round(tokensUsed/tokenLimit*100)}%)`,
        action: 'Ver Métricas IA',
        actionUrl: '/metrics/ai'
      });
    }
    
    // Verificar performance do sistema
    const systemHealth = await getSystemHealthData();
    if (systemHealth.cpu > 80 || systemHealth.memory > 80) {
      alerts.push({
        type: 'warning',
        title: 'Performance do Sistema',
        message: `CPU: ${systemHealth.cpu}%, Memória: ${systemHealth.memory}%`,
        action: 'Ver Status',
        actionUrl: '/dashboard/system'
      });
    }
    
    res.json({
      success: true,
      data: alerts
    });
    
  } catch (error) {
    console.error('Erro ao obter alertas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/dashboard/kpis
 * @desc Obter KPIs principais
 * @access Private
 */
router.get('/kpis', authenticateToken, authorize('dashboard:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    const periodFilter = getPeriodFilter(period);
    
    // KPIs principais
    const kpis = await Promise.all([
      // Total de leads
      ClientModel.countDocuments(periodFilter),
      
      // Taxa de conversão
      getConversionRate(periodFilter),
      
      // Receita potencial
      getPotentialRevenue(periodFilter),
      
      // Tempo médio de resposta
      getAverageResponseTime(periodFilter),
      
      // Taxa de entrega WhatsApp
      getDeliveryRate(periodFilter),
      
      // Eficiência das campanhas
      getCampaignEfficiency(periodFilter),
      
      // Score de satisfação
      getSatisfactionScore(periodFilter),
      
      // ROI das campanhas
      getCampaignROI(periodFilter)
    ]);
    
    const [totalLeads, conversionRate, potentialRevenue, avgResponseTime, 
           deliveryRate, campaignEfficiency, satisfactionScore, campaignROI] = kpis;
    
    // Comparar com período anterior
    const previousPeriodFilter = getPreviousPeriodFilter(period);
    const previousKpis = await Promise.all([
      ClientModel.countDocuments(previousPeriodFilter),
      getConversionRate(previousPeriodFilter),
      getPotentialRevenue(previousPeriodFilter),
      getAverageResponseTime(previousPeriodFilter)
    ]);
    
    const kpiData = [
      {
        name: 'Total de Leads',
        value: totalLeads,
        previousValue: previousKpis[0],
        change: calculateChange(totalLeads, previousKpis[0]),
        format: 'number',
        icon: 'users'
      },
      {
        name: 'Taxa de Conversão',
        value: conversionRate,
        previousValue: previousKpis[1],
        change: calculateChange(conversionRate, previousKpis[1]),
        format: 'percentage',
        icon: 'trending-up'
      },
      {
        name: 'Receita Potencial',
        value: potentialRevenue,
        previousValue: previousKpis[2],
        change: calculateChange(potentialRevenue, previousKpis[2]),
        format: 'currency',
        icon: 'dollar-sign'
      },
      {
        name: 'Tempo de Resposta',
        value: avgResponseTime,
        previousValue: previousKpis[3],
        change: calculateChange(avgResponseTime, previousKpis[3], true), // menor é melhor
        format: 'time',
        icon: 'clock'
      },
      {
        name: 'Taxa de Entrega',
        value: deliveryRate,
        format: 'percentage',
        icon: 'send'
      },
      {
        name: 'Eficiência Campanhas',
        value: campaignEfficiency,
        format: 'percentage',
        icon: 'target'
      },
      {
        name: 'Satisfação',
        value: satisfactionScore,
        format: 'score',
        icon: 'star'
      },
      {
        name: 'ROI Campanhas',
        value: campaignROI,
        format: 'percentage',
        icon: 'trending-up'
      }
    ];
    
    res.json({
      success: true,
      data: kpiData,
      period
    });
    
  } catch (error) {
    console.error('Erro ao obter KPIs:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/dashboard/export
 * @desc Exportar dados do dashboard
 * @access Private
 */
router.get('/export', authenticateToken, authorize('dashboard:read'), async (req, res) => {
  try {
    const { format = 'json', period = 'daily' } = req.query;
    
    // Coletar todos os dados do dashboard
    const dashboardData = {
      overview: await getClientMetrics(period),
      campaigns: await getCampaignMetrics(period),
      whatsapp: await getWhatsAppMetrics(period),
      sales: await getSalesMetrics(period),
      kpis: await getKPIsData(period),
      exportedAt: new Date().toISOString(),
      period
    };
    
    if (format === 'csv') {
      const csv = convertDashboardToCSV(dashboardData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-${period}-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-${period}-${Date.now()}.json"`);
      res.json({
        success: true,
        data: dashboardData
      });
    }
    
  } catch (error) {
    console.error('Erro ao exportar dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Funções auxiliares

async function getClientMetrics(period) {
  const filter = getPeriodFilter(period);
  
  const metrics = await ClientModel.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgBill: { $avg: '$energyInfo.monthlyBill' },
        totalRevenue: { $sum: '$simulation.monthlyEconomy' }
      }
    }
  ]);
  
  const total = await ClientModel.countDocuments(filter);
  const newToday = await ClientModel.countDocuments({
    ...filter,
    createdAt: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0))
    }
  });
  
  return {
    total,
    newToday,
    byStatus: metrics,
    growth: await calculateGrowth('clients', period)
  };
}

async function getCampaignMetrics(period) {
  const filter = getPeriodFilter(period);
  
  const metrics = await Campaign.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSent: { $sum: '$metrics.sent' },
        totalDelivered: { $sum: '$metrics.delivered' },
        totalReplies: { $sum: '$metrics.replies' }
      }
    }
  ]);
  
  const active = await Campaign.countDocuments({
    status: { $in: ['executando', 'agendada'] }
  });
  
  return {
    byStatus: metrics,
    active,
    performance: await getCampaignPerformanceData(period)
  };
}

async function getWhatsAppMetrics(period) {
  const filter = getPeriodFilter(period);
  
  const metrics = await Message.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$direction',
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$engagement.responseTime' }
      }
    }
  ]);
  
  const status = WhatsAppService.getStatus();
  
  return {
    status,
    metrics,
    uniqueContacts: await Message.distinct('contact.phone', filter).then(arr => arr.length)
  };
}

async function getSalesMetrics(period) {
  const filter = getPeriodFilter(period);
  
  const sales = await ClientModel.aggregate([
    {
      $match: {
        ...filter,
        status: { $in: ['cliente', 'proposta'] }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalRevenue: { $sum: '$simulation.monthlyEconomy' },
        avgDealSize: { $avg: '$simulation.monthlyEconomy' }
      }
    }
  ]);
  
  return sales[0] || { count: 0, totalRevenue: 0, avgDealSize: 0 };
}

function getPeriodFilter(period) {
  const now = new Date();
  
  switch (period) {
    case 'daily':
      return {
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
      };
    case 'weekly':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { createdAt: { $gte: weekAgo } };
    case 'monthly':
      return {
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1)
        }
      };
    case 'yearly':
      return {
        createdAt: {
          $gte: new Date(now.getFullYear(), 0, 1)
        }
      };
    default:
      return {};
  }
}

function getPreviousPeriodFilter(period) {
  const now = new Date();
  
  switch (period) {
    case 'daily':
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return {
        createdAt: {
          $gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
          $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
      };
    case 'weekly':
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        createdAt: {
          $gte: twoWeeksAgo,
          $lt: weekAgo
        }
      };
    case 'monthly':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        createdAt: {
          $gte: lastMonth,
          $lt: thisMonth
        }
      };
    default:
      return {};
  }
}

function calculateChange(current, previous, lowerIsBetter = false) {
  if (!previous || previous === 0) return 0;
  
  const change = ((current - previous) / previous) * 100;
  return lowerIsBetter ? -change : change;
}

async function getDatabaseStatus() {
  try {
    const mongoose = require('mongoose');
    return {
      connected: mongoose.connection.readyState === 1,
      status: mongoose.connection.readyState
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// Implementar outras funções auxiliares conforme necessário...

module.exports = router;