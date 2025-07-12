const sqlite3 = require('sqlite3').verbose();
const logger = require('./utils/logger');
const db = new sqlite3.Database('./crm.db');

// 3. Otimizar database com índices
const initializeDb = () => {
    db.serialize(() => {
        // Atualizar schema da tabela CRM (linha ~6)
        db.run(`CREATE TABLE IF NOT EXISTS crm (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            whatsapp_number TEXT UNIQUE,
            name TEXT,
            cpf TEXT,
            email TEXT,
            address TEXT,
            address_logradouro TEXT,
            address_numero TEXT,
            address_bairro TEXT,
            address_cidade TEXT,
            address_uf TEXT,
            consumo_medio REAL,
            taxa_iluminacao REAL,
            tipo_conexao TEXT,
            stage INTEGER DEFAULT 0,
            last_interaction_timestamp TEXT,
            protocol TEXT,
            source TEXT,
            summary TEXT,
            interest_level TEXT,
            fatura_nome_titular TEXT,
            fatura_cpf_cnpj_titular TEXT,
            proposta_enviada BOOLEAN DEFAULT 0,
            proposta_data TEXT,
            proposta_session_id TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_whatsapp TEXT,
            sender TEXT, -- 'user' or 'agent'
            message TEXT,
            timestamp TEXT,
            FOREIGN KEY (lead_whatsapp) REFERENCES crm (whatsapp_number)
        )`);
        
        // Adicionar índices para performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_whatsapp ON crm(whatsapp_number)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_stage ON crm(stage)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_last_interaction ON crm(last_interaction_timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_whatsapp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);
        
        logger.info('Índices de database criados com sucesso');
    });
};

const getLead = (whatsappNumber) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM crm WHERE whatsapp_number = ?', [whatsappNumber], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

const getAllLeads = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM crm ORDER BY last_interaction_timestamp DESC', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

const addLead = (leadData) => {
    return new Promise((resolve, reject) => {
        const columns = Object.keys(leadData).join(', ');
        const placeholders = Object.keys(leadData).map(() => '?').join(', ');
        const values = Object.values(leadData);

        const sql = `INSERT INTO crm (${columns}) VALUES (${placeholders})`;
        db.run(sql, values, function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
        });
    });
};

const updateLead = (whatsappNumber, leadData) => {
    return new Promise((resolve, reject) => {
        const updates = Object.keys(leadData).map(col => `${col} = ?`).join(', ');
        const values = [...Object.values(leadData), whatsappNumber];

        const sql = `UPDATE crm SET ${updates} WHERE whatsapp_number = ?`;
        db.run(sql, values, function(err) {
            if (err) return reject(err);
            resolve(this.changes);
        });
    });
};

const addMessage = (leadWhatsapp, sender, message) => {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        const sql = `INSERT INTO messages (lead_whatsapp, sender, message, timestamp) VALUES (?, ?, ?, ?)`;
        db.run(sql, [leadWhatsapp, sender, message, timestamp], function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
        });
    });
};

const getMessages = (leadWhatsapp) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM messages WHERE lead_whatsapp = ? ORDER BY timestamp ASC', [leadWhatsapp], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

module.exports = {
    initializeDb,
    getLead,
    getAllLeads,
    addLead,
    updateLead,
    addMessage,
    getMessages
};