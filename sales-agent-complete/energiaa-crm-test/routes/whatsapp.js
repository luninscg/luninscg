/**
 * ROTAS DO WHATSAPP
 * Sistema de integração WhatsApp para Energiaa CRM
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('./auth');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');

// Models
const Message = require('../models/Message');
const ClientModel = require('../models/Client');

// Services
const WhatsAppService = require('../services/whatsappService');
const ChatbotService = require('../services/chatbotService');

// Configurar multer para upload de mídia
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads/whatsapp');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 16 * 1024 * 1024 // 16MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

// Rate limiting para mensagens
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 mensagens por minuto
  message: {
    success: false,
    error: 'Muitas mensagens enviadas. Aguarde um momento.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route GET /api/whatsapp/status
 * @desc Obter status da conexão WhatsApp
 * @access Private
 */
router.get('/status', authenticateToken, authorize('whatsapp:read'), (req, res) => {
  try {
    const status = WhatsAppService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('Erro ao obter status do WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/whatsapp/connect
 * @desc Iniciar conexão WhatsApp
 * @access Private
 */
router.post('/connect', authenticateToken, authorize('whatsapp:write'), async (req, res) => {
  try {
    const result = await WhatsAppService.initialize();
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Conexão WhatsApp iniciada',
      qrCode: result.qrCode
    });
    
  } catch (error) {
    console.error('Erro ao conectar WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/whatsapp/disconnect
 * @desc Desconectar WhatsApp
 * @access Private
 */
router.post('/disconnect', authenticateToken, authorize('whatsapp:write'), async (req, res) => {
  try {
    await WhatsAppService.disconnect();
    
    res.json({
      success: true,
      message: 'WhatsApp desconectado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao desconectar WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/qr
 * @desc Obter QR Code para conexão
 * @access Private
 */
router.get('/qr', authenticateToken, authorize('whatsapp:read'), (req, res) => {
  try {
    const qrCode = WhatsAppService.getQRCode();
    
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        error: 'QR Code não disponível. Inicie a conexão primeiro.'
      });
    }
    
    res.json({
      success: true,
      data: {
        qrCode,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/whatsapp/send
 * @desc Enviar mensagem via WhatsApp
 * @access Private
 */
router.post('/send', authenticateToken, authorize('whatsapp:write'), messageLimiter, async (req, res) => {
  try {
    const { to, message, type = 'text', mediaPath, clientId } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Destinatário e mensagem são obrigatórios'
      });
    }
    
    // Validar formato do número
    const phoneRegex = /^\d{10,15}$/;
    const cleanPhone = to.replace(/\D/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de telefone inválido'
      });
    }
    
    const messageData = {
      to: cleanPhone,
      message,
      type,
      mediaPath,
      clientId,
      sentBy: req.user.username
    };
    
    const result = await WhatsAppService.sendMessage(messageData);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      messageId: result.messageId
    });
    
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/whatsapp/send-media
 * @desc Enviar mídia via WhatsApp
 * @access Private
 */
router.post('/send-media', authenticateToken, authorize('whatsapp:write'), upload.single('media'), messageLimiter, async (req, res) => {
  try {
    const { to, caption, clientId } = req.body;
    
    if (!to || !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Destinatário e arquivo são obrigatórios'
      });
    }
    
    const phoneRegex = /^\d{10,15}$/;
    const cleanPhone = to.replace(/\D/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de telefone inválido'
      });
    }
    
    const messageData = {
      to: cleanPhone,
      message: caption || '',
      type: 'media',
      mediaPath: req.file.path,
      clientId,
      sentBy: req.user.username
    };
    
    const result = await WhatsAppService.sendMessage(messageData);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Mídia enviada com sucesso',
      messageId: result.messageId,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
    
  } catch (error) {
    console.error('Erro ao enviar mídia:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/messages
 * @desc Listar mensagens do WhatsApp
 * @access Private
 */
router.get('/messages', authenticateToken, authorize('whatsapp:read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      clientId,
      phone,
      direction,
      status,
      type,
      search,
      startDate,
      endDate
    } = req.query;
    
    // Construir query
    let query = {};
    
    if (clientId) query.clientId = clientId;
    if (phone) query['contact.phone'] = { $regex: phone, $options: 'i' };
    if (direction) query.direction = direction;
    if (status) query.status = status;
    if (type) query.type = type;
    
    if (search) {
      query.$or = [
        { 'content.text': { $regex: search, $options: 'i' } },
        { 'contact.name': { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Configurar paginação
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Executar query
    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('clientId', 'name phone email')
        .lean(),
      Message.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      success: true,
      data: messages,
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
    console.error('Erro ao listar mensagens:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/messages/:id
 * @desc Obter mensagem específica
 * @access Private
 */
router.get('/messages/:id', authenticateToken, authorize('whatsapp:read'), async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('clientId', 'name phone email')
      .lean();
    
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Mensagem não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: message
    });
    
  } catch (error) {
    console.error('Erro ao obter mensagem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/conversations
 * @desc Listar conversas agrupadas
 * @access Private
 */
router.get('/conversations', authenticateToken, authorize('whatsapp:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    // Agregação para agrupar mensagens por contato
    let pipeline = [
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$contact.phone',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'inbound'] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          lastActivity: { $first: '$createdAt' }
        }
      }
    ];
    
    // Filtros
    if (status === 'unread') {
      pipeline.push({
        $match: { unreadCount: { $gt: 0 } }
      });
    }
    
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'lastMessage.contact.name': { $regex: search, $options: 'i' } },
            { 'lastMessage.contact.phone': { $regex: search, $options: 'i' } },
            { 'lastMessage.content.text': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }
    
    // Ordenação e paginação
    pipeline.push(
      { $sort: { lastActivity: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );
    
    // Lookup para dados do cliente
    pipeline.push({
      $lookup: {
        from: 'clients',
        localField: 'lastMessage.clientId',
        foreignField: '_id',
        as: 'client'
      }
    });
    
    const conversations = await Message.aggregate(pipeline);
    
    // Contar total para paginação
    const totalPipeline = [
      {
        $group: {
          _id: '$contact.phone',
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'inbound'] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ];
    
    if (status === 'unread') {
      totalPipeline.push({
        $match: { unreadCount: { $gt: 0 } }
      });
    }
    
    totalPipeline.push({ $count: 'total' });
    
    const totalResult = await Message.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;
    
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      success: true,
      data: conversations,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/conversation/:phone
 * @desc Obter conversa específica por telefone
 * @access Private
 */
router.get('/conversation/:phone', authenticateToken, authorize('whatsapp:read'), async (req, res) => {
  try {
    const { phone } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Buscar mensagens da conversa
    const messages = await Message.find({
      'contact.phone': { $regex: cleanPhone }
    })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('clientId', 'name email status')
      .lean();
    
    // Buscar cliente associado
    const client = await ClientModel.findOne({
      phone: { $regex: cleanPhone }
    }).lean();
    
    // Marcar mensagens como lidas
    await Message.updateMany(
      {
        'contact.phone': { $regex: cleanPhone },
        direction: 'inbound',
        status: { $ne: 'read' }
      },
      {
        status: 'read',
        readAt: new Date()
      }
    );
    
    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Ordem cronológica
        client,
        phone: cleanPhone
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter conversa:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/whatsapp/chatbot/toggle
 * @desc Ativar/desativar chatbot
 * @access Private
 */
router.post('/chatbot/toggle', authenticateToken, authorize('whatsapp:write'), async (req, res) => {
  try {
    const { enabled } = req.body;
    
    const result = await ChatbotService.setEnabled(enabled);
    
    res.json({
      success: true,
      message: `Chatbot ${enabled ? 'ativado' : 'desativado'} com sucesso`,
      enabled: result.enabled
    });
    
  } catch (error) {
    console.error('Erro ao alterar status do chatbot:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/chatbot/status
 * @desc Obter status do chatbot
 * @access Private
 */
router.get('/chatbot/status', authenticateToken, authorize('whatsapp:read'), (req, res) => {
  try {
    const status = ChatbotService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('Erro ao obter status do chatbot:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/contacts
 * @desc Obter lista de contatos
 * @access Private
 */
router.get('/contacts', authenticateToken, authorize('whatsapp:read'), async (req, res) => {
  try {
    const contacts = await WhatsAppService.getContacts();
    
    res.json({
      success: true,
      data: contacts
    });
    
  } catch (error) {
    console.error('Erro ao obter contatos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/whatsapp/stats
 * @desc Obter estatísticas do WhatsApp
 * @access Private
 */
router.get('/stats', authenticateToken, authorize('whatsapp:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'daily':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        };
        break;
      case 'weekly':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: weekAgo } };
        break;
      case 'monthly':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        };
        break;
    }
    
    const stats = await Message.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          sentMessages: {
            $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
          },
          receivedMessages: {
            $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
          },
          deliveredMessages: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          readMessages: {
            $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$engagement.responseTime' }
        }
      }
    ]);
    
    const uniqueContacts = await Message.distinct('contact.phone', dateFilter);
    
    res.json({
      success: true,
      data: {
        ...stats[0],
        uniqueContacts: uniqueContacts.length,
        period
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