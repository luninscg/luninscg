class DynamicPromptOptimizer {
    constructor() {
        this.promptVariations = new Map();
        this.performanceMetrics = new Map();
        this.abTestResults = new Map();
    }

    // Otimização baseada em performance
    optimizePromptForStage(stage, customerProfile, historicalData) {
        const basePrompt = this.getBasePromptForStage(stage);
        const optimizations = this.calculateOptimizations(customerProfile, historicalData);
        
        return this.applyOptimizations(basePrompt, optimizations);
    }

    calculateOptimizations(profile, data) {
        const optimizations = {
            tone: 'neutral',
            urgency: 'medium',
            techLevel: 'medium',
            focusArea: 'economy'
        };

        // Otimização baseada no perfil do cliente
        if (profile.consumo_medio > 600) {
            optimizations.focusArea = 'sustainability';
            optimizations.techLevel = 'high';
        }

        if (profile.interest_level === 'alto') {
            optimizations.urgency = 'high';
            optimizations.tone = 'enthusiastic';
        }

        if (profile.responseTime < 300) { // Resposta rápida
            optimizations.tone = 'direct';
            optimizations.urgency = 'high';
        }

        // Otimização baseada em dados históricos
        if (data.avgConversionTime > 1800) { // Mais de 30 min
            optimizations.urgency = 'low';
            optimizations.tone = 'patient';
        }

        return optimizations;
    }

    applyOptimizations(basePrompt, optimizations) {
        let optimizedPrompt = basePrompt;

        // Ajustes de tom
        const toneAdjustments = {
            enthusiastic: 'Use linguagem mais animada e positiva. Demonstre empolgação genuína.',
            direct: 'Seja mais direto e objetivo. Evite rodeios desnecessários.',
            patient: 'Mantenha tom calmo e paciente. Dê tempo para o cliente processar.',
            neutral: 'Mantenha tom equilibrado e profissional.'
        };

        // Ajustes de urgência
        const urgencyAdjustments = {
            high: 'Crie senso de urgência apropriado. Mencione benefícios imediatos.',
            medium: 'Equilibre urgência com informação. Não pressione excessivamente.',
            low: 'Foque em educação e construção de relacionamento. Sem pressa.'
        };

        // Ajustes de nível técnico
        const techAdjustments = {
            high: 'Use termos técnicos quando apropriado. Cliente parece conhecer o assunto.',
            medium: 'Equilibre explicações técnicas com linguagem simples.',
            low: 'Evite jargões. Use analogias simples e explicações básicas.'
        };

        optimizedPrompt += `\n\n### OTIMIZAÇÕES DINÂMICAS ###\n`;
        optimizedPrompt += `**Tom:** ${toneAdjustments[optimizations.tone]}\n`;
        optimizedPrompt += `**Urgência:** ${urgencyAdjustments[optimizations.urgency]}\n`;
        optimizedPrompt += `**Nível Técnico:** ${techAdjustments[optimizations.techLevel]}\n`;
        optimizedPrompt += `**Foco Principal:** ${optimizations.focusArea}\n`;

        return optimizedPrompt;
    }

    getBasePromptForStage(stage) {
        // Retorna o prompt base para o estágio específico
        // Integra com o sistema de prompts existente
        return require('./prompt-router').SPECIALIZED_PROMPTS[stage] || '';
    }
}

module.exports = { DynamicPromptOptimizer };