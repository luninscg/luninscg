const { CampaignIntegration } = require('./campaign-integration');
const { getAllLeads } = require('./database');

class PerformanceTester {
    constructor() {
        this.campaignIntegration = new CampaignIntegration();
        this.metrics = {
            responseTime: [],
            conversionRate: 0,
            engagementRate: 0,
            humanLikenessScore: 0
        };
    }

    // Teste de tempo de resposta
    async testResponseTime() {
        console.log('⚡ === TESTE: TEMPO DE RESPOSTA ===\n');
        
        const testMessages = [
            "Oi, como funciona?",
            "Minha conta de luz tá muito alta",
            "Quero saber sobre energia solar",
            "Não entendi nada, pode explicar melhor?",
            "Quanto custa?"
        ];
        
        for (const message of testMessages) {
            const startTime = Date.now();
            
            // Simular processamento completo
            await this.campaignIntegration.processSurveyResponse(message, {
                customer_profile: { personality: 'unknown' },
                conversation_history: []
            });
            
            const responseTime = Date.now() - startTime;
            this.metrics.responseTime.push(responseTime);
            
            console.log(`📝 "${message}" - ${responseTime}ms`);
        }
        
        const avgResponseTime = this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length;
        console.log(`\n⏱️  Tempo médio de resposta: ${Math.round(avgResponseTime)}ms`);
        console.log(`🎯 Meta: < 2000ms - ${avgResponseTime < 2000 ? '✅ APROVADO' : '❌ REPROVADO'}`);
    }

    // Teste de naturalidade
    async testNaturalness() {
        console.log('\n🌿 === TESTE: NATURALIDADE ===\n');
        
        const responses = [];
        const baseMessage = "Entendi sua situação";
        
        // Gerar 10 variações
        for (let i = 0; i < 10; i++) {
            const response = await this.campaignIntegration.messageSystem.generateDynamicMessage(
                { personality: 'friendly' },
                'understanding',
                { adaptation_level: 'high' }
            );
            responses.push(response);
        }
        
        // Verificar repetições
        const uniqueResponses = new Set(responses);
        const uniquenessRate = (uniqueResponses.size / responses.length) * 100;
        
        console.log(`🔄 Variações geradas: ${responses.length}`);
        console.log(`✨ Respostas únicas: ${uniqueResponses.size}`);
        console.log(`📊 Taxa de unicidade: ${Math.round(uniquenessRate)}%`);
        console.log(`🎯 Meta: > 80% - ${uniquenessRate > 80 ? '✅ APROVADO' : '❌ REPROVADO'}`);
        
        console.log('\n📝 Exemplos de variações:');
        responses.slice(0, 5).forEach((response, index) => {
            console.log(`   ${index + 1}. "${response}"`);
        });
    }

    // Teste de conversão simulada
    async testConversionSimulation() {
        console.log('\n💰 === TESTE: SIMULAÇÃO DE CONVERSÃO ===\n');
        
        const customerProfiles = [
            { type: 'analytical', interest: 'high', budget: 'high' },
            { type: 'impulsive', interest: 'medium', budget: 'medium' },
            { type: 'conservative', interest: 'low', budget: 'low' },
            { type: 'practical', interest: 'high', budget: 'medium' }
        ];
        
        let conversions = 0;
        
        for (const profile of customerProfiles) {
            const conversionProbability = this.calculateConversionProbability(profile);
            const converted = Math.random() < conversionProbability;
            
            if (converted) conversions++;
            
            console.log(`👤 ${profile.type}: ${Math.round(conversionProbability * 100)}% - ${converted ? '✅ CONVERTEU' : '❌ NÃO CONVERTEU'}`);
        }
        
        const conversionRate = (conversions / customerProfiles.length) * 100;
        console.log(`\n📈 Taxa de conversão simulada: ${Math.round(conversionRate)}%`);
        console.log(`🎯 Meta: > 25% - ${conversionRate > 25 ? '✅ APROVADO' : '❌ REPROVADO'}`);
    }

    calculateConversionProbability(profile) {
        let probability = 0.2; // Base 20%
        
        // Ajustar por tipo de personalidade
        const personalityMultipliers = {
            analytical: 0.8,
            impulsive: 1.3,
            conservative: 0.6,
            practical: 1.1
        };
        
        probability *= personalityMultipliers[profile.type] || 1;
        
        // Ajustar por interesse
        const interestMultipliers = {
            high: 1.5,
            medium: 1.0,
            low: 0.5
        };
        
        probability *= interestMultipliers[profile.interest] || 1;
        
        // Ajustar por orçamento
        const budgetMultipliers = {
            high: 1.3,
            medium: 1.0,
            low: 0.7
        };
        
        probability *= budgetMultipliers[profile.budget] || 1;
        
        return Math.min(probability, 0.9); // Máximo 90%
    }

    async runPerformanceTests() {
        console.log('🏃‍♂️ === INICIANDO TESTES DE PERFORMANCE ===\n');
        
        await this.testResponseTime();
        await this.testNaturalness();
        await this.testConversionSimulation();
        
        console.log('\n🎉 === TESTES DE PERFORMANCE CONCLUÍDOS ===');
    }
}

module.exports = PerformanceTester;

if (require.main === module) {
    const tester = new PerformanceTester();
    tester.runPerformanceTests().catch(console.error);
}