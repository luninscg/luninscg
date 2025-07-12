class ActiveListeningSystem {
    constructor() {
        this.emotionalIndicators = {
            hesitacao: ['não sei', 'talvez', 'acho que', 'será que'],
            urgencia: ['preciso', 'rápido', 'urgente', 'logo'],
            ceticismo: ['desconfio', 'será que', 'dúvida', 'suspeito'],
            entusiasmo: ['adorei', 'perfeito', 'excelente', 'maravilha'],
            preocupacao: ['medo', 'receio', 'preocupado', 'ansioso'],
            interesse: ['interessante', 'legal', 'bacana', 'gostei']
        };
        
        this.objectionPatterns = {
            preco: ['caro', 'preço', 'valor', 'dinheiro'],
            confianca: ['confio', 'seguro', 'garantia', 'risco'],
            tempo: ['pressa', 'tempo', 'depois', 'mais tarde'],
            tecnico: ['funciona', 'como', 'técnico', 'problema']
        };
    }

    analyzeSentiment(message) {
        const text = message.toLowerCase();
        const analysis = {
            emotional_state: 'neutro',
            objection_type: null,
            interest_level: 0,
            urgency_level: 0,
            confidence_level: 5
        };

        // Detecta estado emocional
        for (const [emotion, indicators] of Object.entries(this.emotionalIndicators)) {
            if (indicators.some(indicator => text.includes(indicator))) {
                analysis.emotional_state = emotion;
                break;
            }
        }

        // Detecta objeções
        for (const [objection, patterns] of Object.entries(this.objectionPatterns)) {
            if (patterns.some(pattern => text.includes(pattern))) {
                analysis.objection_type = objection;
                break;
            }
        }

        // Calcula nível de interesse
        const positiveWords = ['sim', 'ok', 'legal', 'interessante', 'gostei'];
        const negativeWords = ['não', 'difícil', 'complicado', 'problema'];
        
        analysis.interest_level = positiveWords.filter(word => text.includes(word)).length - 
                                negativeWords.filter(word => text.includes(word)).length;

        return analysis;
    }

    generateEmpathicResponse(sentiment) {
        const responses = {
            hesitacao: "Entendo sua hesitação, é normal mesmo...",
            urgencia: "Vejo que você precisa de uma solução rápida...",
            ceticismo: "Sua desconfiança faz todo sentido...",
            entusiasmo: "Que bom ver seu interesse!",
            preocupacao: "Compreendo sua preocupação...",
            interesse: "Fico feliz que tenha gostado!"
        };
        
        return responses[sentiment.emotional_state] || "Entendo...";
    }
}

module.exports = { ActiveListeningSystem };