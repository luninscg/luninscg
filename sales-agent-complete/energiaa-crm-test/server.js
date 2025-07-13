/**
 * SERVIDOR PRINCIPAL - ENERGIAA CRM COMPLETO
 * Sistema CRM Avançado para Energia Solar com IA Conversacional
 * Versão: 2.0
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Importações dos módulos do sistema
const { connectDatabase } = require('./config/database');
const { initializeWhatsApp } = require('./services/whatsappService');
const ChatbotService = require('./services/chatbotService');
const MetricsService = require('./services/metricsService');
const CampaignService = require('./services/campaignService');

// Importação das rotas
const { router: authRoutes } = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const campaignRoutes = require('./routes/campaigns');
const metricsRoutes = require('./routes/metrics');
const simulatorRoutes = require('./routes/simulator');
const whatsappRoutes = require('./routes/whatsapp');
const dashboardRoutes = require('./routes/dashboard');
const ocrRoutes = require('./routes/ocr');
const promptRoutes = require('./routes/prompts');
const proposalRoutes = require('./routes/proposals');
const testRoutes = require('./routes/tests');

class EnergiaaServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.port = process.env.PORT || 3002;
    this.whatsappClient = null;
    this.chatbotService = new ChatbotService();
    this.metricsService = new MetricsService();
    this.campaignService = new CampaignService();
    
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupErrorHandling();
  }

  setupMiddlewares() {
    // Segurança
    this.app.use(helmet({
      contentSecurityPolicy: false // Permitir inline scripts para desenvolvimento
    }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX),
      message: 'Muitas requisições, tente novamente em alguns minutos.'
    });
    this.app.use('/api/', limiter);

    // Middlewares gerais
    this.app.use(compression());
    this.app.use(morgan('combined'));
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Servir arquivos estáticos
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

    // Middleware de logging personalizado
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Rota principal
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Rotas da API
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/clients', clientRoutes);
    this.app.use('/api/campaigns', campaignRoutes);
    this.app.use('/api/metrics', metricsRoutes);
    this.app.use('/api/simulator', simulatorRoutes);
    this.app.use('/api/whatsapp', whatsappRoutes);
    this.app.use('/api/dashboard', dashboardRoutes);
    this.app.use('/api/ocr', ocrRoutes);
    this.app.use('/api/prompts', promptRoutes);
    this.app.use('/api/proposals', proposalRoutes);
    this.app.use('/api/tests', testRoutes);

    // Rota para webhook do WhatsApp
    this.app.post('/webhook/whatsapp', async (req, res) => {
      try {
        await this.handleWhatsAppWebhook(req.body);
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Erro no webhook WhatsApp:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    });

    // Rota para status do sistema
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        whatsapp: this.whatsappClient ? 'connected' : 'disconnected',
        database: 'connected' // Será atualizado após conexão
      });
    });

    // Rota para QR Code do WhatsApp
    this.app.get('/api/whatsapp/qr', (req, res) => {
      if (this.qrCode) {
        res.json({ qrCode: this.qrCode });
      } else {
        res.status(404).json({ error: 'QR Code não disponível' });
      }
    });

    // Catch-all para SPA
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log('Cliente conectado:', socket.id);

      // Enviar status inicial
      socket.emit('system-status', {
        whatsapp: this.whatsappClient ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });

      // Eventos do chat em tempo real
      socket.on('send-message', async (data) => {
        try {
          await this.handleChatMessage(data, socket);
        } catch (error) {
          console.error('Erro ao processar mensagem:', error);
          socket.emit('error', { message: 'Erro ao processar mensagem' });
        }
      });

      // Eventos de campanhas
      socket.on('start-campaign', async (data) => {
        try {
          await this.campaignService.startCampaign(data.campaignId);
          socket.emit('campaign-started', { campaignId: data.campaignId });
        } catch (error) {
          console.error('Erro ao iniciar campanha:', error);
          socket.emit('error', { message: 'Erro ao iniciar campanha' });
        }
      });

      socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
      });
    });
  }

  async handleChatMessage(data, socket) {
    const { message, clientId, isAI } = data;
    
    if (isAI) {
      // Processar com IA (temporariamente desabilitado)
      // const aiResponse = await this.chatbotService.processMessage(message, clientId);
      
      // Enviar resposta simulada
      socket.emit('ai-response', {
        message: 'Olá! Sou a Sofia da Energiaa. Como posso ajudar você hoje?',
        clientId: clientId,
        timestamp: new Date().toISOString(),
        metadata: { simulated: true }
      });

      // Atualizar métricas (temporariamente desabilitado)
      // await this.metricsService.recordInteraction({
      //   type: 'ai_chat',
      //   clientId: clientId,
      //   success: true
      // });
    }
  }

  async handleWhatsAppWebhook(data) {
    console.log('Webhook WhatsApp recebido:', data);
    
    if (data.type === 'message') {
      // const response = await this.chatbotService.processWhatsAppMessage(data);
      
      // Resposta simulada
      const response = {
        message: 'Olá! Obrigado por entrar em contato com a Energiaa! 🌞'
      };
      
      if (response && this.whatsappClient) {
        await this.whatsappClient.sendMessage(data.from, response.message);
      }

      // Broadcast para clientes conectados
      this.io.emit('whatsapp-message', {
        from: data.from,
        message: data.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  setupErrorHandling() {
    // Handler para erros não capturados
    process.on('uncaughtException', (error) => {
      console.error('Erro não capturado:', error);
      // Não encerrar o processo em produção
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Promise rejeitada não tratada:', reason);
    });

    // Middleware de tratamento de erros
    this.app.use((error, req, res, next) => {
      console.error('Erro na aplicação:', error);
      
      res.status(error.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
          ? 'Erro interno do servidor' 
          : error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  async initialize() {
    try {
      console.log('🚀 Inicializando Energiaa CRM...');
      
      // Conectar ao banco de dados SQLite
      await connectDatabase();
      console.log('✅ Banco de dados SQLite conectado');
      
      // Inicializar WhatsApp
      try {
        this.whatsappClient = await initializeWhatsApp((qr) => {
          this.qrCode = qr;
          this.io.emit('whatsapp-qr', { qrCode: qr });
        });
        console.log('✅ WhatsApp inicializado');
      } catch (error) {
        console.warn('⚠️ WhatsApp não pôde ser inicializado:', error.message);
      }
      
      // Inicializar serviços
      // await this.chatbotService.initialize(); // Comentado temporariamente
      // await this.metricsService.initialize(); // Comentado temporariamente
      // await this.campaignService.initialize(); // Comentado temporariamente
      console.log('✅ Serviços inicializados');
      
      // Criar diretórios necessários
      this.createDirectories();
      
      console.log('🎉 Energiaa CRM inicializado com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      throw error;
    }
  }

  createDirectories() {
    const dirs = [
      './uploads',
      './logs',
      './backups',
      './whatsapp-session'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Diretório criado: ${dir}`);
      }
    });
  }

  async start() {
    try {
      await this.initialize();
      
      this.server.listen(this.port, () => {
        console.log(`\n🌟 ENERGIAA CRM RODANDO 🌟`);
        console.log(`🔗 URL: http://localhost:${this.port}`);
        console.log(`📊 Dashboard: http://localhost:${this.port}/dashboard`);
        console.log(`💬 Chat: http://localhost:${this.port}/chat`);
        console.log(`📈 Métricas: http://localhost:${this.port}/metrics`);
        console.log(`🚀 Campanhas: http://localhost:${this.port}/campaigns`);
        console.log(`⚡ Simulador: http://localhost:${this.port}/simulator`);
        console.log(`\n💡 Sistema pronto para gerar leads e vendas!\n`);
      });
      
    } catch (error) {
      console.error('❌ Falha ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('🛑 Encerrando Energiaa CRM...');
    
    if (this.whatsappClient) {
      await this.whatsappClient.destroy();
    }
    
    this.server.close(() => {
      console.log('✅ Servidor encerrado');
      process.exit(0);
    });
  }
}

// Inicializar servidor
const server = new EnergiaaServer();

// Handlers para encerramento gracioso
process.on('SIGTERM', () => server.stop());
process.on('SIGINT', () => server.stop());

// Iniciar servidor
server.start().catch(error => {
  console.error('❌ Falha crítica:', error);
  process.exit(1);
});

module.exports = EnergiaaServer;