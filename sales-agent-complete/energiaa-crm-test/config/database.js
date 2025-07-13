/**
 * CONFIGURAÇÃO DO BANCO DE DADOS
 * SQLite para o Energiaa CRM - Versão Gratuita e Eficiente
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseConfig {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.dbPath = path.join(__dirname, '..', 'energiaa_crm.db');
  }

  async connectDatabase() {
    try {
      if (this.isConnected) {
        console.log('📊 Banco de dados SQLite já conectado');
        return this.connection;
      }

      console.log('🔄 Conectando ao SQLite...');
      
      // Criar diretório se não existir
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.connection = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Erro ao conectar SQLite:', err);
          throw err;
        }
        console.log('✅ SQLite conectado com sucesso');
        console.log(`📁 Banco de dados: ${this.dbPath}`);
      });

      // Inicializar tabelas
      await this.initializeTables();
      
      this.isConnected = true;
      return this.connection;
      
    } catch (error) {
      console.error('❌ Erro ao conectar SQLite:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async initializeTables() {
    return new Promise((resolve, reject) => {
      const createTables = `
        -- Tabela de Clientes
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT,
          phone TEXT UNIQUE,
          cpf TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          zipcode TEXT,
          energy_consumption REAL,
          energy_bill_value REAL,
          connection_type TEXT,
          lead_status TEXT DEFAULT 'novo',
          lead_source TEXT DEFAULT 'organico',
          interest_level TEXT,
          stage INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Tabela de Mensagens
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_phone TEXT,
          sender_type TEXT, -- 'client' ou 'agent'
          message_text TEXT,
          message_type TEXT DEFAULT 'text',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_phone) REFERENCES clients(phone)
        );

        -- Tabela de Campanhas
        CREATE TABLE IF NOT EXISTS campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'ativa',
          target_audience TEXT,
          message_template TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Tabela de Métricas
        CREATE TABLE IF NOT EXISTS metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metric_type TEXT,
          metric_value REAL,
          metric_date DATE,
          additional_data TEXT, -- JSON string
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Índices para performance
        CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
        CREATE INDEX IF NOT EXISTS idx_messages_client_phone ON messages(client_phone);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(metric_date);
      `;

      this.connection.exec(createTables, (err) => {
        if (err) {
          console.error('❌ Erro ao criar tabelas:', err);
          reject(err);
        } else {
          console.log('✅ Tabelas SQLite inicializadas');
          resolve();
        }
      });
    });
  }

  async disconnectDatabase() {
    try {
      if (this.connection) {
        await new Promise((resolve, reject) => {
          this.connection.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        this.isConnected = false;
        console.log('✅ SQLite desconectado');
      }
    } catch (error) {
      console.error('❌ Erro ao desconectar SQLite:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      database: 'SQLite',
      path: this.dbPath,
      size: this.isConnected ? this.getDatabaseSize() : 0
    };
  }

  getDatabaseSize() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const stats = fs.statSync(this.dbPath);
        return Math.round(stats.size / 1024); // KB
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Método para executar queries
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Método para executar comandos (INSERT, UPDATE, DELETE)
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }
}

const dbConfig = new DatabaseConfig();

module.exports = {
  connectDatabase: () => dbConfig.connectDatabase(),
  disconnectDatabase: () => dbConfig.disconnectDatabase(),
  getConnectionStatus: () => dbConfig.getConnectionStatus(),
  query: (sql, params) => dbConfig.query(sql, params),
  run: (sql, params) => dbConfig.run(sql, params),
  db: dbConfig
};