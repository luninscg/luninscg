class AIConversationAnalyzer {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        this.analysisResults = {
            conversationPatterns: [],
            conversionBottlenecks: [],
            successFactors: [],
            improvementSuggestions: [],
            promptOptimizations: []
        };
    }

    async analyzeSimulationResults(simulationData) {
        console.log('🔍 === ANÁLISE INTELIGENTE PÓS-SIMULAÇÃO ===\n');
        
        // 1. Análise de Padrões de Conversação
        const conversationPatterns = await this.analyzeConversationPatterns(simulationData);
        
        // 2. Identificação de Gargalos de Conversão
        const bottlenecks = await this.identifyConversionBottlenecks(simulationData);
        
        // 3. Análise de Fatores de Sucesso
        const successFactors = await this.analyzeSuccessFactors(simulationData);
        
        // 4. Geração de Sugestões de Melhoria
        const improvements = await this.generateImprovementSuggestions({
            patterns: conversationPatterns,
            bottlenecks,
            successFactors
        });
        
        // 5. Otimizações de Prompt
        const promptOptimizations = await this.generatePromptOptimizations(improvements);
        
        return {
            conversationPatterns,
            bottlenecks,
            successFactors,
            improvements,
            promptOptimizations,
            executiveSummary: await this.generateExecutiveSummary({
                conversationPatterns,
                bottlenecks,
                successFactors,
                improvements
            })
        };
    }

    async analyzeConversationPatterns(simulationData) {
        const prompt = `
        Analise os seguintes dados de simulação de conversas de vendas:
        
        DADOS DA SIMULAÇÃO:
        ${JSON.stringify(simulationData, null, 2)}
        
        Como especialista em análise conversacional, identifique:
        
        1. PADRÕES DE SUCESSO:
           - Quais frases/abordagens geraram mais engajamento?
           - Em que estágios houve maior conversão?
           - Quais elementos de personalização funcionaram?
        
        2. PADRÕES DE FALHA:
           - Onde os leads mais abandonaram a conversa?
           - Quais mensagens geraram resistência?
           - Que objeções não foram bem tratadas?
        
        3. INSIGHTS COMPORTAMENTAIS:
           - Diferenças por tipo de personalidade
           - Variações por horário/região
           - Padrões de resposta por estágio
        
        Retorne em JSON estruturado com análise detalhada.
        `;
        
        const result = await this.model.generateContent(prompt);
        return JSON.parse(result.response.text());
    }

    async identifyConversionBottlenecks(simulationData) {
        const prompt = `
        Como especialista em funil de vendas, analise onde estão os GARGALOS de conversão:
        
        DADOS: ${JSON.stringify(simulationData, null, 2)}
        
        Identifique:
        1. ESTÁGIOS COM MAIOR ABANDONO
        2. MENSAGENS QUE CAUSAM OBJEÇÕES
        3. MOMENTOS DE PERDA DE INTERESSE
        4. FALHAS NA SEQUÊNCIA DE NURTURING
        5. PROBLEMAS DE TIMING
        
        Para cada gargalo, forneça:
        - Localização exata (estágio/momento)
        - Causa raiz provável
        - Impacto na conversão (%)
        - Prioridade de correção (1-5)
        
        Retorne JSON estruturado.
        `;
        
        const result = await this.model.generateContent(prompt);
        return JSON.parse(result.response.text());
    }

    async analyzeSuccessFactors(simulationData) {
        const prompt = `
        Analise os FATORES DE SUCESSO nas conversões bem-sucedidas:
        
        DADOS: ${JSON.stringify(simulationData, null, 2)}
        
        Identifique:
        1. ELEMENTOS COMUNS nas conversões exitosas
        2. TÉCNICAS DE PERSUASÃO mais efetivas
        3. MOMENTOS IDEAIS para cada abordagem
        4. PERSONALIZAÇÃO que funciona
        5. SEQUÊNCIAS de mensagens vencedoras
        
        Para cada fator, forneça:
        - Descrição detalhada
        - Taxa de sucesso associada
        - Contexto de aplicação
        - Replicabilidade (1-5)
        
        Retorne JSON estruturado.
        `;
        
        const result = await this.model.generateContent(prompt);
        return JSON.parse(result.response.text());
    }

    async generateImprovementSuggestions(analysisData) {
        const prompt = `
        Com base na análise completa, gere SUGESTÕES PRÁTICAS DE MELHORIA:
        
        ANÁLISE: ${JSON.stringify(analysisData, null, 2)}
        
        Crie sugestões categorizadas:
        
        1. MELHORIAS IMEDIATAS (implementação < 1 dia):
           - Ajustes de texto
           - Mudanças de timing
           - Reordenação de estágios
        
        2. MELHORIAS TÁTICAS (implementação < 1 semana):
           - Novos templates
           - Lógicas de personalização
           - Tratamento de objeções
        
        3. MELHORIAS ESTRATÉGICAS (implementação < 1 mês):
           - Reestruturação de funil
           - Novos sistemas de scoring
           - Integração de dados externos
        
        Para cada sugestão:
        - Descrição clara
        - Impacto esperado (%)
        - Esforço de implementação (1-5)
        - ROI estimado
        - Código/exemplo quando aplicável
        
        Retorne JSON estruturado.
        `;
        
        const result = await this.model.generateContent(prompt);
        return JSON.parse(result.response.text());
    }

    async generatePromptOptimizations(improvements) {
        const prompt = `
        Baseado nas melhorias identificadas, gere OTIMIZAÇÕES ESPECÍFICAS DE PROMPT:
        
        MELHORIAS: ${JSON.stringify(improvements, null, 2)}
        
        Crie:
        1. NOVOS PROMPTS otimizados para cada estágio
        2. VARIAÇÕES A/B para testar
        3. TÉCNICAS DE PERSUASÃO específicas
        4. TRATAMENTO DE OBJEÇÕES melhorado
        5. PERSONALIZAÇÃO avançada
        
        Para cada otimização:
        - Prompt original vs otimizado
        - Justificativa da mudança
        - Métricas para medir sucesso
        - Implementação técnica
        
        Retorne código JavaScript pronto para usar.
        `;
        
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async generateExecutiveSummary(allAnalysis) {
        const prompt = `
        Crie um RESUMO EXECUTIVO da análise completa:
        
        ANÁLISE COMPLETA: ${JSON.stringify(allAnalysis, null, 2)}
        
        Gere um resumo que inclua:
        
        1. SITUAÇÃO ATUAL (3-5 pontos principais)
        2. PRINCIPAIS DESCOBERTAS (insights críticos)
        3. OPORTUNIDADES DE MELHORIA (top 5 com impacto)
        4. RECOMENDAÇÕES PRIORITÁRIAS (ações imediatas)
        5. PROJEÇÃO DE RESULTADOS (metas realistas)
        
        Tom: Executivo, direto, orientado a resultados.
        Formato: Markdown com emojis estratégicos.
        Tamanho: Máximo 500 palavras.
        `;
        
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async generateDetailedReport(analysisResults) {
        const reportData = {
            timestamp: new Date().toISOString(),
            ...analysisResults
        };
        
        // Salva relatório detalhado
        const fs = require('fs');
        const filename = `ai-analysis-report-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
        
        console.log(`📊 Relatório detalhado salvo: ${filename}`);
        return filename;
    }
}

module.exports = { AIConversationAnalyzer };