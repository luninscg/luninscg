const fs = require('fs').promises;

class PatternAnalyzer {
    constructor() {
        this.patterns = {
            personality: {},
            campaigns: {},
            messaging: {},
            performance: {}
        };
    }

    // Analisar resultados de simulação
    async analyzeResults(resultsFile) {
        try {
            const data = await fs.readFile(resultsFile, 'utf-8');
            const results = JSON.parse(data);
            
            console.log('🔍 === ANÁLISE DE PADRÕES ===\n');
            
            // Analisar personalidade
            this.analyzePersonalityPatterns(results.personality);
            
            // Analisar campanhas
            this.analyzeCampaignPatterns(results.campaigns);
            
            // Analisar anti-robótico
            this.analyzeAntiRoboticPatterns(results.antiRobotic);
            
            // Gerar recomendações
            const recommendations = this.generateRecommendations();
            
            return {
                patterns: this.patterns,
                recommendations
            };
            
        } catch (error) {
            console.error('Erro na análise:', error);
            throw error;
        }
    }

    // Analisar padrões de personalidade
    analyzePersonalityPatterns(personalityResults) {
        console.log('🧠 Analisando padrões de personalidade...');
        
        const typeAccuracy = {};
        const confidenceByType = {};
        const errorPatterns = [];
        
        personalityResults.forEach(result => {
            const { expected, detected, confidence, success } = result;
            
            // Precisão por tipo
            if (!typeAccuracy[expected]) {
                typeAccuracy[expected] = { total: 0, correct: 0 };
            }
            typeAccuracy[expected].total++;
            if (success) typeAccuracy[expected].correct++;
            
            // Confiança por tipo
            if (!confidenceByType[expected]) {
                confidenceByType[expected] = [];
            }
            confidenceByType[expected].push(confidence);
            
            // Padrões de erro
            if (!success) {
                errorPatterns.push({
                    expected,
                    detected,
                    confidence,
                    scenario: result.scenario
                });
            }
        });
        
        // Calcular métricas
        for (const [type, data] of Object.entries(typeAccuracy)) {
            const accuracy = (data.correct / data.total * 100).toFixed(1);
            const avgConfidence = (confidenceByType[type].reduce((a, b) => a + b, 0) / confidenceByType[type].length).toFixed(1);
            
            console.log(`   ${type}: ${accuracy}% precisão, ${avgConfidence}% confiança média`);
        }
        
        this.patterns.personality = {
            typeAccuracy,
            confidenceByType,
            errorPatterns: errorPatterns.slice(0, 10) // Top 10 erros
        };
    }

    // Analisar padrões de campanha
    analyzeCampaignPatterns(campaignResults) {
        console.log('📢 Analisando padrões de campanha...');
        
        const timePerformance = {};
        const regionPerformance = {};
        const naturalnessScores = [];
        
        campaignResults.forEach(result => {
            const { scenario, naturalness } = result;
            
            // Performance por horário
            if (!timePerformance[scenario.time]) {
                timePerformance[scenario.time] = [];
            }
            timePerformance[scenario.time].push(naturalness);
            
            // Performance por região
            if (!regionPerformance[scenario.region]) {
                regionPerformance[scenario.region] = [];
            }
            regionPerformance[scenario.region].push(naturalness);
            
            naturalnessScores.push(naturalness);
        });
        
        // Calcular médias
        for (const [time, scores] of Object.entries(timePerformance)) {
            const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
            console.log(`   ${time}: ${avg}% naturalidade média`);
        }
        
        const overallNaturalness = (naturalnessScores.reduce((a, b) => a + b, 0) / naturalnessScores.length).toFixed(1);
        console.log(`   Naturalidade geral: ${overallNaturalness}%`);
        
        this.patterns.campaigns = {
            timePerformance,
            regionPerformance,
            overallNaturalness: parseFloat(overallNaturalness)
        };
    }

    // Analisar padrões anti-robóticos
    analyzeAntiRoboticPatterns(antiRoboticResults) {
        console.log('🤖 Analisando padrões anti-robóticos...');
        
        const variationsByBase = {};
        const commonPatterns = {};
        
        antiRoboticResults.forEach(result => {
            const { original, humanized } = result;
            
            if (!variationsByBase[original]) {
                variationsByBase[original] = new Set();
            }
            variationsByBase[original].add(humanized);
            
            // Detectar padrões comuns
            const patterns = this.extractHumanizationPatterns(original, humanized);
            patterns.forEach(pattern => {
                commonPatterns[pattern] = (commonPatterns[pattern] || 0) + 1;
            });
        });
        
        // Mostrar variações por mensagem base
        for (const [base, variations] of Object.entries(variationsByBase)) {
            console.log(`   "${base}": ${variations.size} variações`);
        }
        
        // Top padrões de humanização
        const topPatterns = Object.entries(commonPatterns)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
            
        console.log('   Top padrões de humanização:');
        topPatterns.forEach(([pattern, count]) => {
            console.log(`     ${pattern}: ${count} ocorrências`);
        });
        
        this.patterns.antiRobotic = {
            variationsByBase,
            commonPatterns,
            topPatterns
        };
    }

    // Extrair padrões de humanização
    extractHumanizationPatterns(original, humanized) {
        const patterns = [];
        
        // Detectar adições
        if (humanized.includes('né')) patterns.push('adicao_ne');
        if (humanized.includes('então')) patterns.push('adicao_entao');
        if (humanized.includes('...')) patterns.push('adicao_reticencias');
        
        // Detectar contrações
        if (humanized.includes('tá')) patterns.push('contracao_esta');
        if (humanized.includes('pra')) patterns.push('contracao_para');
        if (humanized.includes('né')) patterns.push('contracao_nao_e');
        
        // Detectar mudanças de estrutura
        if (humanized.length > original.length * 1.2) patterns.push('expansao_texto');
        if (humanized.includes(',') && !original.includes(',')) patterns.push('adicao_virgula');
        
        return patterns;
    }

    // Gerar recomendações
    generateRecommendations() {
        const recommendations = [];
        
        // Recomendações de personalidade
        const personalityAccuracy = this.patterns.personality.typeAccuracy;
        for (const [type, data] of Object.entries(personalityAccuracy)) {
            const accuracy = data.correct / data.total * 100;
            if (accuracy < 80) {
                recommendations.push({
                    type: 'personality',
                    priority: 'high',
                    message: `Melhorar detecção de personalidade ${type} (${accuracy.toFixed(1)}% precisão)`
                });
            }
        }
        
        // Recomendações de campanha
        if (this.patterns.campaigns.overallNaturalness < 85) {
            recommendations.push({
                type: 'campaign',
                priority: 'medium',
                message: `Aumentar naturalidade das campanhas (${this.patterns.campaigns.overallNaturalness}%)`
            });
        }
        
        // Recomendações anti-robóticas
        const avgVariations = Object.values(this.patterns.antiRobotic.variationsByBase)
            .reduce((sum, variations) => sum + variations.size, 0) / 
            Object.keys(this.patterns.antiRobotic.variationsByBase).length;
            
        if (avgVariations < 50) {
            recommendations.push({
                type: 'antiRobotic',
                priority: 'medium',
                message: `Aumentar variações anti-robóticas (${avgVariations.toFixed(0)} variações médias)`
            });
        }
        
        return recommendations;
    }
}

module.exports = { PatternAnalyzer };