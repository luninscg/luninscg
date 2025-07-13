const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');
const moment = require('moment-timezone');
const Client = require('../models/Client');
// const openaiService = require('./openaiService'); // Temporariamente desabilitado

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/prompt.log' }),
    new winston.transports.Console()
  ]
});

class PromptService {
  constructor() {
    this.promptsPath = path.join(__dirname, '../prompts');
    this.templatesPath = path.join(__dirname, '../prompts/templates');
    this.versionsPath = path.join(__dirname, '../prompts/versions');
    this.metricsPath = path.join(__dirname, '../prompts/metrics');
    
    this.activePrompts = new Map();
    this.promptMetrics = new Map();
    this.abTestGroups = new Map();
    
    this.initializePromptSystem();
  }

  async initializePromptSystem() {
    try {
      await fs.ensureDir(this.promptsPath);
      await fs.ensureDir(this.templatesPath);
      await fs.ensureDir(this.versionsPath);
      await fs.ensureDir(this.metricsPath);
      
      await this.loadActivePrompts();
      await this.createDefaultPrompts();
      
      logger.info('Sistema de prompts inicializado');
    } catch (error) {
      logger.error('Erro ao inicializar sistema de prompts:', error);
    }
  }

  async loadActivePrompts() {
    try {
      const configPath = path.join(this.promptsPath, 'active-config.json');
      
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        
        for (const [category, promptInfo] of Object.entries(config)) {
          this.activePrompts.set(category, promptInfo);
        }
      }
    } catch (error) {
      logger.error('Erro ao carregar prompts ativos:', error);
    }
  }

  async saveActivePrompts() {
    try {
      const configPath = path.join(this.promptsPath, 'active-config.json');
      const config = Object.fromEntries(this.activePrompts);
      
      await fs.writeJson(configPath, config, { spaces: 2 });
    } catch (error) {
      logger.error('Erro ao salvar prompts ativos:', error);
    }
  }

  async createDefaultPrompts() {
    const defaultPrompts = {
      'lead-qualification': {
        name: 'Qualificação de Leads',
        description: 'Prompt para qualificar leads de energia solar',
        version: '1.0',
        template: `Você é um especialista em energia solar da Energiaa. Analise as informações do lead e determine:

1. QUALIFICAÇÃO (A, B, C, D):
   - A: Alto potencial (consumo >500kWh, renda alta, interesse imediato)
   - B: Médio potencial (consumo 200-500kWh, renda média, interesse moderado)
   - C: Baixo potencial (consumo 100-200kWh, renda baixa, interesse baixo)
   - D: Desqualificado (consumo <100kWh, sem interesse, sem viabilidade)

2. PRÓXIMOS PASSOS sugeridos
3. PRIORIDADE (Alta, Média, Baixa)
4. OBSERVAÇÕES importantes

Dados do lead:
- Nome: {nome}
- Telefone: {telefone}
- Email: {email}
- Consumo médio: {consumo} kWh/mês
- Valor da conta: R$ {valorConta}
- Cidade: {cidade}
- Tipo de imóvel: {tipoImovel}
- Interesse declarado: {interesse}
- Fonte: {fonte}
- Mensagem: {mensagem}

Responda em formato JSON estruturado.`,
        parameters: {
          temperature: 0.3,
          max_tokens: 500,
          top_p: 0.9
        },
        active: true,
        createdAt: new Date(),
        metrics: {
          usage: 0,
          avgResponseTime: 0,
          successRate: 0,
          userRating: 0
        }
      },
      
      'whatsapp-response': {
        name: 'Resposta WhatsApp',
        description: 'Prompt para respostas automáticas no WhatsApp',
        version: '1.0',
        template: `Você é um consultor especializado em energia solar da Energiaa. Responda de forma natural, amigável e profissional.

CONTEXTO:
- Cliente: {nomeCliente}
- Histórico: {historicoConversa}
- Última mensagem: {ultimaMensagem}
- Status do cliente: {statusCliente}
- Dados energéticos: {dadosEnergeticos}

DIRETRIZES:
1. Seja sempre educado e prestativo
2. Foque nos benefícios da energia solar
3. Use linguagem simples e clara
4. Ofereça simulação gratuita quando apropriado
5. Mantenha o tom conversacional
6. Não invente informações técnicas
7. Direcione para agendamento quando necessário

RESPONDA de forma natural e útil:`,
        parameters: {
          temperature: 0.7,
          max_tokens: 300,
          top_p: 0.9
        },
        active: true,
        createdAt: new Date(),
        metrics: {
          usage: 0,
          avgResponseTime: 0,
          successRate: 0,
          userRating: 0
        }
      },
      
      'intent-classification': {
        name: 'Classificação de Intenção',
        description: 'Prompt para classificar intenções de mensagens',
        version: '1.0',
        template: `Classifique a intenção da mensagem do cliente em uma das categorias:

CATEGORIAS:
1. INTERESSE_INICIAL - Cliente demonstra interesse em energia solar
2. SOLICITACAO_ORCAMENTO - Quer orçamento ou simulação
3. DUVIDA_TECNICA - Pergunta sobre funcionamento, instalação
4. DUVIDA_FINANCEIRA - Pergunta sobre preços, financiamento
5. AGENDAMENTO - Quer agendar visita ou reunião
6. RECLAMACAO - Tem alguma reclamação ou problema
7. ELOGIO - Elogia o serviço ou produto
8. CANCELAMENTO - Quer cancelar ou desistir
9. INFORMACAO_GERAL - Busca informações gerais
10. SPAM_IRRELEVANTE - Mensagem irrelevante ou spam
11. SAUDACAO - Cumprimento ou saudação
12. DESPEDIDA - Encerramento de conversa

Mensagem: "{mensagem}"

Contexto do cliente:
- Status: {statusCliente}
- Histórico: {historicoResumo}

Responda apenas com a categoria (ex: INTERESSE_INICIAL) e confiança (0-100%):`,
        parameters: {
          temperature: 0.2,
          max_tokens: 100,
          top_p: 0.8
        },
        active: true,
        createdAt: new Date(),
        metrics: {
          usage: 0,
          avgResponseTime: 0,
          successRate: 0,
          userRating: 0
        }
      },
      
      'sentiment-analysis': {
        name: 'Análise de Sentimento',
        description: 'Prompt para análise de sentimento de mensagens',
        version: '1.0',
        template: `Analise o sentimento da mensagem do cliente:

Mensagem: "{mensagem}"

Classifique em:
- POSITIVO: Cliente satisfeito, interessado, elogiando
- NEUTRO: Mensagem informativa, sem emoção clara
- NEGATIVO: Cliente insatisfeito, reclamando, rejeitando

Também identifique:
- URGENCIA (Alta/Média/Baixa)
- EMOCOES principais (máximo 3)
- NIVEL_INTERESSE (0-100%)

Responda em JSON:
{
  "sentimento": "POSITIVO/NEUTRO/NEGATIVO",
  "confianca": 85,
  "urgencia": "Alta",
  "emocoes": ["interesse", "ansiedade"],
  "nivelInteresse": 75,
  "observacoes": "Cliente demonstra interesse mas tem dúvidas"
}`,
        parameters: {
          temperature: 0.3,
          max_tokens: 200,
          top_p: 0.9
        },
        active: true,
        createdAt: new Date(),
        metrics: {
          usage: 0,
          avgResponseTime: 0,
          successRate: 0,
          userRating: 0
        }
      },
      
      'lead-scoring': {
        name: 'Pontuação de Lead',
        description: 'Prompt para calcular score de leads',
        version: '1.0',
        template: `Calcule o score do lead (0-100) baseado nos critérios:

DADOS DO LEAD:
- Consumo: {consumo} kWh/mês
- Valor conta: R$ {valorConta}
- Tipo imóvel: {tipoImovel}
- Cidade: {cidade}
- Fonte: {fonte}
- Interesse declarado: {interesse}
- Tempo de resposta: {tempoResposta}
- Engajamento: {engajamento}
- Renda estimada: {rendaEstimada}

CRITÉRIOS DE PONTUAÇÃO:
1. Consumo energético (0-25 pontos)
   - >1000 kWh: 25 pontos
   - 500-1000 kWh: 20 pontos
   - 200-500 kWh: 15 pontos
   - 100-200 kWh: 10 pontos
   - <100 kWh: 5 pontos

2. Valor da conta (0-20 pontos)
   - >R$500: 20 pontos
   - R$300-500: 15 pontos
   - R$150-300: 10 pontos
   - <R$150: 5 pontos

3. Tipo de imóvel (0-15 pontos)
   - Casa própria: 15 pontos
   - Casa alugada: 10 pontos
   - Apartamento: 8 pontos
   - Comercial: 12 pontos

4. Localização (0-10 pontos)
   - Capital/região metropolitana: 10 pontos
   - Interior desenvolvido: 8 pontos
   - Interior rural: 5 pontos

5. Fonte do lead (0-10 pontos)
   - Indicação: 10 pontos
   - Site/SEO: 8 pontos
   - Redes sociais: 6 pontos
   - Anúncios: 5 pontos

6. Engajamento (0-10 pontos)
   - Alto: 10 pontos
   - Médio: 6 pontos
   - Baixo: 3 pontos

7. Interesse declarado (0-10 pontos)
   - Muito interessado: 10 pontos
   - Interessado: 7 pontos
   - Pouco interessado: 4 pontos

Responda em JSON com score total e breakdown por critério.`,
        parameters: {
          temperature: 0.2,
          max_tokens: 400,
          top_p: 0.8
        },
        active: true,
        createdAt: new Date(),
        metrics: {
          usage: 0,
          avgResponseTime: 0,
          successRate: 0,
          userRating: 0
        }
      }
    };

    for (const [category, prompt] of Object.entries(defaultPrompts)) {
      if (!this.activePrompts.has(category)) {
        await this.createPrompt(category, prompt);
      }
    }
  }

  async createPrompt(category, promptData) {
    try {
      const promptId = `${category}_${Date.now()}`;
      const promptPath = path.join(this.templatesPath, `${promptId}.json`);
      
      const prompt = {
        id: promptId,
        category,
        ...promptData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await fs.writeJson(promptPath, prompt, { spaces: 2 });
      
      this.activePrompts.set(category, {
        id: promptId,
        version: promptData.version,
        active: true,
        filePath: promptPath
      });
      
      await this.saveActivePrompts();
      
      logger.info(`Prompt criado: ${category} (${promptId})`);
      return promptId;
    } catch (error) {
      logger.error('Erro ao criar prompt:', error);
      throw error;
    }
  }

  async updatePrompt(category, updates) {
    try {
      const activePrompt = this.activePrompts.get(category);
      if (!activePrompt) {
        throw new Error(`Prompt não encontrado: ${category}`);
      }
      
      // Criar backup da versão atual
      await this.backupPromptVersion(category);
      
      // Carregar prompt atual
      const currentPrompt = await fs.readJson(activePrompt.filePath);
      
      // Aplicar atualizações
      const updatedPrompt = {
        ...currentPrompt,
        ...updates,
        version: this.incrementVersion(currentPrompt.version),
        updatedAt: new Date()
      };
      
      // Salvar versão atualizada
      await fs.writeJson(activePrompt.filePath, updatedPrompt, { spaces: 2 });
      
      // Atualizar referência ativa
      this.activePrompts.set(category, {
        ...activePrompt,
        version: updatedPrompt.version
      });
      
      await this.saveActivePrompts();
      
      logger.info(`Prompt atualizado: ${category} v${updatedPrompt.version}`);
      return updatedPrompt;
    } catch (error) {
      logger.error('Erro ao atualizar prompt:', error);
      throw error;
    }
  }

  async backupPromptVersion(category) {
    try {
      const activePrompt = this.activePrompts.get(category);
      if (!activePrompt) return;
      
      const currentPrompt = await fs.readJson(activePrompt.filePath);
      const backupPath = path.join(
        this.versionsPath,
        `${category}_v${currentPrompt.version}_${Date.now()}.json`
      );
      
      await fs.writeJson(backupPath, currentPrompt, { spaces: 2 });
    } catch (error) {
      logger.error('Erro ao fazer backup do prompt:', error);
    }
  }

  incrementVersion(version) {
    const parts = version.split('.');
    const minor = parseInt(parts[1] || 0) + 1;
    return `${parts[0]}.${minor}`;
  }

  async getPrompt(category) {
    try {
      const activePrompt = this.activePrompts.get(category);
      if (!activePrompt || !activePrompt.active) {
        throw new Error(`Prompt não ativo: ${category}`);
      }
      
      return await fs.readJson(activePrompt.filePath);
    } catch (error) {
      logger.error(`Erro ao obter prompt ${category}:`, error);
      throw error;
    }
  }

  async executePrompt(category, variables = {}, options = {}) {
    try {
      const startTime = Date.now();
      
      const prompt = await this.getPrompt(category);
      const compiledPrompt = this.compilePrompt(prompt.template, variables);
      
      // Registrar uso
      this.recordPromptUsage(category, startTime);
      
      // Executar com OpenAI
      const response = await openaiService.generateResponse(compiledPrompt, {
        ...prompt.parameters,
        ...options
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Registrar métricas
      this.recordPromptMetrics(category, {
        responseTime,
        success: true,
        inputLength: compiledPrompt.length,
        outputLength: response.length
      });
      
      return {
        success: true,
        response,
        metadata: {
          category,
          version: prompt.version,
          responseTime,
          inputTokens: Math.ceil(compiledPrompt.length / 4),
          outputTokens: Math.ceil(response.length / 4)
        }
      };
    } catch (error) {
      logger.error(`Erro ao executar prompt ${category}:`, error);
      
      this.recordPromptMetrics(category, {
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  compilePrompt(template, variables) {
    let compiled = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      compiled = compiled.replace(regex, value || '');
    }
    
    return compiled;
  }

  recordPromptUsage(category, timestamp) {
    if (!this.promptMetrics.has(category)) {
      this.promptMetrics.set(category, {
        usage: 0,
        totalResponseTime: 0,
        successCount: 0,
        errorCount: 0,
        lastUsed: null
      });
    }
    
    const metrics = this.promptMetrics.get(category);
    metrics.usage++;
    metrics.lastUsed = new Date(timestamp);
  }

  recordPromptMetrics(category, data) {
    const metrics = this.promptMetrics.get(category);
    if (!metrics) return;
    
    if (data.success) {
      metrics.successCount++;
      metrics.totalResponseTime += data.responseTime;
    } else {
      metrics.errorCount++;
    }
  }

  async getPromptMetrics(category) {
    const metrics = this.promptMetrics.get(category);
    if (!metrics) return null;
    
    return {
      category,
      usage: metrics.usage,
      avgResponseTime: metrics.usage > 0 ? metrics.totalResponseTime / metrics.successCount : 0,
      successRate: metrics.usage > 0 ? (metrics.successCount / metrics.usage) * 100 : 0,
      errorRate: metrics.usage > 0 ? (metrics.errorCount / metrics.usage) * 100 : 0,
      lastUsed: metrics.lastUsed
    };
  }

  async getAllPrompts() {
    const prompts = [];
    
    for (const [category, activeInfo] of this.activePrompts.entries()) {
      try {
        const prompt = await fs.readJson(activeInfo.filePath);
        const metrics = await this.getPromptMetrics(category);
        
        prompts.push({
          ...prompt,
          metrics,
          active: activeInfo.active
        });
      } catch (error) {
        logger.error(`Erro ao carregar prompt ${category}:`, error);
      }
    }
    
    return prompts;
  }

  async togglePrompt(category, active) {
    const activePrompt = this.activePrompts.get(category);
    if (!activePrompt) {
      throw new Error(`Prompt não encontrado: ${category}`);
    }
    
    this.activePrompts.set(category, {
      ...activePrompt,
      active
    });
    
    await this.saveActivePrompts();
    
    logger.info(`Prompt ${category} ${active ? 'ativado' : 'desativado'}`);
  }

  async deletePrompt(category) {
    try {
      const activePrompt = this.activePrompts.get(category);
      if (!activePrompt) {
        throw new Error(`Prompt não encontrado: ${category}`);
      }
      
      // Fazer backup antes de deletar
      await this.backupPromptVersion(category);
      
      // Remover arquivo
      await fs.remove(activePrompt.filePath);
      
      // Remover das referências ativas
      this.activePrompts.delete(category);
      this.promptMetrics.delete(category);
      
      await this.saveActivePrompts();
      
      logger.info(`Prompt deletado: ${category}`);
    } catch (error) {
      logger.error('Erro ao deletar prompt:', error);
      throw error;
    }
  }

  async testPrompt(category, testData) {
    try {
      const results = [];
      
      for (const test of testData) {
        const startTime = Date.now();
        
        try {
          const result = await this.executePrompt(category, test.variables, {
            temperature: 0.1 // Usar temperatura baixa para testes
          });
          
          results.push({
            input: test.variables,
            output: result.response,
            success: true,
            responseTime: Date.now() - startTime,
            expectedOutput: test.expected,
            match: test.expected ? this.compareOutputs(result.response, test.expected) : null
          });
        } catch (error) {
          results.push({
            input: test.variables,
            success: false,
            error: error.message,
            responseTime: Date.now() - startTime
          });
        }
      }
      
      return {
        category,
        totalTests: results.length,
        successfulTests: results.filter(r => r.success).length,
        averageResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
        results
      };
    } catch (error) {
      logger.error('Erro ao testar prompt:', error);
      throw error;
    }
  }

  compareOutputs(actual, expected) {
    // Implementar lógica de comparação baseada no tipo de saída
    try {
      const actualJson = JSON.parse(actual);
      const expectedJson = JSON.parse(expected);
      
      // Comparação de objetos JSON
      return JSON.stringify(actualJson) === JSON.stringify(expectedJson);
    } catch {
      // Comparação de texto simples
      return actual.toLowerCase().trim() === expected.toLowerCase().trim();
    }
  }

  async exportPrompts() {
    try {
      const prompts = await this.getAllPrompts();
      const exportData = {
        exportedAt: new Date(),
        version: '1.0',
        prompts
      };
      
      const exportPath = path.join(this.promptsPath, `export_${Date.now()}.json`);
      await fs.writeJson(exportPath, exportData, { spaces: 2 });
      
      return exportPath;
    } catch (error) {
      logger.error('Erro ao exportar prompts:', error);
      throw error;
    }
  }

  async importPrompts(filePath) {
    try {
      const importData = await fs.readJson(filePath);
      
      for (const prompt of importData.prompts) {
        await this.createPrompt(prompt.category, {
          name: prompt.name,
          description: prompt.description,
          template: prompt.template,
          parameters: prompt.parameters,
          version: prompt.version || '1.0'
        });
      }
      
      logger.info(`${importData.prompts.length} prompts importados`);
    } catch (error) {
      logger.error('Erro ao importar prompts:', error);
      throw error;
    }
  }

  async getPromptVersions(category) {
    try {
      const versionsDir = this.versionsPath;
      const files = await fs.readdir(versionsDir);
      
      const versions = [];
      for (const file of files) {
        if (file.startsWith(category) && file.endsWith('.json')) {
          const versionData = await fs.readJson(path.join(versionsDir, file));
          versions.push({
            file,
            version: versionData.version,
            createdAt: versionData.createdAt,
            updatedAt: versionData.updatedAt
          });
        }
      }
      
      return versions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      logger.error('Erro ao obter versões do prompt:', error);
      return [];
    }
  }

  async revertPromptVersion(category, versionFile) {
    try {
      const versionPath = path.join(this.versionsPath, versionFile);
      const versionData = await fs.readJson(versionPath);
      
      // Fazer backup da versão atual
      await this.backupPromptVersion(category);
      
      // Restaurar versão
      const activePrompt = this.activePrompts.get(category);
      await fs.writeJson(activePrompt.filePath, versionData, { spaces: 2 });
      
      logger.info(`Prompt ${category} revertido para versão ${versionData.version}`);
    } catch (error) {
      logger.error('Erro ao reverter versão do prompt:', error);
      throw error;
    }
  }

  async getSystemStats() {
    const stats = {
      totalPrompts: this.activePrompts.size,
      activePrompts: Array.from(this.activePrompts.values()).filter(p => p.active).length,
      totalUsage: 0,
      avgResponseTime: 0,
      successRate: 0
    };
    
    let totalResponseTime = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const metrics of this.promptMetrics.values()) {
      stats.totalUsage += metrics.usage;
      totalResponseTime += metrics.totalResponseTime;
      totalSuccess += metrics.successCount;
      totalErrors += metrics.errorCount;
    }
    
    if (totalSuccess > 0) {
      stats.avgResponseTime = totalResponseTime / totalSuccess;
    }
    
    if (stats.totalUsage > 0) {
      stats.successRate = (totalSuccess / stats.totalUsage) * 100;
    }
    
    return stats;
  }
}

module.exports = new PromptService();