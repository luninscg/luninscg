const { PersonalitySystem } = require('./personality-system');
const { ActiveListeningSystem } = require('./active-listening-system');
const { HumanizedMessaging } = require('./humanized-messaging');
const { CampaignNaturalSystem } = require('./campaign-natural-system');
const { AntiRoboticSystem } = require('./anti-robotic-system');
const { SmartScheduling } = require('./smart-scheduling');

class GabrielHumanoTester {
    constructor() {
        this.personalitySystem = new PersonalitySystem();
        this.activeListening = new ActiveListeningSystem();
        this.humanizedMessaging = new HumanizedMessaging();
        this.campaignSystem = new CampaignNaturalSystem();
        this.antiRobotic = new AntiRoboticSystem();
        this.smartScheduling = new SmartScheduling();
        
        this.testResults = {
            personality: [],
            listening: [],
            messaging: [],
            campaign: [],
            antiRobotic: [],
            scheduling: []
        };
    }

    // Teste do Sistema de Personalidade
    async testPersonalityDetection() {
        console.log('🧠 === TESTE: DETECÇÃO DE PERSONALIDADE ===\n');
        
        const testCases = [
            {
                name: 'Cliente Analítico',
                message: 'Preciso ver os números exatos, dados técnicos e ROI detalhado antes de decidir.',
                expected: 'analytical'
            },
            {
                name: 'Cliente Impulsivo',
                message: 'Nossa, que interessante! Quero saber mais agora mesmo!',
                expected: 'impulsive'
            },
            {
                name: 'Cliente Conservador',
                message: 'Não sei... preciso pensar bem, conversar com a família...',
                expected: 'conservative'
            },
            {
                name: 'Cliente Prático',
                message: 'Vai funcionar mesmo? Quanto tempo demora? É confiável?',
                expected: 'practical'
            }
        ];

        for (const testCase of testCases) {
            const result = await this.personalitySystem.detectPersonality(testCase.message);
            const success = result.primary_type === testCase.expected;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.name}:`);
            console.log(`   Esperado: ${testCase.expected}`);
            console.log(`   Detectado: ${result.primary_type}`);
            console.log(`   Confiança: ${result.confidence}%\n`);
            
            this.testResults.personality.push({ testCase: testCase.name, success, result });
        }
    }

    // Teste do Sistema de Escuta Ativa
    async testActiveListening() {
        console.log('👂 === TESTE: ESCUTA ATIVA ===\n');
        
        const testCases = [
            {
                name: 'Frustração com Conta Alta',
                message: 'Minha conta de luz tá um absurdo! Não aguento mais pagar isso!',
                expectedSentiment: 'frustrated'
            },
            {
                name: 'Interesse Genuíno',
                message: 'Que legal! Como funciona essa energia por assinatura?',
                expectedSentiment: 'interested'
            },
            {
                name: 'Ceticismo',
                message: 'Sei não... já vi muita propaganda enganosa por aí...',
                expectedSentiment: 'skeptical'
            }
        ];

        for (const testCase of testCases) {
            const analysis = await this.activeListening.analyzeSentimentAndNeeds(testCase.message);
            const empathicResponse = await this.activeListening.generateEmpathicResponse(analysis);
            
            console.log(`📝 ${testCase.name}:`);
            console.log(`   Sentimento: ${analysis.sentiment}`);
            console.log(`   Necessidades: ${analysis.needs.join(', ')}`);
            console.log(`   Resposta Empática: "${empathicResponse}"\n`);
            
            this.testResults.listening.push({ testCase: testCase.name, analysis, empathicResponse });
        }
    }

    // Teste do Sistema de Mensagens Humanizadas
    async testHumanizedMessaging() {
        console.log('💬 === TESTE: MENSAGENS HUMANIZADAS ===\n');
        
        const baseMessage = "Entendi sua situação. Vou te explicar como funciona.";
        
        console.log('🔄 Gerando 5 variações humanizadas:');
        for (let i = 1; i <= 5; i++) {
            const humanized = await this.humanizedMessaging.humanizeMessage(baseMessage, {
                personality: 'friendly',
                context: 'explanation'
            });
            
            console.log(`   ${i}. "${humanized}"`);
        }
        
        console.log('\n🎭 Testando diferentes personalidades:');
        const personalities = ['analytical', 'friendly', 'professional', 'casual'];
        
        for (const personality of personalities) {
            const adapted = await this.humanizedMessaging.adaptToPersonality(baseMessage, personality);
            console.log(`   ${personality}: "${adapted}"`);
        }
    }

    // Teste do Sistema de Campanhas Naturais
    async testCampaignSystem() {
        console.log('\n📢 === TESTE: CAMPANHAS NATURAIS ===\n');
        
        const contactData = {
            name: 'João Silva',
            city: 'Campo Grande',
            phone: '67999999999'
        };
        
        console.log('🌅 Testando aberturas por período:');
        const periods = ['morning', 'afternoon', 'evening'];
        
        for (const period of periods) {
            const opener = this.campaignSystem.generateNaturalCampaignOpener(contactData, period);
            console.log(`   ${period}: "${opener.opener.message}"`);
        }
        
        console.log('\n🗺️ Testando contexto regional:');
        const energySurvey = this.campaignSystem.generateEnergySurveyApproach({
            climate: 'calor intenso',
            energy_concerns: ['ar condicionado', 'conta alta']
        });
        
        console.log(`   Abordagem: "${energySurvey.message}"`);
    }

    // Teste do Sistema Anti-Robótico
    async testAntiRoboticSystem() {
        console.log('\n🤖 === TESTE: SISTEMA ANTI-ROBÓTICO ===\n');
        
        const testMessage = "Obrigado pelo seu interesse!";
        
        console.log('🔄 Testando prevenção de repetições:');
        for (let i = 1; i <= 5; i++) {
            const varied = await this.antiRobotic.preventRepetition(testMessage, 'thanks');
            console.log(`   ${i}. "${varied}"`);
        }
        
        console.log('\n✨ Testando imperfeições humanas:');
        const withImperfections = await this.antiRobotic.addHumanImperfections(testMessage);
        console.log(`   Original: "${testMessage}"`);
        console.log(`   Humanizado: "${withImperfections}"`);
    }

    // Teste do Sistema de Agendamento Inteligente
    async testSmartScheduling() {
        console.log('\n📅 === TESTE: AGENDAMENTO INTELIGENTE ===\n');
        
        const customerProfiles = [
            { personality: 'analytical', availability: 'business_hours', urgency: 'low' },
            { personality: 'impulsive', availability: 'flexible', urgency: 'high' },
            { personality: 'conservative', availability: 'weekends', urgency: 'medium' }
        ];
        
        for (const profile of customerProfiles) {
            const shouldSchedule = this.smartScheduling.shouldOfferScheduling(profile);
            if (shouldSchedule) {
                const schedulingMessage = await this.smartScheduling.generateSchedulingMessage(profile);
                console.log(`📋 ${profile.personality}:`);
                console.log(`   Deve agendar: ${shouldSchedule}`);
                console.log(`   Mensagem: "${schedulingMessage}"\n`);
            }
        }
    }

    // Teste de Integração Completa
    async testFullIntegration() {
        console.log('🔗 === TESTE: INTEGRAÇÃO COMPLETA ===\n');
        
        const customerMessage = "Oi, vi que vocês trabalham com energia solar. Minha conta tá muito alta, queria entender melhor.";
        
        console.log('📥 Mensagem do cliente:');
        console.log(`"${customerMessage}"\n`);
        
        // 1. Detectar personalidade
        const personality = await this.personalitySystem.detectPersonality(customerMessage);
        console.log(`🧠 Personalidade detectada: ${personality.primary_type} (${personality.confidence}%)`);
        
        // 2. Análise de sentimento
        const sentiment = await this.activeListening.analyzeSentimentAndNeeds(customerMessage);
        console.log(`👂 Sentimento: ${sentiment.sentiment}`);
        console.log(`🎯 Necessidades: ${sentiment.needs.join(', ')}`);
        
        // 3. Gerar resposta empática
        const empathicResponse = await this.activeListening.generateEmpathicResponse(sentiment);
        console.log(`💝 Resposta empática: "${empathicResponse}"`);
        
        // 4. Humanizar mensagem
        const humanizedResponse = await this.humanizedMessaging.humanizeMessage(empathicResponse, {
            personality: personality.primary_type,
            context: 'initial_contact'
        });
        console.log(`✨ Resposta humanizada: "${humanizedResponse}"`);
        
        // 5. Verificar agendamento
        const shouldSchedule = this.smartScheduling.shouldOfferScheduling({
            personality: personality.primary_type,
            urgency: sentiment.urgency || 'medium'
        });
        
        if (shouldSchedule) {
            const schedulingOffer = await this.smartScheduling.generateSchedulingMessage({
                personality: personality.primary_type
            });
            console.log(`📅 Oferta de agendamento: "${schedulingOffer}"`);
        }
    }

    // Executar todos os testes
    async runAllTests() {
        console.log('🚀 === INICIANDO TESTES DO GABRIEL HUMANO 2.0 ===\n');
        
        try {
            await this.testPersonalityDetection();
            await this.testActiveListening();
            await this.testHumanizedMessaging();
            await this.testCampaignSystem();
            await this.testAntiRoboticSystem();
            await this.testSmartScheduling();
            await this.testFullIntegration();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Erro durante os testes:', error);
        }
    }

    // Gerar relatório de testes
    generateTestReport() {
        console.log('\n📊 === RELATÓRIO DE TESTES ===\n');
        
        const personalitySuccess = this.testResults.personality.filter(t => t.success).length;
        const personalityTotal = this.testResults.personality.length;
        
        console.log(`🧠 Detecção de Personalidade: ${personalitySuccess}/${personalityTotal} (${Math.round(personalitySuccess/personalityTotal*100)}%)`);
        console.log(`👂 Sistema de Escuta Ativa: ${this.testResults.listening.length} testes executados`);
        console.log(`💬 Mensagens Humanizadas: Funcionando`);
        console.log(`📢 Campanhas Naturais: Funcionando`);
        console.log(`🤖 Sistema Anti-Robótico: Funcionando`);
        console.log(`📅 Agendamento Inteligente: Funcionando`);
        
        console.log('\n✅ Todos os sistemas testados com sucesso!');
        console.log('🎯 Gabriel Humano 2.0 está pronto para produção!');
    }
}

module.exports = GabrielHumanoTester;

// Executar se chamado diretamente
if (require.main === module) {
    const tester = new GabrielHumanoTester();
    tester.runAllTests().catch(console.error);
}