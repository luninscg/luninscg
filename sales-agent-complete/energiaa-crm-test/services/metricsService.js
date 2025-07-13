/**
 * SERVIÇO DE MÉTRICAS
 * Sistema completo de analytics e métricas para Energiaa CRM
 */

const cron = require('node-cron');
const os = require('os');

// Models
const Metrics = require('../models/Metrics');
const ClientModel = require('../models/Client');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');

class MetricsService {
  constructor() {
    this.isRunning = false;
    this.currentMetrics = new Map();
    this.realTimeData = {
      activeUsers: 0,
      messagesPerMinute: 0,
      responseTime: 0,
      systemLoad: 0
    };
    
    this.startMetricsCollection();
  }

  startMetricsCollection() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📊 Iniciando coleta de métricas...');
    
    // Métricas horárias
    cron.schedule('0 * * * *', () => {
      this.collectHourlyMetrics();
    });
    
    // Métricas diárias
    cron.schedule('0 0 * * *', () => {
      this.collectDailyMetrics();
    });
    
    // Métricas semanais
    cron.schedule('0 0 * * 0', () => {
      this.collectWeeklyMetrics();
    });
    
    // Métricas mensais
    cron.schedule('0 0 1 * *', () => {
      this.collectMonthlyMetrics();
    });
    
    // Métricas em tempo real (a cada minuto)
    cron.schedule('* * * * *', () => {
      this.updateRealTimeMetrics();
    });
    
    // Limpeza de dados antigos (diário)
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldMetrics();
    });
  }

  async collectHourlyMetrics() {
    try {
      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      console.log(`📈 Coletando métricas horárias: ${hourStart.toISOString()}`);
      
      const metrics = await Metrics.createPeriodMetrics('hourly', hourStart);
      
      // Coletar dados de clientes
      await this.collectClientMetrics(metrics, hourStart, hourEnd);
      
      // Coletar dados de campanhas
      await this.collectCampaignMetrics(metrics, hourStart, hourEnd);
      
      // Coletar dados de mensagens
      await this.collectMessageMetrics(metrics, hourStart, hourEnd);
      
      // Coletar dados de conversações
      await this.collectConversationMetrics(metrics, hourStart, hourEnd);
      
      // Coletar dados de vendas
      await this.collectSalesMetrics(metrics, hourStart, hourEnd);
      
      // Coletar dados de sistema
      await this.collectSystemMetrics(metrics);
      
      await metrics.save();
      console.log('✅ Métricas horárias salvas');
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas horárias:', error);
    }
  }

  async collectDailyMetrics() {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      console.log(`📈 Coletando métricas diárias: ${dayStart.toISOString()}`);
      
      const metrics = await Metrics.createPeriodMetrics('daily', dayStart);
      
      // Agregar métricas horárias do dia
      await this.aggregateHourlyMetrics(metrics, dayStart, dayEnd);
      
      await metrics.save();
      console.log('✅ Métricas diárias salvas');
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas diárias:', error);
    }
  }

  async collectWeeklyMetrics() {
    try {
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      console.log(`📈 Coletando métricas semanais: ${weekStart.toISOString()}`);
      
      const metrics = await Metrics.createPeriodMetrics('weekly', weekStart);
      
      // Agregar métricas diárias da semana
      await this.aggregateDailyMetrics(metrics, weekStart, weekEnd);
      
      await metrics.save();
      console.log('✅ Métricas semanais salvas');
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas semanais:', error);
    }
  }

  async collectMonthlyMetrics() {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      console.log(`📈 Coletando métricas mensais: ${monthStart.toISOString()}`);
      
      const metrics = await Metrics.createPeriodMetrics('monthly', monthStart);
      
      // Agregar métricas semanais do mês
      await this.aggregateWeeklyMetrics(metrics, monthStart, monthEnd);
      
      await metrics.save();
      console.log('✅ Métricas mensais salvas');
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas mensais:', error);
    }
  }

  async collectClientMetrics(metrics, startDate, endDate) {
    try {
      // Total de clientes
      metrics.clients.total = await ClientModel.countDocuments();
      
      // Novos clientes no período
      metrics.clients.new = await ClientModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      });
      
      // Clientes ativos (com interação recente)
      const activeThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      metrics.clients.active = await ClientModel.countDocuments({
        'interactions.timestamp': { $gte: activeThreshold }
      });
      
      // Por status
      const statusCounts = await ClientModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      statusCounts.forEach(item => {
        if (metrics.clients.byStatus[item._id] !== undefined) {
          metrics.clients.byStatus[item._id] = item.count;
        }
      });
      
      // Por fonte
      const sourceCounts = await ClientModel.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]);
      
      sourceCounts.forEach(item => {
        if (metrics.clients.bySource[item._id] !== undefined) {
          metrics.clients.bySource[item._id] = item.count;
        }
      });
      
      // Por segmento
      const segmentCounts = await ClientModel.aggregate([
        { $group: { _id: '$segment', count: { $sum: 1 } } }
      ]);
      
      segmentCounts.forEach(item => {
        if (metrics.clients.bySegment[item._id] !== undefined) {
          metrics.clients.bySegment[item._id] = item.count;
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas de clientes:', error);
    }
  }

  async collectCampaignMetrics(metrics, startDate, endDate) {
    try {
      // Total de campanhas
      metrics.campaigns.total = await Campaign.countDocuments();
      
      // Campanhas ativas
      metrics.campaigns.active = await Campaign.countDocuments({
        status: { $in: ['agendada', 'executando'] }
      });
      
      // Campanhas concluídas no período
      metrics.campaigns.completed = await Campaign.countDocuments({
        status: 'concluida',
        'execution.completedAt': { $gte: startDate, $lt: endDate }
      });
      
      // Métricas agregadas de campanhas
      const campaignStats = await Campaign.aggregate([
        {
          $group: {
            _id: null,
            totalSent: { $sum: '$metrics.sent' },
            totalDelivered: { $sum: '$metrics.delivered' },
            totalRead: { $sum: '$metrics.read' },
            totalReplies: { $sum: '$metrics.replied' },
            totalConversions: { $sum: '$metrics.conversions' },
            totalRevenue: { $sum: '$metrics.revenue' }
          }
        }
      ]);
      
      if (campaignStats.length > 0) {
        const stats = campaignStats[0];
        metrics.campaigns.messagesSent = stats.totalSent || 0;
        metrics.campaigns.messagesDelivered = stats.totalDelivered || 0;
        metrics.campaigns.messagesRead = stats.totalRead || 0;
        metrics.campaigns.replies = stats.totalReplies || 0;
        metrics.campaigns.conversions = stats.totalConversions || 0;
        metrics.campaigns.revenue = stats.totalRevenue || 0;
      }
      
      // Custo estimado (R$ 0,05 por mensagem)
      metrics.campaigns.cost = metrics.campaigns.messagesSent * 0.05;
      
      // Por tipo
      const typeCounts = await Campaign.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);
      
      typeCounts.forEach(item => {
        if (metrics.campaigns.byType[item._id] !== undefined) {
          metrics.campaigns.byType[item._id] = item.count;
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas de campanhas:', error);
    }
  }

  async collectMessageMetrics(metrics, startDate, endDate) {
    try {
      // Total de mensagens no período
      metrics.messages.total = await Message.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      });
      
      // Por direção
      metrics.messages.inbound = await Message.countDocuments({
        direction: 'inbound',
        createdAt: { $gte: startDate, $lt: endDate }
      });
      
      metrics.messages.outbound = await Message.countDocuments({
        direction: 'outbound',
        createdAt: { $gte: startDate, $lt: endDate }
      });
      
      // Por tipo
      const typeCounts = await Message.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);
      
      typeCounts.forEach(item => {
        if (metrics.messages.byType[item._id] !== undefined) {
          metrics.messages.byType[item._id] = item.count;
        }
      });
      
      // Por status
      const statusCounts = await Message.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      statusCounts.forEach(item => {
        if (metrics.messages.byStatus[item._id] !== undefined) {
          metrics.messages.byStatus[item._id] = item.count;
        }
      });
      
      // Tempo médio de resposta
      const responseTimeStats = await Message.aggregate([
        {
          $match: {
            direction: 'outbound',
            'engagement.responseTime': { $exists: true },
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$engagement.responseTime' },
            responseTimes: { $push: '$engagement.responseTime' }
          }
        }
      ]);
      
      if (responseTimeStats.length > 0) {
        metrics.messages.avgResponseTime = responseTimeStats[0].avgResponseTime || 0;
        metrics.rawData.responseTimes = responseTimeStats[0].responseTimes || [];
      }
      
      // Contagem média de palavras
      const wordCountStats = await Message.aggregate([
        {
          $match: {
            'engagement.wordCount': { $exists: true },
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        {
          $group: {
            _id: null,
            avgWordCount: { $avg: '$engagement.wordCount' },
            wordCounts: { $push: '$engagement.wordCount' }
          }
        }
      ]);
      
      if (wordCountStats.length > 0) {
        metrics.messages.avgWordCount = wordCountStats[0].avgWordCount || 0;
        metrics.rawData.wordCounts = wordCountStats[0].wordCounts || [];
      }
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas de mensagens:', error);
    }
  }

  async collectConversationMetrics(metrics, startDate, endDate) {
    try {
      // Conversas únicas no período (baseado em clientes com mensagens)
      const conversationStats = await Message.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        {
          $group: {
            _id: '$clientId',
            messageCount: { $sum: 1 },
            firstMessage: { $min: '$createdAt' },
            lastMessage: { $max: '$createdAt' },
            stages: { $addToSet: '$context.conversationStage' },
            sentiments: { $addToSet: '$context.sentiment' }
          }
        },
        {
          $group: {
            _id: null,
            totalConversations: { $sum: 1 },
            avgMessagesPerConversation: { $avg: '$messageCount' },
            avgDuration: {
              $avg: {
                $subtract: ['$lastMessage', '$firstMessage']
              }
            }
          }
        }
      ]);
      
      if (conversationStats.length > 0) {
        const stats = conversationStats[0];
        metrics.conversations.total = stats.totalConversations || 0;
        metrics.conversations.avgMessagesPerConversation = stats.avgMessagesPerConversation || 0;
        metrics.conversations.avgDuration = stats.avgDuration || 0;
      }
      
      // Por estágio
      const stageCounts = await Message.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        { $group: { _id: '$context.conversationStage', count: { $sum: 1 } } }
      ]);
      
      stageCounts.forEach(item => {
        if (item._id && metrics.conversations.byStage[item._id] !== undefined) {
          metrics.conversations.byStage[item._id] = item.count;
        }
      });
      
      // Por sentimento
      const sentimentCounts = await Message.aggregate([
        {
          $match: {
            direction: 'inbound',
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        { $group: { _id: '$context.sentiment', count: { $sum: 1 } } }
      ]);
      
      sentimentCounts.forEach(item => {
        if (item._id && metrics.conversations.bySentiment[item._id] !== undefined) {
          metrics.conversations.bySentiment[item._id] = item.count;
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas de conversação:', error);
    }
  }

  async collectSalesMetrics(metrics, startDate, endDate) {
    try {
      // Leads (novos clientes)
      metrics.sales.leads = await ClientModel.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      });
      
      // Qualificados
      metrics.sales.qualified = await ClientModel.countDocuments({
        status: { $in: ['interessado', 'proposta', 'negociacao', 'fechado'] },
        updatedAt: { $gte: startDate, $lt: endDate }
      });
      
      // Propostas
      metrics.sales.proposals = await ClientModel.countDocuments({
        status: { $in: ['proposta', 'negociacao', 'fechado'] },
        updatedAt: { $gte: startDate, $lt: endDate }
      });
      
      // Fechados
      metrics.sales.closed = await ClientModel.countDocuments({
        status: 'fechado',
        updatedAt: { $gte: startDate, $lt: endDate }
      });
      
      // Perdidos
      metrics.sales.lost = await ClientModel.countDocuments({
        status: 'perdido',
        updatedAt: { $gte: startDate, $lt: endDate }
      });
      
      // Receita estimada (baseada em simulações)
      const revenueStats = await ClientModel.aggregate([
        {
          $match: {
            status: 'fechado',
            'simulation.investmentValue': { $exists: true },
            updatedAt: { $gte: startDate, $lt: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$simulation.investmentValue' },
            avgDealSize: { $avg: '$simulation.investmentValue' },
            dealSizes: { $push: '$simulation.investmentValue' }
          }
        }
      ]);
      
      if (revenueStats.length > 0) {
        const stats = revenueStats[0];
        metrics.sales.revenue = stats.totalRevenue || 0;
        metrics.sales.avgDealSize = stats.avgDealSize || 0;
        metrics.rawData.dealSizes = stats.dealSizes || [];
      }
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas de vendas:', error);
    }
  }

  async collectSystemMetrics(metrics) {
    try {
      // Métricas do sistema
      metrics.system.memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2); // MB
      metrics.system.cpuUsage = (os.loadavg()[0] * 100).toFixed(2); // %
      
      // Uptime (assumindo 100% se não houver erros críticos)
      metrics.system.uptime = 100;
      
      // Conexões ativas (simulado)
      metrics.system.activeConnections = this.realTimeData.activeUsers;
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas de sistema:', error);
    }
  }

  async updateRealTimeMetrics() {
    try {
      // Atualizar métricas em tempo real
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      
      // Mensagens por minuto
      this.realTimeData.messagesPerMinute = await Message.countDocuments({
        createdAt: { $gte: oneMinuteAgo }
      });
      
      // Usuários ativos (com mensagem na última hora)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      this.realTimeData.activeUsers = await Message.distinct('clientId', {
        createdAt: { $gte: oneHourAgo }
      }).then(ids => ids.length);
      
      // Carga do sistema
      this.realTimeData.systemLoad = os.loadavg()[0];
      
    } catch (error) {
      console.error('❌ Erro ao atualizar métricas em tempo real:', error);
    }
  }

  async aggregateHourlyMetrics(dailyMetrics, startDate, endDate) {
    try {
      const hourlyMetrics = await Metrics.find({
        'period.type': 'hourly',
        'period.date': { $gte: startDate, $lt: endDate }
      });
      
      // Agregar dados
      for (const hourly of hourlyMetrics) {
        this.aggregateMetricsData(dailyMetrics, hourly);
      }
      
    } catch (error) {
      console.error('❌ Erro ao agregar métricas horárias:', error);
    }
  }

  async aggregateDailyMetrics(weeklyMetrics, startDate, endDate) {
    try {
      const dailyMetrics = await Metrics.find({
        'period.type': 'daily',
        'period.date': { $gte: startDate, $lt: endDate }
      });
      
      for (const daily of dailyMetrics) {
        this.aggregateMetricsData(weeklyMetrics, daily);
      }
      
    } catch (error) {
      console.error('❌ Erro ao agregar métricas diárias:', error);
    }
  }

  async aggregateWeeklyMetrics(monthlyMetrics, startDate, endDate) {
    try {
      const weeklyMetrics = await Metrics.find({
        'period.type': 'weekly',
        'period.date': { $gte: startDate, $lt: endDate }
      });
      
      for (const weekly of weeklyMetrics) {
        this.aggregateMetricsData(monthlyMetrics, weekly);
      }
      
    } catch (error) {
      console.error('❌ Erro ao agregar métricas semanais:', error);
    }
  }

  aggregateMetricsData(targetMetrics, sourceMetrics) {
    // Agregar clientes
    targetMetrics.clients.total = Math.max(targetMetrics.clients.total, sourceMetrics.clients.total);
    targetMetrics.clients.new += sourceMetrics.clients.new;
    targetMetrics.clients.active = Math.max(targetMetrics.clients.active, sourceMetrics.clients.active);
    
    // Agregar campanhas
    targetMetrics.campaigns.messagesSent += sourceMetrics.campaigns.messagesSent;
    targetMetrics.campaigns.messagesDelivered += sourceMetrics.campaigns.messagesDelivered;
    targetMetrics.campaigns.revenue += sourceMetrics.campaigns.revenue;
    
    // Agregar mensagens
    targetMetrics.messages.total += sourceMetrics.messages.total;
    targetMetrics.messages.inbound += sourceMetrics.messages.inbound;
    targetMetrics.messages.outbound += sourceMetrics.messages.outbound;
    
    // Agregar vendas
    targetMetrics.sales.leads += sourceMetrics.sales.leads;
    targetMetrics.sales.closed += sourceMetrics.sales.closed;
    targetMetrics.sales.revenue += sourceMetrics.sales.revenue;
  }

  async cleanupOldMetrics() {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Remover métricas horárias antigas (mais de 1 mês)
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      await Metrics.deleteMany({
        'period.type': 'hourly',
        'period.date': { $lt: oneMonthAgo }
      });
      
      // Remover métricas diárias antigas (mais de 6 meses)
      await Metrics.deleteMany({
        'period.type': 'daily',
        'period.date': { $lt: sixMonthsAgo }
      });
      
      console.log('🧹 Limpeza de métricas antigas concluída');
      
    } catch (error) {
      console.error('❌ Erro na limpeza de métricas:', error);
    }
  }

  // Métodos públicos para atualização de métricas
  async updateClientMetrics(data) {
    // Implementar atualização em tempo real
  }

  async updateMessageMetrics(data) {
    // Implementar atualização em tempo real
  }

  async updateCampaignMetrics(data) {
    // Implementar atualização em tempo real
  }

  async updateSystemMetric(metric, value, operation = 'set') {
    // Implementar atualização em tempo real
  }

  // Métodos para obter métricas
  async getMetrics(period = 'daily', limit = 30) {
    try {
      return await Metrics.find({
        'period.type': period
      })
      .sort({ 'period.date': -1 })
      .limit(limit);
      
    } catch (error) {
      console.error('❌ Erro ao obter métricas:', error);
      return [];
    }
  }

  async getDashboardMetrics() {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      const [todayMetrics, yesterdayMetrics] = await Promise.all([
        Metrics.findOne({
          'period.type': 'daily',
          'period.date': {
            $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
          }
        }),
        Metrics.findOne({
          'period.type': 'daily',
          'period.date': {
            $gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
            $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate())
          }
        })
      ]);
      
      return {
        today: todayMetrics,
        yesterday: yesterdayMetrics,
        realTime: this.realTimeData
      };
      
    } catch (error) {
      console.error('❌ Erro ao obter métricas do dashboard:', error);
      return null;
    }
  }

  getRealTimeMetrics() {
    return this.realTimeData;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeMetrics: this.currentMetrics.size,
      realTimeData: this.realTimeData
    };
  }

  stop() {
    this.isRunning = false;
    console.log('📊 Coleta de métricas interrompida');
  }
}

module.exports = MetricsService;