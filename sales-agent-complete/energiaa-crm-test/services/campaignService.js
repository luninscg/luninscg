/**
 * SERVIÇO DE CAMPANHAS
 * Sistema completo de disparos de WhatsApp para Energiaa CRM
 */

const cron = require('node-cron');
const EventEmitter = require('events');

// Models
const Campaign = require('../models/Campaign');
const ClientModel = require('../models/Client');
const Message = require('../models/Message');

// Services
const WhatsAppService = require('./whatsappService');
const MetricsService = require('./metricsService');

class CampaignService extends EventEmitter {
  constructor() {
    super();
    this.activeCampaigns = new Map();
    this.campaignQueue = [];
    this.isProcessing = false;
    this.maxConcurrentCampaigns = 3;
    
    this.startCampaignProcessor();
    this.startScheduledCampaigns();
    
    console.log('📢 Serviço de Campanhas iniciado');
  }

  /**
   * Criar nova campanha
   */
  async createCampaign(campaignData) {
    try {
      console.log('📝 Criando nova campanha:', campaignData.name);
      
      // Validar dados da campanha
      const validatedData = this.validateCampaignData(campaignData);
      if (!validatedData.isValid) {
        return {
          success: false,
          errors: validatedData.errors
        };
      }
      
      // Criar campanha no banco
      const campaign = new Campaign(validatedData.data);
      await campaign.save();
      
      // Se for execução imediata, adicionar à fila
      if (campaign.scheduling.type === 'imediato') {
        this.queueCampaign(campaign._id);
      }
      
      console.log(`✅ Campanha criada: ${campaign._id}`);
      
      return {
        success: true,
        campaignId: campaign._id,
        campaign
      };
      
    } catch (error) {
      console.error('❌ Erro ao criar campanha:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar dados da campanha
   */
  validateCampaignData(data) {
    const errors = [];
    
    // Campos obrigatórios
    if (!data.name) errors.push('Nome da campanha é obrigatório');
    if (!data.message || !data.message.text) errors.push('Mensagem é obrigatória');
    if (!data.audience || !data.audience.type) errors.push('Tipo de audiência é obrigatório');
    
    // Validar agendamento
    if (data.scheduling && data.scheduling.type === 'agendado' && !data.scheduling.scheduledFor) {
      errors.push('Data de agendamento é obrigatória');
    }
    
    // Validar configurações de envio
    if (data.sendingConfig) {
      if (data.sendingConfig.batchSize && data.sendingConfig.batchSize > 100) {
        errors.push('Tamanho do lote não pode exceder 100');
      }
      if (data.sendingConfig.delayBetweenMessages && data.sendingConfig.delayBetweenMessages < 1000) {
        errors.push('Delay entre mensagens deve ser de pelo menos 1 segundo');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data: {
        name: data.name,
        description: data.description || '',
        type: data.type || 'promocional',
        message: {
          text: data.message.text,
          media: data.message.media || null,
          variables: data.message.variables || []
        },
        audience: {
          type: data.audience.type,
          criteria: data.audience.criteria || {},
          excludeRecent: data.audience.excludeRecent || false,
          excludeOptOut: data.audience.excludeOptOut !== false
        },
        scheduling: {
          type: data.scheduling?.type || 'imediato',
          scheduledFor: data.scheduling?.scheduledFor || null,
          timezone: data.scheduling?.timezone || 'America/Sao_Paulo',
          recurrence: data.scheduling?.recurrence || null
        },
        sendingConfig: {
          batchSize: data.sendingConfig?.batchSize || 20,
          delayBetweenMessages: data.sendingConfig?.delayBetweenMessages || 2000,
          delayBetweenBatches: data.sendingConfig?.delayBetweenBatches || 30000,
          maxRetries: data.sendingConfig?.maxRetries || 3,
          retryDelay: data.sendingConfig?.retryDelay || 60000
        },
        abTesting: data.abTesting || null,
        createdBy: data.createdBy || 'system'
      }
    };
  }

  /**
   * Obter audiência da campanha
   */
  async getAudience(campaign) {
    try {
      console.log(`🎯 Obtendo audiência para campanha: ${campaign.name}`);
      
      let query = {};
      const criteria = campaign.audience.criteria;
      
      // Filtros por status
      if (criteria.status && criteria.status.length > 0) {
        query.status = { $in: criteria.status };
      }
      
      // Filtros por fonte
      if (criteria.source && criteria.source.length > 0) {
        query.source = { $in: criteria.source };
      }
      
      // Filtros por segmento
      if (criteria.segment && criteria.segment.length > 0) {
        query.segment = { $in: criteria.segment };
      }
      
      // Filtros por tags
      if (criteria.tags && criteria.tags.length > 0) {
        query.tags = { $in: criteria.tags };
      }
      
      // Filtros por localização
      if (criteria.location) {
        if (criteria.location.state) {
          query['contact.address.state'] = criteria.location.state;
        }
        if (criteria.location.city) {
          query['contact.address.city'] = criteria.location.city;
        }
      }
      
      // Filtros por valor da conta
      if (criteria.monthlyBill) {
        if (criteria.monthlyBill.min) {
          query['energyInfo.monthlyBill'] = { $gte: criteria.monthlyBill.min };
        }
        if (criteria.monthlyBill.max) {
          query['energyInfo.monthlyBill'] = { 
            ...query['energyInfo.monthlyBill'],
            $lte: criteria.monthlyBill.max 
          };
        }
      }
      
      // Excluir quem recebeu mensagem recentemente
      if (campaign.audience.excludeRecent) {
        const recentThreshold = new Date();
        recentThreshold.setHours(recentThreshold.getHours() - 24); // 24 horas
        
        const recentContacts = await Message.distinct('contact.phone', {
          direction: 'outbound',
          createdAt: { $gte: recentThreshold }
        });
        
        if (recentContacts.length > 0) {
          query['contact.phone'] = { $nin: recentContacts };
        }
      }
      
      // Excluir opt-outs
      if (campaign.audience.excludeOptOut) {
        query['preferences.optOut'] = { $ne: true };
      }
      
      // Apenas clientes com WhatsApp válido
      query['contact.phone'] = { 
        $exists: true, 
        $ne: null, 
        $ne: '',
        ...query['contact.phone']
      };
      
      const audience = await ClientModel.find(query)
        .select('_id contact.name contact.phone status segment tags')
        .lean();
      
      console.log(`✅ Audiência obtida: ${audience.length} contatos`);
      
      return audience;
      
    } catch (error) {
      console.error('❌ Erro ao obter audiência:', error);
      return [];
    }
  }

  /**
   * Executar campanha
   */
  async executeCampaign(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }
      
      if (campaign.status !== 'agendada') {
        throw new Error('Campanha não está agendada para execução');
      }
      
      console.log(`🚀 Executando campanha: ${campaign.name}`);
      
      // Atualizar status
      campaign.status = 'executando';
      campaign.execution.startedAt = new Date();
      await campaign.save();
      
      // Adicionar à lista de campanhas ativas
      this.activeCampaigns.set(campaignId.toString(), {
        campaign,
        startTime: Date.now(),
        processed: 0,
        sent: 0,
        errors: 0
      });
      
      // Obter audiência
      const audience = await this.getAudience(campaign);
      
      if (audience.length === 0) {
        await this.finalizeCampaign(campaignId, 'Nenhum contato encontrado na audiência');
        return;
      }
      
      // Atualizar total de contatos
      campaign.audience.totalContacts = audience.length;
      await campaign.save();
      
      // Processar em lotes
      await this.processCampaignBatches(campaign, audience);
      
    } catch (error) {
      console.error(`❌ Erro ao executar campanha ${campaignId}:`, error);
      await this.finalizeCampaign(campaignId, error.message);
    }
  }

  /**
   * Processar campanha em lotes
   */
  async processCampaignBatches(campaign, audience) {
    const campaignId = campaign._id.toString();
    const batchSize = campaign.sendingConfig.batchSize;
    const delayBetweenBatches = campaign.sendingConfig.delayBetweenBatches;
    
    console.log(`📦 Processando ${audience.length} contatos em lotes de ${batchSize}`);
    
    for (let i = 0; i < audience.length; i += batchSize) {
      // Verificar se campanha ainda está ativa
      const currentCampaign = await Campaign.findById(campaign._id);
      if (!currentCampaign || currentCampaign.status !== 'executando') {
        console.log(`⏹️ Campanha ${campaignId} foi pausada/cancelada`);
        break;
      }
      
      const batch = audience.slice(i, i + batchSize);
      console.log(`📤 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(audience.length / batchSize)}`);
      
      // Processar lote
      await this.processBatch(campaign, batch);
      
      // Delay entre lotes (exceto no último)
      if (i + batchSize < audience.length) {
        console.log(`⏱️ Aguardando ${delayBetweenBatches}ms antes do próximo lote...`);
        await this.sleep(delayBetweenBatches);
      }
    }
    
    // Finalizar campanha
    await this.finalizeCampaign(campaignId);
  }

  /**
   * Processar lote de mensagens
   */
  async processBatch(campaign, batch) {
    const campaignId = campaign._id.toString();
    const delayBetweenMessages = campaign.sendingConfig.delayBetweenMessages;
    
    for (const contact of batch) {
      try {
        // Personalizar mensagem
        const personalizedMessage = this.personalizeMessage(campaign.message, contact);
        
        // Enviar mensagem
        const result = await this.sendCampaignMessage(campaign, contact, personalizedMessage);
        
        // Atualizar métricas
        await this.updateCampaignMetrics(campaignId, result);
        
        // Atualizar progresso
        const campaignState = this.activeCampaigns.get(campaignId);
        if (campaignState) {
          campaignState.processed++;
          if (result.success) {
            campaignState.sent++;
          } else {
            campaignState.errors++;
          }
        }
        
        // Delay entre mensagens
        if (delayBetweenMessages > 0) {
          await this.sleep(delayBetweenMessages);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar contato ${contact._id}:`, error);
        await this.updateCampaignMetrics(campaignId, { success: false, error: error.message });
      }
    }
  }

  /**
   * Personalizar mensagem
   */
  personalizeMessage(messageTemplate, contact) {
    let text = messageTemplate.text;
    
    // Variáveis padrão
    const variables = {
      '{nome}': contact.contact?.name || 'Cliente',
      '{primeiro_nome}': (contact.contact?.name || 'Cliente').split(' ')[0],
      '{telefone}': contact.contact?.phone || '',
      '{status}': contact.status || '',
      '{segmento}': contact.segment || ''
    };
    
    // Aplicar variáveis personalizadas
    if (messageTemplate.variables) {
      messageTemplate.variables.forEach(variable => {
        variables[`{${variable.name}}`] = variable.value;
      });
    }
    
    // Substituir variáveis no texto
    Object.keys(variables).forEach(key => {
      text = text.replace(new RegExp(key, 'g'), variables[key]);
    });
    
    return {
      text,
      media: messageTemplate.media
    };
  }

  /**
   * Enviar mensagem da campanha
   */
  async sendCampaignMessage(campaign, contact, message) {
    try {
      // Verificar se WhatsApp está conectado
      const whatsappService = new WhatsAppService();
      if (!whatsappService.isConnected()) {
        throw new Error('WhatsApp não está conectado');
      }
      
      // Enviar mensagem
      const result = await whatsappService.sendMessage(contact.contact.phone, message.text, message.media);
      
      if (result.success) {
        // Salvar mensagem no banco
        const messageDoc = new Message({
          campaignId: campaign._id,
          clientId: contact._id,
          contact: {
            name: contact.contact.name,
            phone: contact.contact.phone
          },
          direction: 'outbound',
          type: message.media ? 'media' : 'text',
          content: {
            text: message.text,
            media: message.media
          },
          status: 'sent',
          context: {
            campaignName: campaign.name,
            campaignType: campaign.type
          },
          technical: {
            messageId: result.messageId,
            timestamp: result.timestamp
          }
        });
        
        await messageDoc.save();
        
        // Log da campanha
        await campaign.addLog('message_sent', `Mensagem enviada para ${contact.contact.name}`, {
          contactId: contact._id,
          messageId: result.messageId
        });
        
        return {
          success: true,
          messageId: result.messageId,
          contact: contact._id
        };
      }
      
      throw new Error(result.error || 'Falha no envio');
      
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${contact.contact.phone}:`, error);
      
      // Log do erro
      await campaign.addLog('message_error', `Erro ao enviar para ${contact.contact.name}: ${error.message}`, {
        contactId: contact._id,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        contact: contact._id
      };
    }
  }

  /**
   * Atualizar métricas da campanha
   */
  async updateCampaignMetrics(campaignId, result) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) return;
      
      if (result.success) {
        campaign.metrics.sent++;
      } else {
        campaign.metrics.failed++;
      }
      
      campaign.metrics.processed++;
      
      await campaign.save();
      
    } catch (error) {
      console.error('❌ Erro ao atualizar métricas:', error);
    }
  }

  /**
   * Finalizar campanha
   */
  async finalizeCampaign(campaignId, errorMessage = null) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) return;
      
      console.log(`🏁 Finalizando campanha: ${campaign.name}`);
      
      // Atualizar status
      campaign.status = errorMessage ? 'erro' : 'concluida';
      campaign.execution.completedAt = new Date();
      
      if (errorMessage) {
        campaign.execution.error = errorMessage;
        await campaign.addLog('campaign_error', errorMessage);
      } else {
        await campaign.addLog('campaign_completed', 'Campanha concluída com sucesso');
      }
      
      // Calcular duração
      const duration = Date.now() - new Date(campaign.execution.startedAt).getTime();
      campaign.execution.duration = Math.round(duration / 1000); // segundos
      
      await campaign.save();
      
      // Remover da lista de campanhas ativas
      this.activeCampaigns.delete(campaignId.toString());
      
      // Emitir evento
      this.emit('campaignCompleted', {
        campaignId,
        campaign,
        success: !errorMessage
      });
      
      console.log(`✅ Campanha ${campaign.name} finalizada`);
      
    } catch (error) {
      console.error('❌ Erro ao finalizar campanha:', error);
    }
  }

  /**
   * Pausar campanha
   */
  async pauseCampaign(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }
      
      if (campaign.status !== 'executando') {
        throw new Error('Campanha não está em execução');
      }
      
      await campaign.pause();
      
      // Remover da lista de campanhas ativas
      this.activeCampaigns.delete(campaignId.toString());
      
      console.log(`⏸️ Campanha pausada: ${campaign.name}`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro ao pausar campanha:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retomar campanha
   */
  async resumeCampaign(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }
      
      if (campaign.status !== 'pausada') {
        throw new Error('Campanha não está pausada');
      }
      
      await campaign.resume();
      
      // Adicionar à fila para continuar execução
      this.queueCampaign(campaignId);
      
      console.log(`▶️ Campanha retomada: ${campaign.name}`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro ao retomar campanha:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancelar campanha
   */
  async cancelCampaign(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }
      
      await campaign.cancel();
      
      // Remover da lista de campanhas ativas
      this.activeCampaigns.delete(campaignId.toString());
      
      console.log(`❌ Campanha cancelada: ${campaign.name}`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro ao cancelar campanha:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Adicionar campanha à fila
   */
  queueCampaign(campaignId) {
    if (!this.campaignQueue.includes(campaignId.toString())) {
      this.campaignQueue.push(campaignId.toString());
      console.log(`📋 Campanha adicionada à fila: ${campaignId}`);
    }
  }

  /**
   * Processar fila de campanhas
   */
  async processCampaignQueue() {
    if (this.isProcessing || this.campaignQueue.length === 0) {
      return;
    }
    
    if (this.activeCampaigns.size >= this.maxConcurrentCampaigns) {
      console.log('⏳ Máximo de campanhas simultâneas atingido');
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const campaignId = this.campaignQueue.shift();
      console.log(`🔄 Processando campanha da fila: ${campaignId}`);
      
      await this.executeCampaign(campaignId);
      
    } catch (error) {
      console.error('❌ Erro ao processar fila de campanhas:', error);
    } finally {
      this.isProcessing = false;
      
      // Processar próxima campanha se houver
      if (this.campaignQueue.length > 0) {
        setTimeout(() => this.processCampaignQueue(), 1000);
      }
    }
  }

  /**
   * Iniciar processador de campanhas
   */
  startCampaignProcessor() {
    // Processar fila a cada 30 segundos
    setInterval(() => {
      this.processCampaignQueue();
    }, 30000);
    
    console.log('⚙️ Processador de campanhas iniciado');
  }

  /**
   * Iniciar verificação de campanhas agendadas
   */
  startScheduledCampaigns() {
    // Verificar campanhas agendadas a cada minuto
    cron.schedule('* * * * *', async () => {
      await this.checkScheduledCampaigns();
    });
    
    console.log('📅 Verificador de campanhas agendadas iniciado');
  }

  /**
   * Verificar campanhas agendadas
   */
  async checkScheduledCampaigns() {
    try {
      const now = new Date();
      
      const scheduledCampaigns = await Campaign.find({
        status: 'agendada',
        'scheduling.type': 'agendado',
        'scheduling.scheduledFor': { $lte: now }
      });
      
      for (const campaign of scheduledCampaigns) {
        console.log(`⏰ Executando campanha agendada: ${campaign.name}`);
        this.queueCampaign(campaign._id);
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar campanhas agendadas:', error);
    }
  }

  /**
   * Obter status das campanhas
   */
  getStatus() {
    return {
      activeCampaigns: Array.from(this.activeCampaigns.entries()).map(([id, state]) => ({
        id,
        name: state.campaign.name,
        processed: state.processed,
        sent: state.sent,
        errors: state.errors,
        startTime: state.startTime
      })),
      queueLength: this.campaignQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Obter métricas das campanhas
   */
  async getCampaignMetrics(period = 'daily') {
    try {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'hourly':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'daily':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
      
      const metrics = await Campaign.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            activeCampaigns: {
              $sum: {
                $cond: [{ $eq: ['$status', 'executando'] }, 1, 0]
              }
            },
            completedCampaigns: {
              $sum: {
                $cond: [{ $eq: ['$status', 'concluida'] }, 1, 0]
              }
            },
            totalSent: { $sum: '$metrics.sent' },
            totalDelivered: { $sum: '$metrics.delivered' },
            totalRead: { $sum: '$metrics.read' },
            totalReplied: { $sum: '$metrics.replied' },
            totalRevenue: { $sum: '$metrics.revenue' }
          }
        }
      ]);
      
      return metrics[0] || {
        totalCampaigns: 0,
        activeCampaigns: 0,
        completedCampaigns: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
        totalReplied: 0,
        totalRevenue: 0
      };
      
    } catch (error) {
      console.error('❌ Erro ao obter métricas de campanhas:', error);
      return null;
    }
  }

  /**
   * Utilitários
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parar serviço
   */
  stop() {
    console.log('🛑 Parando serviço de campanhas...');
    
    // Pausar todas as campanhas ativas
    for (const campaignId of this.activeCampaigns.keys()) {
      this.pauseCampaign(campaignId);
    }
    
    this.activeCampaigns.clear();
    this.campaignQueue = [];
    this.isProcessing = false;
    
    console.log('✅ Serviço de campanhas parado');
  }
}

module.exports = CampaignService;