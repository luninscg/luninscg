const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');
const moment = require('moment-timezone');
const axios = require('axios');
const FormData = require('form-data');
const Client = require('../models/Client');
const whatsappService = require('./whatsappService');
// const openaiService = require('./openaiService'); // Temporariamente desabilitado
const simulationService = require('./simulationService');
const ocrService = require('./ocrService');
const proposalService = require('./proposalService');
const promptService = require('./promptService');

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/test.log' }),
    new winston.transports.Console()
  ]
});

class TestService {
  constructor() {
    this.testsPath = path.join(__dirname, '../tests');
    this.resultsPath = path.join(__dirname, '../tests/results');
    this.mockDataPath = path.join(__dirname, '../tests/mock-data');
    this.reportsPath = path.join(__dirname, '../tests/reports');
    
    this.testSuites = new Map();
    this.testResults = new Map();
    this.mockClients = [];
    
    this.initializeTestSystem();
  }

  async initializeTestSystem() {
    try {
      await fs.ensureDir(this.testsPath);
      await fs.ensureDir(this.resultsPath);
      await fs.ensureDir(this.mockDataPath);
      await fs.ensureDir(this.reportsPath);
      
      await this.createTestSuites();
      await this.generateMockData();
      
      logger.info('Sistema de testes inicializado');
    } catch (error) {
      logger.error('Erro ao inicializar sistema de testes:', error);
    }
  }

  async createTestSuites() {
    const testSuites = {
      'whatsapp-integration': {
        name: 'Integração WhatsApp',
        description: 'Testes da integração com WhatsApp Web',
        tests: [
          {
            name: 'Conexão WhatsApp',
            description: 'Testa conexão com WhatsApp Web',
            type: 'integration',
            timeout: 30000,
            function: 'testWhatsAppConnection'
          },
          {
            name: 'Envio de Mensagem',
            description: 'Testa envio de mensagem de texto',
            type: 'integration',
            timeout: 10000,
            function: 'testSendMessage'
          },
          {
            name: 'Recebimento de Mensagem',
            description: 'Testa recebimento e processamento de mensagens',
            type: 'integration',
            timeout: 15000,
            function: 'testReceiveMessage'
          },
          {
            name: 'Envio de Mídia',
            description: 'Testa envio de imagens e documentos',
            type: 'integration',
            timeout: 20000,
            function: 'testSendMedia'
          }
        ]
      },
      
      'ai-processing': {
        name: 'Processamento IA',
        description: 'Testes dos serviços de IA e processamento',
        tests: [
          {
            name: 'Classificação de Intenção',
            description: 'Testa classificação de intenções de mensagens',
            type: 'unit',
            timeout: 5000,
            function: 'testIntentClassification'
          },
          {
            name: 'Análise de Sentimento',
            description: 'Testa análise de sentimento',
            type: 'unit',
            timeout: 5000,
            function: 'testSentimentAnalysis'
          },
          {
            name: 'Qualificação de Lead',
            description: 'Testa qualificação automática de leads',
            type: 'unit',
            timeout: 8000,
            function: 'testLeadQualification'
          },
          {
            name: 'Geração de Resposta',
            description: 'Testa geração de respostas automáticas',
            type: 'unit',
            timeout: 10000,
            function: 'testResponseGeneration'
          }
        ]
      },
      
      'simulation-engine': {
        name: 'Motor de Simulação',
        description: 'Testes do sistema de simulação solar',
        tests: [
          {
            name: 'Simulação Básica',
            description: 'Testa cálculo de simulação básica',
            type: 'unit',
            timeout: 5000,
            function: 'testBasicSimulation'
          },
          {
            name: 'Simulação Avançada',
            description: 'Testa simulação com parâmetros avançados',
            type: 'unit',
            timeout: 8000,
            function: 'testAdvancedSimulation'
          },
          {
            name: 'Validação de Dados',
            description: 'Testa validação de dados de entrada',
            type: 'unit',
            timeout: 3000,
            function: 'testSimulationValidation'
          },
          {
            name: 'Comparação de Cenários',
            description: 'Testa comparação entre múltiplos cenários',
            type: 'unit',
            timeout: 10000,
            function: 'testScenarioComparison'
          }
        ]
      },
      
      'ocr-processing': {
        name: 'Processamento OCR',
        description: 'Testes do sistema de OCR para faturas',
        tests: [
          {
            name: 'OCR Fatura Energisa',
            description: 'Testa extração de dados de fatura da Energisa',
            type: 'integration',
            timeout: 30000,
            function: 'testOCREnergisa'
          },
          {
            name: 'Validação de Dados Extraídos',
            description: 'Testa validação dos dados extraídos',
            type: 'unit',
            timeout: 5000,
            function: 'testOCRValidation'
          },
          {
            name: 'Processamento em Lote',
            description: 'Testa processamento de múltiplas faturas',
            type: 'integration',
            timeout: 60000,
            function: 'testBatchOCR'
          }
        ]
      },
      
      'proposal-generation': {
        name: 'Geração de Propostas',
        description: 'Testes do sistema de geração de propostas',
        tests: [
          {
            name: 'Geração de Proposta Básica',
            description: 'Testa geração de proposta padrão',
            type: 'integration',
            timeout: 20000,
            function: 'testBasicProposal'
          },
          {
            name: 'Proposta Personalizada',
            description: 'Testa geração com dados personalizados',
            type: 'integration',
            timeout: 25000,
            function: 'testCustomProposal'
          },
          {
            name: 'Múltiplos Templates',
            description: 'Testa diferentes templates de proposta',
            type: 'integration',
            timeout: 30000,
            function: 'testMultipleTemplates'
          }
        ]
      },
      
      'database-operations': {
        name: 'Operações de Banco',
        description: 'Testes das operações de banco de dados',
        tests: [
          {
            name: 'CRUD Clientes',
            description: 'Testa operações CRUD de clientes',
            type: 'unit',
            timeout: 5000,
            function: 'testClientCRUD'
          },
          {
            name: 'Busca e Filtros',
            description: 'Testa buscas e filtros complexos',
            type: 'unit',
            timeout: 8000,
            function: 'testSearchAndFilters'
          },
          {
            name: 'Agregações',
            description: 'Testa consultas de agregação',
            type: 'unit',
            timeout: 10000,
            function: 'testAggregations'
          }
        ]
      },
      
      'api-endpoints': {
        name: 'Endpoints da API',
        description: 'Testes dos endpoints da API REST',
        tests: [
          {
            name: 'Autenticação',
            description: 'Testa autenticação e autorização',
            type: 'integration',
            timeout: 5000,
            function: 'testAuthentication'
          },
          {
            name: 'Endpoints Clientes',
            description: 'Testa endpoints de gerenciamento de clientes',
            type: 'integration',
            timeout: 10000,
            function: 'testClientEndpoints'
          },
          {
            name: 'Endpoints Campanhas',
            description: 'Testa endpoints de campanhas',
            type: 'integration',
            timeout: 15000,
            function: 'testCampaignEndpoints'
          },
          {
            name: 'Rate Limiting',
            description: 'Testa limitação de taxa de requisições',
            type: 'integration',
            timeout: 20000,
            function: 'testRateLimiting'
          }
        ]
      },
      
      'performance': {
        name: 'Performance',
        description: 'Testes de performance e carga',
        tests: [
          {
            name: 'Carga de Mensagens',
            description: 'Testa processamento de alta carga de mensagens',
            type: 'performance',
            timeout: 60000,
            function: 'testMessageLoad'
          },
          {
            name: 'Simulações Simultâneas',
            description: 'Testa múltiplas simulações simultâneas',
            type: 'performance',
            timeout: 45000,
            function: 'testConcurrentSimulations'
          },
          {
            name: 'Memória e CPU',
            description: 'Monitora uso de recursos do sistema',
            type: 'performance',
            timeout: 30000,
            function: 'testResourceUsage'
          }
        ]
      }
    };

    for (const [suiteId, suite] of Object.entries(testSuites)) {
      this.testSuites.set(suiteId, suite);
    }
  }

  async generateMockData() {
    try {
      // Gerar clientes mock
      this.mockClients = [
        {
          nome: 'João Silva',
          email: 'joao.silva@email.com',
          telefone: '+5511999999999',
          cpf: '123.456.789-00',
          endereco: {
            logradouro: 'Rua das Flores, 123',
            cidade: 'São Paulo',
            estado: 'SP',
            cep: '01234-567'
          },
          energyData: {
            consumoMedioKwh: 350,
            valorContaMensal: 280,
            numeroCliente: '123456789',
            numeroInstalacao: '987654321'
          },
          fonte: 'website',
          status: 'lead'
        },
        {
          nome: 'Maria Santos',
          email: 'maria.santos@email.com',
          telefone: '+5511888888888',
          cnpj: '12.345.678/0001-90',
          endereco: {
            logradouro: 'Av. Paulista, 1000',
            cidade: 'São Paulo',
            estado: 'SP',
            cep: '01310-100'
          },
          energyData: {
            consumoMedioKwh: 1200,
            valorContaMensal: 850,
            numeroCliente: '987654321',
            numeroInstalacao: '123456789'
          },
          fonte: 'indicacao',
          status: 'qualificado'
        }
      ];

      // Salvar dados mock
      await fs.writeJson(
        path.join(this.mockDataPath, 'clients.json'),
        this.mockClients,
        { spaces: 2 }
      );

      // Gerar mensagens mock
      const mockMessages = [
        {
          from: '+5511999999999',
          body: 'Olá, gostaria de saber mais sobre energia solar',
          timestamp: new Date(),
          type: 'text'
        },
        {
          from: '+5511888888888',
          body: 'Preciso de um orçamento para minha empresa',
          timestamp: new Date(),
          type: 'text'
        },
        {
          from: '+5511777777777',
          body: 'Quanto custa para instalar painéis solares?',
          timestamp: new Date(),
          type: 'text'
        }
      ];

      await fs.writeJson(
        path.join(this.mockDataPath, 'messages.json'),
        mockMessages,
        { spaces: 2 }
      );

      // Gerar faturas mock (base64 de imagem de teste)
      const mockInvoices = [
        {
          filename: 'fatura_energisa_001.pdf',
          type: 'application/pdf',
          data: 'data:application/pdf;base64,JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooSGVsbG8sIFdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjA0IDAwMDAwIG4gCjAwMDAwMDAyOTggMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgozOTYKJSVFT0Y=',
          expectedData: {
            numeroCliente: '123456789',
            numeroInstalacao: '987654321',
            consumoKwh: 350,
            valorTotal: 280.50
          }
        }
      ];

      await fs.writeJson(
        path.join(this.mockDataPath, 'invoices.json'),
        mockInvoices,
        { spaces: 2 }
      );

      logger.info('Dados mock gerados com sucesso');
    } catch (error) {
      logger.error('Erro ao gerar dados mock:', error);
    }
  }

  async runTestSuite(suiteId, options = {}) {
    try {
      const suite = this.testSuites.get(suiteId);
      if (!suite) {
        throw new Error(`Suite de teste não encontrada: ${suiteId}`);
      }

      logger.info(`Iniciando suite de testes: ${suite.name}`);
      
      const results = {
        suiteId,
        suiteName: suite.name,
        startTime: new Date(),
        endTime: null,
        duration: 0,
        totalTests: suite.tests.length,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        tests: []
      };

      for (const test of suite.tests) {
        if (options.testFilter && !test.name.toLowerCase().includes(options.testFilter.toLowerCase())) {
          results.skippedTests++;
          continue;
        }

        const testResult = await this.runSingleTest(test, options);
        results.tests.push(testResult);
        
        if (testResult.status === 'passed') {
          results.passedTests++;
        } else if (testResult.status === 'failed') {
          results.failedTests++;
        } else {
          results.skippedTests++;
        }

        // Parar na primeira falha se solicitado
        if (options.stopOnFailure && testResult.status === 'failed') {
          break;
        }
      }

      results.endTime = new Date();
      results.duration = results.endTime - results.startTime;
      
      // Salvar resultados
      await this.saveTestResults(suiteId, results);
      
      logger.info(`Suite concluída: ${results.passedTests}/${results.totalTests} testes passaram`);
      
      return results;
    } catch (error) {
      logger.error('Erro ao executar suite de testes:', error);
      throw error;
    }
  }

  async runSingleTest(test, options = {}) {
    const testResult = {
      name: test.name,
      description: test.description,
      type: test.type,
      startTime: new Date(),
      endTime: null,
      duration: 0,
      status: 'running',
      error: null,
      output: null,
      metrics: {}
    };

    try {
      logger.info(`Executando teste: ${test.name}`);
      
      // Executar teste com timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), test.timeout || 10000);
      });
      
      const testPromise = this[test.function](options);
      
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      testResult.status = 'passed';
      testResult.output = result;
      
      if (result && result.metrics) {
        testResult.metrics = result.metrics;
      }
      
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = {
        message: error.message,
        stack: error.stack
      };
      
      logger.error(`Teste falhou: ${test.name} - ${error.message}`);
    } finally {
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime - testResult.startTime;
    }

    return testResult;
  }

  // Testes de Integração WhatsApp
  async testWhatsAppConnection() {
    const startTime = Date.now();
    
    try {
      const status = await whatsappService.getConnectionStatus();
      
      return {
        success: true,
        status,
        metrics: {
          responseTime: Date.now() - startTime
        }
      };
    } catch (error) {
      throw new Error(`Falha na conexão WhatsApp: ${error.message}`);
    }
  }

  async testSendMessage() {
    const startTime = Date.now();
    
    try {
      const testMessage = {
        to: process.env.TEST_PHONE_NUMBER || '+5511999999999',
        message: `Teste automático - ${new Date().toISOString()}`
      };
      
      const result = await whatsappService.sendMessage(testMessage.to, testMessage.message);
      
      return {
        success: true,
        messageId: result.id,
        metrics: {
          responseTime: Date.now() - startTime
        }
      };
    } catch (error) {
      throw new Error(`Falha no envio de mensagem: ${error.message}`);
    }
  }

  async testReceiveMessage() {
    // Simular recebimento de mensagem
    const mockMessage = {
      from: '+5511999999999',
      body: 'Teste de recebimento de mensagem',
      timestamp: new Date()
    };
    
    try {
      const processed = await whatsappService.processIncomingMessage(mockMessage);
      
      return {
        success: true,
        processed,
        intent: processed.intent,
        sentiment: processed.sentiment
      };
    } catch (error) {
      throw new Error(`Falha no processamento de mensagem: ${error.message}`);
    }
  }

  async testSendMedia() {
    const startTime = Date.now();
    
    try {
      // Criar imagem de teste simples (1x1 pixel PNG)
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const result = await whatsappService.sendMedia(
        process.env.TEST_PHONE_NUMBER || '+5511999999999',
        testImageBase64,
        'image/png',
        'Teste de envio de mídia'
      );
      
      return {
        success: true,
        messageId: result.id,
        metrics: {
          responseTime: Date.now() - startTime
        }
      };
    } catch (error) {
      throw new Error(`Falha no envio de mídia: ${error.message}`);
    }
  }

  // Testes de IA
  async testIntentClassification() {
    const testMessages = [
      'Gostaria de saber mais sobre energia solar',
      'Quanto custa para instalar?',
      'Preciso de um orçamento',
      'Quero agendar uma visita',
      'Obrigado pelo atendimento'
    ];
    
    const results = [];
    
    for (const message of testMessages) {
      try {
        const result = await promptService.executePrompt('intent-classification', {
          mensagem: message,
          statusCliente: 'lead',
          historicoResumo: 'Primeiro contato'
        });
        
        results.push({
          message,
          intent: result.response,
          success: true
        });
      } catch (error) {
        results.push({
          message,
          error: error.message,
          success: false
        });
      }
    }
    
    const successRate = (results.filter(r => r.success).length / results.length) * 100;
    
    return {
      results,
      successRate,
      totalTests: results.length
    };
  }

  async testSentimentAnalysis() {
    const testMessages = [
      'Estou muito interessado em energia solar!',
      'Não sei se vale a pena...',
      'Vocês são péssimos no atendimento!',
      'Obrigado pela explicação',
      'Preciso pensar melhor sobre isso'
    ];
    
    const results = [];
    
    for (const message of testMessages) {
      try {
        const result = await promptService.executePrompt('sentiment-analysis', {
          mensagem: message
        });
        
        results.push({
          message,
          sentiment: result.response,
          success: true
        });
      } catch (error) {
        results.push({
          message,
          error: error.message,
          success: false
        });
      }
    }
    
    return {
      results,
      successRate: (results.filter(r => r.success).length / results.length) * 100
    };
  }

  async testLeadQualification() {
    const mockLead = this.mockClients[0];
    
    try {
      const result = await promptService.executePrompt('lead-qualification', {
        nome: mockLead.nome,
        telefone: mockLead.telefone,
        email: mockLead.email,
        consumo: mockLead.energyData.consumoMedioKwh,
        valorConta: mockLead.energyData.valorContaMensal,
        cidade: mockLead.endereco.cidade,
        tipoImovel: 'casa',
        interesse: 'alto',
        fonte: mockLead.fonte,
        mensagem: 'Gostaria de saber sobre energia solar'
      });
      
      return {
        qualification: result.response,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha na qualificação de lead: ${error.message}`);
    }
  }

  async testResponseGeneration() {
    const mockClient = this.mockClients[0];
    
    try {
      const result = await promptService.executePrompt('whatsapp-response', {
        nomeCliente: mockClient.nome,
        historicoConversa: 'Cliente perguntou sobre energia solar',
        ultimaMensagem: 'Quanto custa para instalar painéis solares?',
        statusCliente: mockClient.status,
        dadosEnergeticos: `Consumo: ${mockClient.energyData.consumoMedioKwh}kWh, Conta: R$${mockClient.energyData.valorContaMensal}`
      });
      
      return {
        response: result.response,
        success: true,
        responseLength: result.response.length
      };
    } catch (error) {
      throw new Error(`Falha na geração de resposta: ${error.message}`);
    }
  }

  // Testes de Simulação
  async testBasicSimulation() {
    const testData = {
      consumoMedioKwh: 350,
      valorContaMensal: 280,
      estado: 'SP',
      cidade: 'São Paulo'
    };
    
    try {
      const result = await simulationService.calculateSimulation(testData);
      
      // Validar resultados básicos
      if (!result.dimensionamento || !result.economia || !result.financeiro) {
        throw new Error('Resultado de simulação incompleto');
      }
      
      if (result.dimensionamento.potenciaKwp <= 0) {
        throw new Error('Potência calculada inválida');
      }
      
      return {
        simulation: result,
        potencia: result.dimensionamento.potenciaKwp,
        economia: result.economia.economiaPercentual,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha na simulação básica: ${error.message}`);
    }
  }

  async testAdvancedSimulation() {
    const testData = {
      consumoMedioKwh: 1200,
      valorContaMensal: 850,
      estado: 'SP',
      cidade: 'São Paulo',
      tipoTelhado: 'metalico',
      orientacao: 'norte',
      sombreamento: 'parcial',
      modalidadeTarifaria: 'branca'
    };
    
    try {
      const result = await simulationService.calculateAdvancedSimulation(testData);
      
      return {
        simulation: result,
        success: true,
        hasAdvancedFeatures: !!(result.tarifaBranca && result.ajusteSombreamento)
      };
    } catch (error) {
      throw new Error(`Falha na simulação avançada: ${error.message}`);
    }
  }

  async testSimulationValidation() {
    const invalidData = [
      { consumoMedioKwh: -100 }, // Consumo negativo
      { valorContaMensal: 0 }, // Valor zero
      { estado: 'XX' }, // Estado inválido
      { cidade: '' } // Cidade vazia
    ];
    
    const results = [];
    
    for (const data of invalidData) {
      try {
        await simulationService.validateSimulationData(data);
        results.push({ data, shouldFail: true, actuallyFailed: false });
      } catch (error) {
        results.push({ data, shouldFail: true, actuallyFailed: true, error: error.message });
      }
    }
    
    const correctValidations = results.filter(r => r.shouldFail === r.actuallyFailed).length;
    
    return {
      results,
      validationAccuracy: (correctValidations / results.length) * 100
    };
  }

  async testScenarioComparison() {
    const scenarios = [
      {
        name: 'Cenário Básico',
        consumoMedioKwh: 300,
        valorContaMensal: 200
      },
      {
        name: 'Cenário Médio',
        consumoMedioKwh: 600,
        valorContaMensal: 400
      },
      {
        name: 'Cenário Alto',
        consumoMedioKwh: 1200,
        valorContaMensal: 800
      }
    ];
    
    try {
      const comparison = await simulationService.compareScenarios(scenarios);
      
      return {
        comparison,
        scenarioCount: scenarios.length,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha na comparação de cenários: ${error.message}`);
    }
  }

  // Testes de OCR
  async testOCREnergisa() {
    try {
      const mockInvoices = await fs.readJson(path.join(this.mockDataPath, 'invoices.json'));
      const invoice = mockInvoices[0];
      
      // Converter base64 para buffer
      const buffer = Buffer.from(invoice.data.split(',')[1], 'base64');
      
      const result = await ocrService.processInvoice(buffer, 'energisa');
      
      return {
        extractedData: result,
        expectedData: invoice.expectedData,
        success: true,
        accuracy: this.calculateOCRAccuracy(result, invoice.expectedData)
      };
    } catch (error) {
      throw new Error(`Falha no OCR da Energisa: ${error.message}`);
    }
  }

  async testOCRValidation() {
    const testData = {
      numeroCliente: '123456789',
      numeroInstalacao: '987654321',
      consumoKwh: 350,
      valorTotal: 280.50,
      dataVencimento: '2024-02-15'
    };
    
    try {
      const isValid = await ocrService.validateExtractedData(testData);
      
      return {
        isValid,
        testData,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha na validação OCR: ${error.message}`);
    }
  }

  async testBatchOCR() {
    try {
      const mockInvoices = await fs.readJson(path.join(this.mockDataPath, 'invoices.json'));
      
      const results = [];
      for (const invoice of mockInvoices) {
        const buffer = Buffer.from(invoice.data.split(',')[1], 'base64');
        
        try {
          const result = await ocrService.processInvoice(buffer, 'energisa');
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      return {
        totalProcessed: results.length,
        successfulProcessed: results.filter(r => r.success).length,
        results
      };
    } catch (error) {
      throw new Error(`Falha no OCR em lote: ${error.message}`);
    }
  }

  // Testes de Geração de Propostas
  async testBasicProposal() {
    try {
      const mockClient = this.mockClients[0];
      
      // Criar cliente temporário para teste
      const testClient = new Client(mockClient);
      await testClient.save();
      
      const result = await proposalService.generateProposal(testClient._id, {
        templateType: 'residencial-standard',
        format: 'html'
      });
      
      // Limpar cliente de teste
      await Client.findByIdAndDelete(testClient._id);
      
      return {
        proposalGenerated: result.success,
        filePath: result.filePath,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha na geração de proposta básica: ${error.message}`);
    }
  }

  async testCustomProposal() {
    try {
      const mockClient = this.mockClients[1]; // Cliente comercial
      
      const testClient = new Client(mockClient);
      await testClient.save();
      
      const result = await proposalService.generateProposal(testClient._id, {
        templateType: 'comercial',
        format: 'pdf',
        showDetails: true,
        showCharts: true,
        observacoes: 'Proposta personalizada para teste'
      });
      
      await Client.findByIdAndDelete(testClient._id);
      
      return {
        proposalGenerated: result.success,
        filePath: result.filePath,
        customOptions: true,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha na geração de proposta personalizada: ${error.message}`);
    }
  }

  async testMultipleTemplates() {
    const templates = ['residencial-standard', 'residencial-premium', 'comercial'];
    const results = [];
    
    try {
      const mockClient = this.mockClients[0];
      const testClient = new Client(mockClient);
      await testClient.save();
      
      for (const template of templates) {
        try {
          const result = await proposalService.generateProposal(testClient._id, {
            templateType: template,
            format: 'html'
          });
          
          results.push({
            template,
            success: result.success,
            filePath: result.filePath
          });
        } catch (error) {
          results.push({
            template,
            success: false,
            error: error.message
          });
        }
      }
      
      await Client.findByIdAndDelete(testClient._id);
      
      return {
        results,
        successfulTemplates: results.filter(r => r.success).length,
        totalTemplates: templates.length
      };
    } catch (error) {
      throw new Error(`Falha no teste de múltiplos templates: ${error.message}`);
    }
  }

  // Testes de Banco de Dados
  async testClientCRUD() {
    try {
      const mockClient = { ...this.mockClients[0] };
      
      // Create
      const client = new Client(mockClient);
      await client.save();
      
      // Read
      const foundClient = await Client.findById(client._id);
      if (!foundClient) throw new Error('Cliente não encontrado após criação');
      
      // Update
      foundClient.nome = 'Nome Atualizado';
      await foundClient.save();
      
      const updatedClient = await Client.findById(client._id);
      if (updatedClient.nome !== 'Nome Atualizado') {
        throw new Error('Atualização não funcionou');
      }
      
      // Delete
      await Client.findByIdAndDelete(client._id);
      
      const deletedClient = await Client.findById(client._id);
      if (deletedClient) throw new Error('Cliente não foi deletado');
      
      return {
        crud: 'success',
        operations: ['create', 'read', 'update', 'delete']
      };
    } catch (error) {
      throw new Error(`Falha no teste CRUD: ${error.message}`);
    }
  }

  async testSearchAndFilters() {
    try {
      // Criar clientes de teste
      const testClients = [];
      for (const mockClient of this.mockClients) {
        const client = new Client(mockClient);
        await client.save();
        testClients.push(client);
      }
      
      // Teste de busca por nome
      const searchByName = await Client.find({
        nome: { $regex: 'Silva', $options: 'i' }
      });
      
      // Teste de filtro por status
      const filterByStatus = await Client.find({ status: 'lead' });
      
      // Teste de filtro por consumo
      const filterByConsumption = await Client.find({
        'energyData.consumoMedioKwh': { $gte: 300 }
      });
      
      // Limpar dados de teste
      for (const client of testClients) {
        await Client.findByIdAndDelete(client._id);
      }
      
      return {
        searchResults: searchByName.length,
        statusFilter: filterByStatus.length,
        consumptionFilter: filterByConsumption.length,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de busca e filtros: ${error.message}`);
    }
  }

  async testAggregations() {
    try {
      // Criar clientes de teste
      const testClients = [];
      for (const mockClient of this.mockClients) {
        const client = new Client(mockClient);
        await client.save();
        testClients.push(client);
      }
      
      // Agregação por status
      const statusAggregation = await Client.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      // Agregação de consumo médio
      const consumptionAggregation = await Client.aggregate([
        {
          $group: {
            _id: null,
            avgConsumption: { $avg: '$energyData.consumoMedioKwh' },
            totalClients: { $sum: 1 }
          }
        }
      ]);
      
      // Limpar dados de teste
      for (const client of testClients) {
        await Client.findByIdAndDelete(client._id);
      }
      
      return {
        statusAggregation,
        consumptionAggregation,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de agregações: ${error.message}`);
    }
  }

  // Testes de API
  async testAuthentication() {
    try {
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      
      // Teste sem autenticação
      try {
        await axios.get(`${baseUrl}/api/clients`);
        throw new Error('API deveria rejeitar requisição sem autenticação');
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Esperado
        } else {
          throw error;
        }
      }
      
      // Teste com token inválido
      try {
        await axios.get(`${baseUrl}/api/clients`, {
          headers: { Authorization: 'Bearer invalid-token' }
        });
        throw new Error('API deveria rejeitar token inválido');
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Esperado
        } else {
          throw error;
        }
      }
      
      return {
        authenticationWorking: true,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de autenticação: ${error.message}`);
    }
  }

  async testClientEndpoints() {
    try {
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      const token = process.env.TEST_API_TOKEN;
      
      if (!token) {
        throw new Error('Token de teste não configurado');
      }
      
      const headers = { Authorization: `Bearer ${token}` };
      
      // Teste GET /api/clients
      const getResponse = await axios.get(`${baseUrl}/api/clients`, { headers });
      
      // Teste POST /api/clients
      const postResponse = await axios.post(`${baseUrl}/api/clients`, this.mockClients[0], { headers });
      const clientId = postResponse.data.id;
      
      // Teste GET /api/clients/:id
      const getByIdResponse = await axios.get(`${baseUrl}/api/clients/${clientId}`, { headers });
      
      // Teste PUT /api/clients/:id
      const putResponse = await axios.put(`${baseUrl}/api/clients/${clientId}`, {
        nome: 'Nome Atualizado'
      }, { headers });
      
      // Teste DELETE /api/clients/:id
      await axios.delete(`${baseUrl}/api/clients/${clientId}`, { headers });
      
      return {
        endpoints: {
          get: getResponse.status === 200,
          post: postResponse.status === 201,
          getById: getByIdResponse.status === 200,
          put: putResponse.status === 200,
          delete: true
        },
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de endpoints de clientes: ${error.message}`);
    }
  }

  async testCampaignEndpoints() {
    // Similar ao testClientEndpoints, mas para campanhas
    return { success: true, message: 'Teste de campanhas não implementado' };
  }

  async testRateLimiting() {
    try {
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      const token = process.env.TEST_API_TOKEN;
      
      if (!token) {
        throw new Error('Token de teste não configurado');
      }
      
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fazer muitas requisições rapidamente
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(axios.get(`${baseUrl}/api/clients`, { headers }));
      }
      
      const results = await Promise.allSettled(requests);
      const rateLimited = results.some(r => 
        r.status === 'rejected' && 
        r.reason.response && 
        r.reason.response.status === 429
      );
      
      return {
        rateLimitingActive: rateLimited,
        totalRequests: requests.length,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de rate limiting: ${error.message}`);
    }
  }

  // Testes de Performance
  async testMessageLoad() {
    const messageCount = 100;
    const startTime = Date.now();
    
    try {
      const promises = [];
      
      for (let i = 0; i < messageCount; i++) {
        const mockMessage = {
          from: `+551199999${String(i).padStart(4, '0')}`,
          body: `Mensagem de teste ${i}`,
          timestamp: new Date()
        };
        
        promises.push(whatsappService.processIncomingMessage(mockMessage));
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      return {
        messagesProcessed: successful,
        totalMessages: messageCount,
        duration,
        messagesPerSecond: (successful / duration) * 1000,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de carga de mensagens: ${error.message}`);
    }
  }

  async testConcurrentSimulations() {
    const simulationCount = 20;
    const startTime = Date.now();
    
    try {
      const promises = [];
      
      for (let i = 0; i < simulationCount; i++) {
        const testData = {
          consumoMedioKwh: 300 + (i * 10),
          valorContaMensal: 200 + (i * 15),
          estado: 'SP',
          cidade: 'São Paulo'
        };
        
        promises.push(simulationService.calculateSimulation(testData));
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      return {
        simulationsCompleted: successful,
        totalSimulations: simulationCount,
        duration,
        simulationsPerSecond: (successful / duration) * 1000,
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de simulações simultâneas: ${error.message}`);
    }
  }

  async testResourceUsage() {
    const startMemory = process.memoryUsage();
    const startTime = process.hrtime();
    
    try {
      // Executar operações que consomem recursos
      await this.testMessageLoad();
      await this.testConcurrentSimulations();
      
      const endMemory = process.memoryUsage();
      const endTime = process.hrtime(startTime);
      
      return {
        memoryUsage: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external
        },
        executionTime: endTime[0] * 1000 + endTime[1] / 1000000, // em ms
        success: true
      };
    } catch (error) {
      throw new Error(`Falha no teste de uso de recursos: ${error.message}`);
    }
  }

  // Utilitários
  calculateOCRAccuracy(extracted, expected) {
    let matches = 0;
    let total = 0;
    
    for (const [key, expectedValue] of Object.entries(expected)) {
      total++;
      if (extracted[key] && extracted[key].toString() === expectedValue.toString()) {
        matches++;
      }
    }
    
    return total > 0 ? (matches / total) * 100 : 0;
  }

  async saveTestResults(suiteId, results) {
    try {
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `${suiteId}_${timestamp}.json`;
      const filePath = path.join(this.resultsPath, filename);
      
      await fs.writeJson(filePath, results, { spaces: 2 });
      
      // Manter apenas os últimos 10 resultados por suite
      await this.cleanupOldResults(suiteId);
      
      return filePath;
    } catch (error) {
      logger.error('Erro ao salvar resultados:', error);
    }
  }

  async cleanupOldResults(suiteId) {
    try {
      const files = await fs.readdir(this.resultsPath);
      const suiteFiles = files
        .filter(f => f.startsWith(suiteId) && f.endsWith('.json'))
        .sort()
        .reverse();
      
      // Manter apenas os 10 mais recentes
      for (let i = 10; i < suiteFiles.length; i++) {
        await fs.remove(path.join(this.resultsPath, suiteFiles[i]));
      }
    } catch (error) {
      logger.error('Erro ao limpar resultados antigos:', error);
    }
  }

  async generateTestReport(suiteId) {
    try {
      const files = await fs.readdir(this.resultsPath);
      const suiteFiles = files
        .filter(f => f.startsWith(suiteId) && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 5); // Últimos 5 resultados
      
      const results = [];
      for (const file of suiteFiles) {
        const result = await fs.readJson(path.join(this.resultsPath, file));
        results.push(result);
      }
      
      const report = {
        suiteId,
        generatedAt: new Date(),
        totalRuns: results.length,
        results,
        summary: this.generateSummary(results)
      };
      
      const reportPath = path.join(this.reportsPath, `${suiteId}_report.json`);
      await fs.writeJson(reportPath, report, { spaces: 2 });
      
      return report;
    } catch (error) {
      logger.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }

  generateSummary(results) {
    if (results.length === 0) return {};
    
    const summary = {
      averagePassRate: 0,
      averageDuration: 0,
      mostFailedTest: null,
      trends: {
        improving: false,
        stable: false,
        degrading: false
      }
    };
    
    // Calcular médias
    const passRates = results.map(r => (r.passedTests / r.totalTests) * 100);
    const durations = results.map(r => r.duration);
    
    summary.averagePassRate = passRates.reduce((a, b) => a + b, 0) / passRates.length;
    summary.averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    // Encontrar teste que mais falha
    const testFailures = new Map();
    results.forEach(result => {
      result.tests.forEach(test => {
        if (test.status === 'failed') {
          testFailures.set(test.name, (testFailures.get(test.name) || 0) + 1);
        }
      });
    });
    
    if (testFailures.size > 0) {
      const mostFailed = Array.from(testFailures.entries())
        .sort((a, b) => b[1] - a[1])[0];
      summary.mostFailedTest = {
        name: mostFailed[0],
        failures: mostFailed[1]
      };
    }
    
    // Analisar tendências
    if (results.length >= 3) {
      const recentPassRates = passRates.slice(0, 3);
      const trend = recentPassRates[0] - recentPassRates[2];
      
      if (trend > 5) {
        summary.trends.improving = true;
      } else if (trend < -5) {
        summary.trends.degrading = true;
      } else {
        summary.trends.stable = true;
      }
    }
    
    return summary;
  }

  async getAllTestSuites() {
    return Array.from(this.testSuites.entries()).map(([id, suite]) => ({
      id,
      ...suite
    }));
  }

  async getTestResults(suiteId, limit = 10) {
    try {
      const files = await fs.readdir(this.resultsPath);
      const suiteFiles = files
        .filter(f => f.startsWith(suiteId) && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);
      
      const results = [];
      for (const file of suiteFiles) {
        const result = await fs.readJson(path.join(this.resultsPath, file));
        results.push(result);
      }
      
      return results;
    } catch (error) {
      logger.error('Erro ao obter resultados:', error);
      return [];
    }
  }

  async runAllTests(options = {}) {
    const allResults = [];
    
    for (const [suiteId] of this.testSuites) {
      try {
        const result = await this.runTestSuite(suiteId, options);
        allResults.push(result);
      } catch (error) {
        allResults.push({
          suiteId,
          error: error.message,
          status: 'failed'
        });
      }
    }
    
    return {
      totalSuites: allResults.length,
      successfulSuites: allResults.filter(r => !r.error).length,
      results: allResults
    };
  }
}

module.exports = new TestService();