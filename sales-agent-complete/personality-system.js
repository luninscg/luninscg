class PersonalitySystem {
    constructor() {
        this.personalityProfiles = {
            analitico: {
                comunicacao: 'técnica e detalhada',
                foco: 'dados e ROI',
                ritmo: 'pausado e reflexivo',
                linguagem: 'formal com termos técnicos'
            },
            expressivo: {
                comunicacao: 'emocional e calorosa',
                foco: 'benefícios familiares',
                ritmo: 'dinâmico e entusiasta',
                linguagem: 'informal e próxima'
            },
            condutor: {
                comunicacao: 'direta e objetiva',
                foco: 'resultados imediatos',
                ritmo: 'rápido e eficiente',
                linguagem: 'concisa e assertiva'
            },
            amigavel: {
                comunicacao: 'social e relacionada',
                foco: 'relacionamento e confiança',
                ritmo: 'conversacional',
                linguagem: 'amigável e regional'
            }
        };
    }

    detectPersonality(messages, customerData) {
        const indicators = {
            analitico: 0,
            expressivo: 0,
            condutor: 0,
            amigavel: 0
        };
    
        // Corrigir para aceitar string ou array
        const lastMessages = Array.isArray(messages) ? messages.slice(-5) : [messages];
        
        lastMessages.forEach(msg => {
            const text = typeof msg === 'string' ? msg.toLowerCase() : msg.message?.toLowerCase() || '';
            
            // Indicadores Analíticos
            if (text.includes('como funciona') || text.includes('dados') || 
                text.includes('eficiência') || text.includes('técnico')) {
                indicators.analitico += 2;
            }
            
            // Indicadores Expressivos
            if (text.includes('família') || text.includes('filhos') || 
                text.includes('casa') || text.includes('futuro')) {
                indicators.expressivo += 2;
            }
            
            // Indicadores Condutores
            if (text.includes('quanto') || text.includes('preço') || 
                text.includes('rápido') || text.includes('agora')) {
                indicators.condutor += 2;
            }
            
            // Indicadores Amigáveis
            if (text.length > 50 || text.includes('obrigado') || 
                text.includes('legal') || text.includes('bacana')) {
                indicators.amigavel += 1;
            }
        });

        const primaryType = Object.keys(indicators).reduce((a, b) => 
            indicators[a] > indicators[b] ? a : b
        );
        
        return {
            primary_type: primaryType,
            confidence: Math.max(...Object.values(indicators)) / 10,
            scores: indicators
        };
    }

    adaptResponse(message, personality) {
        const profile = this.personalityProfiles[personality];
        
        // Adapta delays baseado no perfil
        if (personality === 'condutor') {
            message = message.replace(/delay:\d+/g, 'delay:500');
        } else if (personality === 'analitico') {
            message = message.replace(/delay:\d+/g, 'delay:2000');
        }
        
        return message;
    }
}

module.exports = { PersonalitySystem };