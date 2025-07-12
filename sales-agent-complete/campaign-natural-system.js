class CampaignNaturalSystem {
    constructor() {
        this.campaignTypes = {
            energy_survey: {
                trigger: 'disparo_campanha',
                approach: 'pesquisa_gastos_energia',
                personality_adaptation: true,
                natural_flow: true
            }
        };
        
        this.regionalContext = {
            campo_grande: {
                climate: 'calor intenso',
                energy_concerns: ['ar condicionado', 'ventilador', 'conta alta'],
                local_expressions: ['esse calor', 'aqui em MS', 'nossa região']
            },
            default: {
                climate: 'variado',
                energy_concerns: ['conta alta', 'economia'],
                local_expressions: ['aqui na região', 'na nossa área']
            }
        };
        
        this.dynamicOpeners = {
            morning: [
                "Bom dia! Aqui é o Gabriel, da Energia A",
                "Oi! Gabriel da Energia A aqui",
                "Olá! Gabriel, consultor em energia"
            ],
            afternoon: [
                "Boa tarde! Gabriel da Energia A",
                "Oi! Tudo bem? Gabriel aqui",
                "E aí! Gabriel, da Energia A"
            ],
            evening: [
                "Boa noite! Gabriel da Energia A",
                "Oi! Gabriel aqui, da Energia A",
                "Olá! Gabriel, consultor em energia"
            ]
        };
    }

    generateNaturalCampaignOpener(contactData, timeOfDay) {
        const opener = this.selectRandomOpener(timeOfDay);
        const regionalContext = this.getRegionalContext(contactData.city);
        const energySurveyApproach = this.generateEnergySurveyApproach(regionalContext);
        
        return {
            opener,
            survey_approach: energySurveyApproach,
            personality_hints: this.detectInitialPersonality(contactData),
            conversation_flow: 'energy_survey_campaign'
        };
    }

    selectRandomOpener(timeOfDay) {
        const openers = this.dynamicOpeners[timeOfDay] || this.dynamicOpeners.afternoon;
        return openers[Math.floor(Math.random() * openers.length)];
    }

    // FUNÇÃO AUSENTE - ADICIONANDO
    getRegionalContext(city) {
        if (!city) return this.regionalContext.default;
        
        const cityKey = city.toLowerCase().replace(/\s+/g, '_');
        return this.regionalContext[cityKey] || this.regionalContext.default;
    }

    generateEnergySurveyApproach(regionalContext) {
        const approaches = [
            {
                message: "Estou trabalhando aqui na região e queria saber|||delay:1200|||como você tem achado os gastos com energia ultimamente?",
                follow_up: "Com esse calor que tá fazendo, imagino que o ar condicionado não dá trégua, né?",
                tone: 'conversational'
            },
            {
                message: "Ando atendendo algumas famílias aqui na região|||delay:1500|||e queria te perguntar: como tá a situação da conta de luz aí?",
                follow_up: "Muita gente tem reclamado que tá pesando no orçamento...",
                tone: 'empathetic'
            },
            {
                message: "Trabalho com soluções de energia aqui na região|||delay:1000|||e queria saber sua opinião: como você vê os gastos com energia?",
                follow_up: "Principalmente agora no verão, que o consumo sempre dispara...",
                tone: 'consultative'
            }
        ];
        
        return approaches[Math.floor(Math.random() * approaches.length)];
    }

    detectInitialPersonality(contactData) {
        // Análise inicial baseada em dados disponíveis
        const hints = {
            likely_personality: 'unknown',
            adaptation_strategy: 'observe_and_adapt',
            initial_approach: 'friendly_survey'
        };
        
        // Se temos dados do perfil, fazemos inferências
        if (contactData.profession) {
            if (['engenheiro', 'técnico', 'analista'].includes(contactData.profession.toLowerCase())) {
                hints.likely_personality = 'analytical';
                hints.adaptation_strategy = 'technical_approach';
            }
        }
        
        return hints;
    }
}

module.exports = { CampaignNaturalSystem };