/**
 * MODELO DE CLIENTE
 * Classe para clientes do Energiaa CRM - SQLite
 */

const db = require('../config/database');

class Client {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.phone = data.phone || '';
    this.email = data.email || '';
    
    // Dados de contato (JSON)
    this.address = data.address || {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      coordinates: { lat: null, lng: null }
    };

    // Informações de energia (JSON)
    this.energyData = data.energyData || {
      monthlyBill: 0,
      monthlyConsumption: 0,
      roofType: 'ceramica',
      roofArea: 0,
      hasShading: false,
      propertyType: 'residencial'
    };

    // Status do lead
    this.status = data.status || 'novo';
    
    // Origem do lead
    this.source = data.source || 'whatsapp';

    // Interesse e qualificação (JSON)
    this.interest = data.interest || {
      level: 5,
      reasons: [],
      objections: [],
      timeline: '3-6meses'
    };

    // Simulação de economia (JSON)
    this.simulation = data.simulation || {
      estimatedSavings: {
        monthly: null,
        annual: null,
        total25years: null
      },
      systemSize: null,
      panelsQuantity: null,
      investmentValue: null,
      paybackTime: null,
      co2Reduction: null,
      lastUpdated: null
    };

    // Histórico de interações (JSON)
    this.interactions = data.interactions || [];

    // Campanhas relacionadas (JSON)
    this.campaigns = data.campaigns || [];

    // Tags e segmentação
    this.tags = data.tags || [];
    this.segment = data.segment || 'media-renda';

    // Dados do agendamento (JSON)
    this.scheduling = data.scheduling || {
      preferredTime: '',
      preferredDays: [],
      lastScheduled: null,
      nextFollowUp: null
    };

    // Métricas e scores (JSON)
    this.scores = data.scores || {
      engagement: 50,
      conversion: 50,
      priority: 3
    };

    // Controle de qualidade
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.isBlocked = data.isBlocked || false;
    this.blockReason = data.blockReason || '';
    
    // Metadados
    this.createdBy = data.createdBy || '';
    this.updatedBy = data.updatedBy || '';
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Método para salvar no banco
  async save() {
    this.updatedAt = new Date().toISOString();
    
    // Normalizar telefone
    if (this.phone) {
      this.phone = this.phone.replace(/\D/g, '');
    }
    
    // Calcular score de engajamento
    this.calculateEngagementScore();
    
    const sql = this.id ? 
      `UPDATE clients SET 
        name = ?, phone = ?, email = ?, address = ?, energyData = ?, 
        status = ?, source = ?, interest = ?, simulation = ?, 
        interactions = ?, campaigns = ?, tags = ?, segment = ?, 
        scheduling = ?, scores = ?, isActive = ?, isBlocked = ?, 
        blockReason = ?, createdBy = ?, updatedBy = ?, notes = ?, 
        updatedAt = ?
       WHERE id = ?` :
      `INSERT INTO clients (
        name, phone, email, address, energyData, status, source, 
        interest, simulation, interactions, campaigns, tags, segment, 
        scheduling, scores, isActive, isBlocked, blockReason, 
        createdBy, updatedBy, notes, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      this.name, this.phone, this.email, 
      JSON.stringify(this.address), JSON.stringify(this.energyData),
      this.status, this.source, 
      JSON.stringify(this.interest), JSON.stringify(this.simulation),
      JSON.stringify(this.interactions), JSON.stringify(this.campaigns),
      JSON.stringify(this.tags), this.segment,
      JSON.stringify(this.scheduling), JSON.stringify(this.scores),
      this.isActive ? 1 : 0, this.isBlocked ? 1 : 0, this.blockReason,
      this.createdBy, this.updatedBy, this.notes,
      this.id ? this.updatedAt : this.createdAt,
      this.id ? this.updatedAt : this.updatedAt
    ];
    
    if (this.id) {
      params.push(this.id);
    }
    
    try {
      const result = await db.run(sql, params);
      if (!this.id) {
        this.id = result.lastID;
      }
      return this;
    } catch (error) {
      throw new Error(`Erro ao salvar cliente: ${error.message}`);
    }
  }

  // Método estático para buscar por ID
  static async findById(id) {
    try {
      const sql = 'SELECT * FROM clients WHERE id = ?';
      const row = await db.get(sql, [id]);
      
      if (!row) return null;
      
      return Client.fromDatabase(row);
    } catch (error) {
      throw new Error(`Erro ao buscar cliente: ${error.message}`);
    }
  }

  // Método estático para buscar por telefone
  static async findByPhone(phone) {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const sql = 'SELECT * FROM clients WHERE phone = ?';
      const row = await db.get(sql, [cleanPhone]);
      
      if (!row) return null;
      
      return Client.fromDatabase(row);
    } catch (error) {
      throw new Error(`Erro ao buscar cliente por telefone: ${error.message}`);
    }
  }

  // Método estático para buscar todos
  static async findAll(filters = {}) {
    try {
      let sql = 'SELECT * FROM clients WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      
      if (filters.source) {
        sql += ' AND source = ?';
        params.push(filters.source);
      }
      
      if (filters.isActive !== undefined) {
        sql += ' AND isActive = ?';
        params.push(filters.isActive ? 1 : 0);
      }
      
      sql += ' ORDER BY createdAt DESC';
      
      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }
      
      const rows = await db.all(sql, params);
      return rows.map(row => Client.fromDatabase(row));
    } catch (error) {
      throw new Error(`Erro ao buscar clientes: ${error.message}`);
    }
  }

  // Método para converter dados do banco em instância da classe
  static fromDatabase(row) {
    const data = {
      ...row,
      address: row.address ? JSON.parse(row.address) : {},
      energyData: row.energyData ? JSON.parse(row.energyData) : {},
      interest: row.interest ? JSON.parse(row.interest) : {},
      simulation: row.simulation ? JSON.parse(row.simulation) : {},
      interactions: row.interactions ? JSON.parse(row.interactions) : [],
      campaigns: row.campaigns ? JSON.parse(row.campaigns) : [],
      tags: row.tags ? JSON.parse(row.tags) : [],
      scheduling: row.scheduling ? JSON.parse(row.scheduling) : {},
      scores: row.scores ? JSON.parse(row.scores) : {},
      isActive: row.isActive === 1,
      isBlocked: row.isBlocked === 1
    };
    
    return new Client(data);
  }

  // Virtual para nome completo
  get fullName() {
    return this.name;
  }

  // Virtual para última interação
  get lastInteraction() {
    if (this.interactions && this.interactions.length > 0) {
      return this.interactions[this.interactions.length - 1];
    }
    return null;
  }

  // Método para adicionar interação
  addInteraction(interaction) {
    this.interactions.push({
      ...interaction,
      timestamp: new Date().toISOString()
    });
    return this.save();
  }

  // Método para calcular score de engajamento
  calculateEngagementScore() {
    let score = 50; // Base score
    
    // Pontuação baseada em interações
    const interactionCount = this.interactions.length;
    score += Math.min(interactionCount * 5, 30);
    
    // Pontuação baseada em respostas
    const responses = this.interactions.filter(i => i.direction === 'inbound').length;
    score += Math.min(responses * 10, 20);
    
    // Penalização por inatividade
    const lastInteraction = this.lastInteraction;
    if (lastInteraction) {
      const daysSinceLastInteraction = (Date.now() - new Date(lastInteraction.timestamp)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastInteraction > 7) {
        score -= Math.min(daysSinceLastInteraction, 30);
      }
    }
    
    this.scores.engagement = Math.max(0, Math.min(100, score));
    return this.scores.engagement;
  }

  // Método para atualizar próximo follow-up
  async scheduleNextFollowUp(days = 3) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    this.scheduling.nextFollowUp = nextDate.toISOString();
    return this.save();
  }

  // Método para deletar
  async delete() {
    if (!this.id) {
      throw new Error('Cliente não possui ID para deletar');
    }
    
    try {
      const sql = 'DELETE FROM clients WHERE id = ?';
      await db.run(sql, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Erro ao deletar cliente: ${error.message}`);
    }
  }
}

module.exports = Client;