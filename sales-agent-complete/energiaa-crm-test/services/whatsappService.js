/**
 * SERVIÇO WHATSAPP
 * Integração completa WhatsApp Web com chatbot IA
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

// Models
const ClientModel = require('../models/Client');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const Metrics = require('../models/Metrics');

// Services
const ChatbotService = require('./chatbotService');
const MetricsService = require('./metricsService');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './whatsapp-session';
    this.chatbot = new ChatbotService();
    this.metricsService = new MetricsService();
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitDelay = parseInt(process.env.WHATSAPP_RATE_LIMIT) || 5000;
    
    this.initializeClient();
  }

  async initializeClient() {
    try {
      console.log('🚀 Inicializando cliente WhatsApp...');
      
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'energiaa-crm',
          dataPath: this.sessionPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
      });

      this.setupEventListeners();
      
      await this.client.initialize();
      
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp:', error);
      this.emit('error', error);
    }
  }

  setupEventListeners() {
    // QR Code para autenticação
    this.client.on('qr', async (qr) => {
      console.log('📱 QR Code gerado');
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.emit('qr', this.qrCode);
      } catch (error) {
        console.error('❌ Erro ao gerar QR Code:', error);
      }
    });

    // Cliente pronto
    this.client.on('ready', async () => {
      console.log('✅ WhatsApp conectado e pronto!');
      this.isReady = true;
      this.qrCode = null;
      
      const info = this.client.info;
      console.log(`📞 Conectado como: ${info.pushname} (${info.wid.user})`);
      
      this.emit('ready', info);
      this.startMessageQueueProcessor();
      
      // Atualizar métricas
      await this.metricsService.updateSystemMetric('activeConnections', 1, 'increment');
    });

    // Desconectado
    this.client.on('disconnected', (reason) => {
      console.warn('⚠️ WhatsApp desconectado:', reason);
      this.isReady = false;
      this.emit('disconnected', reason);
    });

    // Erro de autenticação
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação:', msg);
      this.emit('auth_failure', msg);
    });

    // Nova mensagem recebida
    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        await this.metricsService.updateSystemMetric('errors', 1, 'increment');
      }
    });

    // Status da mensagem atualizado
    this.client.on('message_ack', async (message, ack) => {
      try {
        await this.handleMessageAck(message, ack);
      } catch (error) {
        console.error('❌ Erro ao processar ACK:', error);
      }
    });

    // Erro geral
    this.client.on('error', (error) => {
      console.error('❌ Erro no cliente WhatsApp:', error);
      this.emit('error', error);
    });
  }

  async handleIncomingMessage(message) {
    // Ignorar mensagens de status e grupos
    if (message.isStatus || message.from.includes('@g.us')) {
      return;
    }

    // Ignorar mensagens próprias
    if (message.fromMe) {
      return;
    }

    const phone = this.extractPhoneNumber(message.from);
    const startTime = Date.now();

    console.log(`📨 Nova mensagem de ${phone}: ${message.body}`);

    try {
      // Buscar ou criar cliente
      let client = await ClientModel.findOne({ phone });
      if (!client) {
        client = await this.createNewClient(phone, message);
      }

      // Salvar mensagem no banco
      const messageDoc = await this.saveMessage(message, client._id, 'inbound');

      // Processar com chatbot
      const response = await this.chatbot.processMessage({
        text: message.body,
        phone,
        clientId: client._id,
        messageId: messageDoc._id,
        context: {
          isFirstMessage: client.interactions.length === 0,
          lastInteraction: client.lastInteraction,
          clientData: client
        }
      });

      // Adicionar interação ao cliente
      await client.addInteraction({
        type: 'whatsapp',
        message: message.body,
        direction: 'inbound',
        agent: 'client'
      });

      // Enviar resposta se necessário
      if (response.shouldRespond) {
        await this.sendResponse(phone, response, client._id);
      }

      // Atualizar métricas
      const responseTime = Date.now() - startTime;
      await this.metricsService.updateMessageMetrics({
        direction: 'inbound',
        type: this.getMessageType(message),
        responseTime,
        wordCount: message.body ? message.body.split(' ').length : 0
      });

      this.emit('message_processed', {
        phone,
        message: message.body,
        response: response.messages,
        client: client._id
      });

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      
      // Enviar mensagem de erro genérica
      await this.sendMessage(phone, {
        text: 'Desculpe, ocorreu um erro temporário. Tente novamente em alguns instantes. 🤖'
      });
    }
  }

  async createNewClient(phone, message) {
    const contact = await message.getContact();
    
    const client = new ClientModel({
      name: contact.pushname || contact.name || 'Cliente WhatsApp',
      phone,
      source: 'whatsapp',
      status: 'novo'
    });

    await client.save();
    
    // Atualizar métricas
    await this.metricsService.updateClientMetrics({
      new: 1,
      bySource: { whatsapp: 1 }
    });

    console.log(`👤 Novo cliente criado: ${client.name} (${phone})`);
    
    return client;
  }

  async saveMessage(message, clientId, direction) {
    const messageData = {
      messageId: message.id._serialized,
      clientId,
      phone: this.extractPhoneNumber(message.from),
      direction,
      type: this.getMessageType(message),
      content: await this.extractMessageContent(message),
      status: 'delivered',
      sentAt: new Date(message.timestamp * 1000),
      context: {
        isFirstMessage: direction === 'inbound'
      },
      technical: {
        whatsappId: message.id.id,
        chatId: message.from,
        deviceType: message.deviceType
      }
    };

    const messageDoc = new Message(messageData);
    await messageDoc.save();
    
    return messageDoc;
  }

  async extractMessageContent(message) {
    const content = {
      text: message.body
    };

    if (message.hasMedia) {
      try {
        const media = await message.downloadMedia();
        content.mediaType = media.mimetype;
        content.mediaSize = media.data.length;
        content.fileName = media.filename;
        
        // Salvar mídia se necessário
        if (process.env.SAVE_MEDIA === 'true') {
          const mediaPath = await this.saveMedia(media, message.id._serialized);
          content.mediaUrl = mediaPath;
        }
      } catch (error) {
        console.error('❌ Erro ao baixar mídia:', error);
      }
    }

    if (message.location) {
      content.location = {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        address: message.location.description
      };
    }

    return content;
  }

  async saveMedia(media, messageId) {
    const uploadsDir = process.env.UPLOADS_PATH || './uploads';
    const mediaDir = path.join(uploadsDir, 'whatsapp');
    
    // Criar diretório se não existir
    await fs.mkdir(mediaDir, { recursive: true });
    
    const extension = media.mimetype.split('/')[1];
    const fileName = `${messageId}.${extension}`;
    const filePath = path.join(mediaDir, fileName);
    
    await fs.writeFile(filePath, media.data, 'base64');
    
    return `/uploads/whatsapp/${fileName}`;
  }

  getMessageType(message) {
    if (message.hasMedia) {
      if (message.type === 'image') return 'image';
      if (message.type === 'video') return 'video';
      if (message.type === 'audio' || message.type === 'ptt') return 'audio';
      if (message.type === 'document') return 'document';
      if (message.type === 'sticker') return 'sticker';
    }
    
    if (message.location) return 'location';
    if (message.vCards && message.vCards.length > 0) return 'contact';
    
    return 'text';
  }

  async handleMessageAck(message, ack) {
    const status = this.getMessageStatus(ack);
    
    try {
      await Message.findOneAndUpdate(
        { messageId: message.id._serialized },
        { 
          status,
          [`${status}At`]: new Date()
        }
      );

      // Atualizar métricas de campanha se aplicável
      const messageDoc = await Message.findOne({ messageId: message.id._serialized });
      if (messageDoc && messageDoc.campaignId) {
        await Campaign.findByIdAndUpdate(
          messageDoc.campaignId,
          { $inc: { [`metrics.${status}`]: 1 } }
        );
      }

    } catch (error) {
      console.error('❌ Erro ao atualizar status da mensagem:', error);
    }
  }

  getMessageStatus(ack) {
    switch (ack) {
      case 1: return 'sent';
      case 2: return 'delivered';
      case 3: return 'read';
      default: return 'pending';
    }
  }

  async sendResponse(phone, response, clientId) {
    for (const message of response.messages) {
      await this.queueMessage({
        phone,
        content: message,
        clientId,
        priority: response.priority || 'normal'
      });
    }

    // Agendar próximas ações se necessário
    if (response.nextActions && response.nextActions.length > 0) {
      for (const action of response.nextActions) {
        await this.scheduleAction(phone, action, clientId);
      }
    }
  }

  async queueMessage(messageData) {
    this.messageQueue.push({
      ...messageData,
      timestamp: Date.now(),
      retries: 0
    });

    // Ordenar por prioridade
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  async startMessageQueueProcessor() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.messageQueue.length > 0) {
      const messageData = this.messageQueue.shift();
      
      try {
        await this.sendMessage(messageData.phone, messageData.content, messageData.clientId);
        await this.delay(this.rateLimitDelay);
        
      } catch (error) {
        console.error('❌ Erro ao enviar mensagem da fila:', error);
        
        // Retentar se não excedeu o limite
        if (messageData.retries < 3) {
          messageData.retries++;
          this.messageQueue.unshift(messageData);
          await this.delay(this.rateLimitDelay * 2); // Delay maior para retry
        }
      }
    }
    
    this.isProcessingQueue = false;
  }

  async sendMessage(phone, content, clientId = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    const chatId = `${phone}@c.us`;
    let sentMessage;

    try {
      if (content.type === 'text') {
        sentMessage = await this.client.sendMessage(chatId, content.text);
        
      } else if (content.type === 'media' && content.mediaUrl) {
        const media = MessageMedia.fromFilePath(content.mediaUrl);
        sentMessage = await this.client.sendMessage(chatId, media, {
          caption: content.caption
        });
        
      } else if (content.type === 'location') {
        sentMessage = await this.client.sendMessage(chatId, content.location);
        
      } else {
        // Fallback para texto
        sentMessage = await this.client.sendMessage(chatId, content.text || 'Mensagem');
      }

      // Salvar mensagem enviada
      if (clientId) {
        await this.saveMessage(sentMessage, clientId, 'outbound');
        
        // Adicionar interação ao cliente
        const client = await ClientModel.findById(clientId);
        if (client) {
          await client.addInteraction({
            type: 'whatsapp',
            message: content.text || 'Mídia enviada',
            direction: 'outbound',
            agent: 'AI-Sofia'
          });
        }
      }

      // Atualizar métricas
      await this.metricsService.updateMessageMetrics({
        direction: 'outbound',
        type: content.type || 'text'
      });

      console.log(`📤 Mensagem enviada para ${phone}`);
      
      return sentMessage;
      
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${phone}:`, error);
      
      // Atualizar métricas de erro
      await this.metricsService.updateMessageMetrics({
        direction: 'outbound',
        status: 'failed'
      });
      
      throw error;
    }
  }

  async sendCampaignMessage(phone, campaignId, content) {
    try {
      const sentMessage = await this.sendMessage(phone, content);
      
      // Atualizar métricas da campanha
      await Campaign.findByIdAndUpdate(
        campaignId,
        { $inc: { 'metrics.sent': 1 } }
      );

      return sentMessage;
      
    } catch (error) {
      // Atualizar métricas de erro da campanha
      await Campaign.findByIdAndUpdate(
        campaignId,
        { $inc: { 'metrics.failed': 1 } }
      );
      
      throw error;
    }
  }

  async scheduleAction(phone, action, clientId) {
    // Implementar agendamento de ações futuras
    console.log(`⏰ Ação agendada para ${phone}:`, action);
    
    // Aqui você pode integrar com um sistema de jobs/cron
    // Por exemplo, usando node-cron ou bull queue
  }

  extractPhoneNumber(from) {
    return from.replace('@c.us', '').replace(/\D/g, '');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Métodos públicos para controle
  async getStatus() {
    return {
      isReady: this.isReady,
      qrCode: this.qrCode,
      queueSize: this.messageQueue.length,
      isProcessingQueue: this.isProcessingQueue
    };
  }

  async getChats() {
    if (!this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }
    
    return await this.client.getChats();
  }

  async getContacts() {
    if (!this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }
    
    return await this.client.getContacts();
  }

  async disconnect() {
    if (this.client) {
      await this.client.destroy();
      this.isReady = false;
      console.log('📱 WhatsApp desconectado');
    }
  }

  async restart() {
    console.log('🔄 Reiniciando WhatsApp...');
    await this.disconnect();
    await this.delay(2000);
    await this.initializeClient();
  }
}

module.exports = WhatsAppService;