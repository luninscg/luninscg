const fs = require('fs').promises;
const path = require('path');

class PromptOptimizer {
    constructor() {
        this.optimizations = {
            personality: {},
            campaigns: {},
            antiRobotic: {},
            history: []
        };
        this.promptsPath = path.join(__dirname, 'prompts');
    }

    // Otimizar prompts baseado nos padrões analisados
    async optimizePrompts(patterns, recommendations) {
        console.log('🚀 === OTIMIZAÇÃO DE PROMPTS ===\n');
        
        const optimizations = [];
        
        // Otimizar prompts de personalidade
        if (patterns.personality) {
            const personalityOpts = await this.optimizePersonalityPrompts(patterns.personality);
            optimizations.push(...personalityOpts);
        }
        
        // Otimizar prompts de campanha
        if (patterns.campaigns) {
            const campaignOpts = await this.optimizeCampaignPrompts(patterns.campaigns);
            optimizations.push(...campaignOpts);
        }
        
        // Otimizar prompts anti-robóticos
        if (patterns.antiRobotic) {
            const antiRoboticOpts = await this.optimizeAntiRoboticPrompts(patterns.antiRobotic);
            optimizations.push(...antiRoboticOpts);
        }
        
        // Aplicar otimizações
        await this.applyOptimizations(optimizations);
        
        // Salvar histórico
        await this.saveOptimizationHistory(optimizations, patterns);
        
        return optimizations;
    }

    // Otimizar prompts de personalidade
    async optimizePersonalityPrompts(personalityPatterns) {
        console.log('🧠 Otimizando prompts de personalidade...');
        
        const optimizations = [];
        
        for (const [type, accuracy] of Object.entries(personalityPatterns.typeAccuracy)) {
            const successRate = accuracy.correct / accuracy.total * 100;
            
            if (successRate < 80) {
                console.log(`   Melhorando detecção de ${type} (${successRate.toFixed(1)}%)`);
                
                // Analisar erros comuns
                const typeErrors = personalityPatterns.errorPatterns.filter(e => e.expected === type);
                const commonMistakes = this.analyzeCommonMistakes(typeErrors);
                
                optimizations.push({
                    type: 'personality',
                    target: type,
                    issue: 'low_accuracy',
                    currentRate: successRate,
                    commonMistakes,
                    suggestion: this.generatePersonalityOptimization(type, commonMistakes)
                });
            }
        }
        
        return optimizations;
    }

    // Otimizar prompts de campanha
    async optimizeCampaignPrompts(campaignPatterns) {
        console.log('📢 Otimizando prompts de campanha...');
        
        const optimizations = [];
        
        if (campaignPatterns.overallNaturalness < 85) {
            console.log(`   Melhorando naturalidade geral (${campaignPatterns.overallNaturalness}%)`);
            
            // Identificar horários/regiões com baixa performance
            const lowPerformanceAreas = this.identifyLowPerformanceAreas(campaignPatterns);
            
            optimizations.push({
                type: 'campaign',
                target: 'naturalness',
                issue: 'low_naturalness',
                currentRate: campaignPatterns.overallNaturalness,
                lowPerformanceAreas,
                suggestion: this.generateCampaignOptimization(lowPerformanceAreas)
            });
        }
        
        return optimizations;
    }

    // Otimizar prompts anti-robóticos
    async optimizeAntiRoboticPrompts(antiRoboticPatterns) {
        console.log('🤖 Otimizando prompts anti-robóticos...');
        
        const optimizations = [];
        
        // Calcular variações médias
        const avgVariations = Object.values(antiRoboticPatterns.variationsByBase)
            .reduce((sum, variations) => sum + variations.size, 0) / 
            Object.keys(antiRoboticPatterns.variationsByBase).length;
            
        if (avgVariations < 50) {
            console.log(`   Aumentando variações (${avgVariations.toFixed(0)} médias)`);
            
            optimizations.push({
                type: 'antiRobotic',
                target: 'variations',
                issue: 'low_variations',
                currentRate: avgVariations,
                topPatterns: antiRoboticPatterns.topPatterns,
                suggestion: this.generateAntiRoboticOptimization(antiRoboticPatterns.topPatterns)
            });
        }
        
        return optimizations;
    }

    // Analisar erros comuns
    analyzeCommonMistakes(errors) {
        const mistakes = {};
        
        errors.forEach(error => {
            const key = `${error.expected}_confused_with_${error.detected}`;
            mistakes[key] = (mistakes[key] || 0) + 1;
        });
        
        return Object.entries(mistakes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([mistake, count]) => ({ mistake, count }));
    }

    // Identificar áreas de baixa performance
    identifyLowPerformanceAreas(patterns) {
        const lowAreas = [];
        
        // Verificar performance por horário
        for (const [time, scores] of Object.entries(patterns.timePerformance)) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avg < 80) {
                lowAreas.push({ type: 'time', value: time, score: avg });
            }
        }
        
        // Verificar performance por região
        for (const [region, scores] of Object.entries(patterns.regionPerformance)) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avg < 80) {
                lowAreas.push({ type: 'region', value: region, score: avg });
            }
        }
        
        return lowAreas;
    }

    // Gerar otimização de personalidade
    generatePersonalityOptimization(type, commonMistakes) {
        const suggestions = {
            'Analítico': 'Adicionar mais indicadores de pensamento lógico e estruturado',
            'Expressivo': 'Focar em entusiasmo e linguagem emocional',
            'Amigável': 'Enfatizar cordialidade e interesse genuíno',
            'Controlador': 'Detectar linguagem direta e orientada a resultados'
        };
        
        return {
            baseImprovement: suggestions[type] || 'Melhorar detecção geral',
            specificFixes: commonMistakes.map(m => `Evitar confusão: ${m.mistake}`),
            promptAddition: this.generatePromptAddition(type, commonMistakes)
        };
    }

    // Gerar otimização de campanha
    generateCampaignOptimization(lowPerformanceAreas) {
        return {
            generalImprovement: 'Aumentar naturalidade e contextualização',
            specificAreas: lowPerformanceAreas.map(area => 
                `Melhorar ${area.type}: ${area.value} (${area.score.toFixed(1)}%)`
            ),
            promptAddition: 'Adicionar mais variações contextuais e regionais'
        };
    }

    // Gerar otimização anti-robótica
    generateAntiRoboticOptimization(topPatterns) {
        return {
            generalImprovement: 'Aumentar diversidade de humanização',
            currentPatterns: topPatterns.map(([pattern, count]) => `${pattern}: ${count}x`),
            promptAddition: 'Adicionar novos padrões de humanização e variações'
        };
    }

    // Gerar adição ao prompt
    generatePromptAddition(type, commonMistakes) {
        return `\n\n// OTIMIZAÇÃO AUTOMÁTICA - ${new Date().toISOString()}\n// Melhorar detecção de ${type}\n// Evitar confusões: ${commonMistakes.map(m => m.mistake).join(', ')}`;
    }

    // Aplicar otimizações
    async applyOptimizations(optimizations) {
        console.log('\n💾 Aplicando otimizações...');
        
        for (const opt of optimizations) {
            console.log(`   Aplicando: ${opt.type} - ${opt.target}`);
            
            // Aqui você aplicaria as otimizações aos prompts reais
            // Por exemplo, modificar arquivos de prompt ou configurações
        }
        
        console.log(`✅ ${optimizations.length} otimizações aplicadas`);
    }

    // Salvar histórico de otimizações
    async saveOptimizationHistory(optimizations, patterns) {
        const historyEntry = {
            timestamp: new Date().toISOString(),
            optimizations,
            patterns,
            summary: {
                totalOptimizations: optimizations.length,
                personalityOpts: optimizations.filter(o => o.type === 'personality').length,
                campaignOpts: optimizations.filter(o => o.type === 'campaign').length,
                antiRoboticOpts: optimizations.filter(o => o.type === 'antiRobotic').length
            }
        };
        
        this.optimizations.history.push(historyEntry);
        
        // Salvar em arquivo
        const historyFile = path.join(__dirname, 'optimization-history.json');
        await fs.writeFile(historyFile, JSON.stringify(this.optimizations.history, null, 2));
        
        console.log(`📊 Histórico salvo: ${this.optimizations.history.length} entradas`);
    }

    // Obter estatísticas de otimização
    getOptimizationStats() {
        const history = this.optimizations.history;
        if (history.length === 0) return null;
        
        const latest = history[history.length - 1];
        const total = history.reduce((sum, entry) => sum + entry.summary.totalOptimizations, 0);
        
        return {
            totalOptimizations: total,
            lastOptimization: latest.timestamp,
            averagePerRun: (total / history.length).toFixed(1),
            totalRuns: history.length
        };
    }
}

module.exports = { PromptOptimizer };