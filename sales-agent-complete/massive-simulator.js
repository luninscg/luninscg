const { PersonalitySystem } = require('./personality-system');
const { ActiveListeningSystem } = require('./active-listening-system');
const { HumanizedMessaging } = require('./humanized-messaging');
const { CampaignNaturalSystem } = require('./campaign-natural-system');
const { AntiRoboticSystem } = require('./anti-robotic-system');
const { SmartScheduling } = require('./smart-scheduling');
const fs = require('fs').promises;

class MassiveSimulator {
    constructor() {
        this.personalitySystem = new PersonalitySystem();
        this.activeListening = new ActiveListeningSystem();
        this.humanizedMessaging = new HumanizedMessaging();
        this.campaignSystem = new CampaignNaturalSystem();
        this.antiRobotic = new AntiRoboticSystem();
        this.smartScheduling = new SmartScheduling();
        
        this.results = {
            personality: [],
            campaigns: [],
            messaging: [],
            antiRobotic: [],
            performance: {
                totalTests: 0,
                successRate: 0,
                averageTime: 0,
                uniquenessRate: 0
            }
        };
    }

    // Cenários de teste para personalidades
    getPersonalityScenarios() {
        return [
            // Analíticos
            'Preciso ver os números exatos, dados técnicos e ROI detalhado antes de decidir.',
            'Quais são as especificações técnicas? Tem garantia? Qual o payback?',
            'Vou analisar os dados primeiro. Me mande um relatório completo.',
            
            // Impulsivos
            'Nossa, que interessante! Quero saber mais agora mesmo!',
            'Isso parece incrível! Como faço para começar hoje?',
            'Adorei a ideia! Vamos fazer isso já!',
            
            // Conservadores
            'Não sei... preciso pensar bem, conversar com a família...',
            'É muito arriscado? Já tem outras pessoas usando?',
            'Prefiro esperar um pouco mais antes de decidir.',
            
            // Práticos
            'Vai funcionar mesmo? Quanto tempo demora? É confiável?',
            'É fácil de usar? Dá muito trabalho para instalar?',
            'Qual a diferença real na minha conta de luz?'
        ];
    }

    // Cenários de campanha
    getCampaignScenarios() {
        return [
            { time: 'morning', region: 'Campo Grande', temp: 35, season: 'summer' },
            { time: 'afternoon', region: 'São Paulo', temp: 22, season: 'winter' },
            { time: 'evening', region: 'Manaus', temp: 28, season: 'rainy' },
            { time: 'morning', region: 'Brasília', temp: 18, season: 'dry' },
            { time: 'afternoon', region: 'Goiânia', temp: 32, season: 'summer' }
        ];
    }

    // Simular detecção de personalidade massivamente
    async simulatePersonalityDetection(iterations = 10000) {
        console.log(`🧠 Iniciando simulação de personalidade (${iterations} testes)...`);
        const scenarios = this.getPersonalityScenarios();
        const startTime = Date.now();
        let successCount = 0;

        for (let i = 0; i < iterations; i++) {
            const scenario = scenarios[i % scenarios.length];
            const expectedType = this.getExpectedPersonality(scenario);
            
            try {
                const result = await this.personalitySystem.detectPersonality(scenario);
                const success = result.primary_type === expectedType;
                
                if (success) successCount++;
                
                this.results.personality.push({
                    iteration: i,
                    scenario,
                    expected: expectedType,
                    detected: result.primary_type,
                    confidence: result.confidence,
                    success,
                    timestamp: Date.now()
                });
                
                // Log progresso a cada 1000 testes
                if ((i + 1) % 1000 === 0) {
                    const progress = ((i + 1) / iterations * 100).toFixed(1);
                    const currentSuccess = (successCount / (i + 1) * 100).toFixed(1);
                    console.log(`   Progresso: ${progress}% | Taxa de sucesso: ${currentSuccess}%`);
                }
            } catch (error) {
                console.error(`Erro no teste ${i}:`, error.message);
            }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const successRate = (successCount / iterations * 100).toFixed(2);
        
        console.log(`✅ Simulação concluída:`);
        console.log(`   Testes: ${iterations}`);
        console.log(`   Sucessos: ${successCount} (${successRate}%)`);
        console.log(`   Tempo total: ${totalTime}ms`);
        console.log(`   Tempo médio: ${(totalTime / iterations).toFixed(2)}ms por teste`);
        
        return {
            totalTests: iterations,
            successCount,
            successRate: parseFloat(successRate),
            totalTime,
            averageTime: totalTime / iterations
        };
    }

    // Simular campanhas massivamente
    async simulateCampaigns(iterations = 5000) {
        console.log(`📢 Iniciando simulação de campanhas (${iterations} testes)...`);
        const scenarios = this.getCampaignScenarios();
        const startTime = Date.now();
        const uniqueMessages = new Set();

        for (let i = 0; i < iterations; i++) {
            const scenario = scenarios[i % scenarios.length];
            
            try {
                const contactData = {
                    name: `Cliente${i}`,
                    city: scenario.region,
                    phone: `67999${String(i).padStart(6, '0')}`
                };
                
                const opener = this.campaignSystem.generateNaturalCampaignOpener(contactData, scenario.time);
                uniqueMessages.add(opener.opener.message);
                
                this.results.campaigns.push({
                    iteration: i,
                    scenario,
                    message: opener.opener.message,
                    naturalness: opener.naturalness_score,
                    timestamp: Date.now()
                });
                
                if ((i + 1) % 500 === 0) {
                    const progress = ((i + 1) / iterations * 100).toFixed(1);
                    const uniqueness = (uniqueMessages.size / (i + 1) * 100).toFixed(1);
                    console.log(`   Progresso: ${progress}% | Unicidade: ${uniqueness}%`);
                }
            } catch (error) {
                console.error(`Erro no teste de campanha ${i}:`, error.message);
            }
        }

        const endTime = Date.now();
        const uniquenessRate = (uniqueMessages.size / iterations * 100).toFixed(2);
        
        console.log(`✅ Simulação de campanhas concluída:`);
        console.log(`   Testes: ${iterations}`);
        console.log(`   Mensagens únicas: ${uniqueMessages.size} (${uniquenessRate}%)`);
        console.log(`   Tempo total: ${endTime - startTime}ms`);
        
        return {
            totalTests: iterations,
            uniqueMessages: uniqueMessages.size,
            uniquenessRate: parseFloat(uniquenessRate),
            totalTime: endTime - startTime
        };
    }

    // Simular sistema anti-robótico
    async simulateAntiRobotic(iterations = 20000) {
        console.log(`🤖 Iniciando simulação anti-robótica (${iterations} testes)...`);
        const baseMessages = [
            'Obrigado pelo seu interesse!',
            'Vou te explicar como funciona.',
            'Entendi sua situação.',
            'Que bom que você perguntou!',
            'Vamos resolver isso juntos.'
        ];
        
        const startTime = Date.now();
        const allVariations = new Set();
        const messageGroups = {};

        for (let i = 0; i < iterations; i++) {
            const baseMessage = baseMessages[i % baseMessages.length];
            
            if (!messageGroups[baseMessage]) {
                messageGroups[baseMessage] = new Set();
            }
            
            try {
                const humanized = await this.antiRobotic.addHumanImperfections(baseMessage);
                allVariations.add(humanized);
                messageGroups[baseMessage].add(humanized);
                
                this.results.antiRobotic.push({
                    iteration: i,
                    original: baseMessage,
                    humanized,
                    timestamp: Date.now()
                });
                
                if ((i + 1) % 2000 === 0) {
                    const progress = ((i + 1) / iterations * 100).toFixed(1);
                    const uniqueness = (allVariations.size / (i + 1) * 100).toFixed(1);
                    console.log(`   Progresso: ${progress}% | Variações únicas: ${uniqueness}%`);
                }
            } catch (error) {
                console.error(`Erro no teste anti-robótico ${i}:`, error.message);
            }
        }

        const endTime = Date.now();
        const globalUniqueness = (allVariations.size / iterations * 100).toFixed(2);
        
        console.log(`✅ Simulação anti-robótica concluída:`);
        console.log(`   Testes: ${iterations}`);
        console.log(`   Variações globais: ${allVariations.size} (${globalUniqueness}%)`);
        
        // Analisar variações por mensagem base
        for (const [baseMsg, variations] of Object.entries(messageGroups)) {
            const count = Array.from(variations).length;
            const baseTests = this.results.antiRobotic.filter(r => r.original === baseMsg).length;
            const uniquenessPerBase = (count / baseTests * 100).toFixed(1);
            console.log(`   "${baseMsg}": ${count} variações (${uniquenessPerBase}%)`);
        }
        
        return {
            totalTests: iterations,
            globalVariations: allVariations.size,
            globalUniqueness: parseFloat(globalUniqueness),
            messageGroups,
            totalTime: endTime - startTime
        };
    }

    // Executar simulação completa
    async runFullSimulation(config = {}) {
        const defaultConfig = {
            personality: 10000,
            campaigns: 5000,
            antiRobotic: 20000,
            messaging: 15000
        };
        
        const finalConfig = { ...defaultConfig, ...config };
        
        console.log('🚀 === INICIANDO SIMULAÇÃO MASSIVA COMPLETA ===\n');
        console.log('Configuração:', finalConfig);
        console.log('\n');
        
        const startTime = Date.now();
        const results = {};
        
        try {
            // Simular personalidade
            results.personality = await this.simulatePersonalityDetection(finalConfig.personality);
            console.log('\n');
            
            // Simular campanhas
            results.campaigns = await this.simulateCampaigns(finalConfig.campaigns);
            console.log('\n');
            
            // Simular anti-robótico
            results.antiRobotic = await this.simulateAntiRobotic(finalConfig.antiRobotic);
            console.log('\n');
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const totalTests = Object.values(finalConfig).reduce((sum, val) => sum + val, 0);
            
            results.summary = {
                totalTests,
                totalTime,
                averageTimePerTest: totalTime / totalTests,
                timestamp: new Date().toISOString()
            };
            
            console.log('🎉 === SIMULAÇÃO COMPLETA FINALIZADA ===');
            console.log(`Total de testes: ${totalTests.toLocaleString()}`);
            console.log(`Tempo total: ${(totalTime / 1000).toFixed(2)}s`);
            console.log(`Média por teste: ${(totalTime / totalTests).toFixed(2)}ms`);
            
            // Salvar resultados
            await this.saveResults(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ Erro na simulação:', error);
            throw error;
        }
    }

    // Salvar resultados
    async saveResults(results) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `simulation-results-${timestamp}.json`;
        
        try {
            await fs.writeFile(filename, JSON.stringify(results, null, 2));
            console.log(`💾 Resultados salvos em: ${filename}`);
        } catch (error) {
            console.error('Erro ao salvar resultados:', error);
        }
    }

    // Determinar personalidade esperada (para validação)
    getExpectedPersonality(scenario) {
        const analytical = ['números', 'dados', 'técnicos', 'ROI', 'especificações', 'garantia', 'payback', 'relatório'];
        const impulsive = ['interessante', 'incrível', 'agora', 'hoje', 'já', 'adorei'];
        const conservative = ['não sei', 'pensar', 'família', 'arriscado', 'esperar'];
        const practical = ['funcionar', 'tempo', 'confiável', 'fácil', 'trabalho', 'diferença'];
        
        const lower = scenario.toLowerCase();
        
        if (analytical.some(word => lower.includes(word))) return 'analytical';
        if (impulsive.some(word => lower.includes(word))) return 'impulsive';
        if (conservative.some(word => lower.includes(word))) return 'conservative';
        if (practical.some(word => lower.includes(word))) return 'practical';
        
        return 'neutral';
    }
}

module.exports = { MassiveSimulator };