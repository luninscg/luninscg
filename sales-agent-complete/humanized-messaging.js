class HumanizedMessaging {
    constructor() {
        this.variationsBank = {
            greeting: [
                "E aí, tudo certo?",
                "Opa, tudo joia?",
                "Olá! Como vai?",
                "Oi! Tudo bem?"
            ],
            understanding: [
                "Entendo...",
                "Ah, saquei!",
                "Faz sentido mesmo",
                "Imagino",
                "Compreendo"
            ],
            enthusiasm: [
                "Show de bola!",
                "Perfeito!",
                "Massa!",
                "Excelente!",
                "Que legal!"
            ],
            thinking: [
                "Deixa eu ver aqui...",
                "Vou analisar...",
                "Aguarda um instante...",
                "Deixa eu verificar..."
            ]
        };
        
        this.regionalExpressions = [
            "Tá ligado?",
            "Saca só",
            "Olha só",
            "Viu só",
            "Imagina só"
        ];
    }

    humanizeMessage(message, personality, emotionalState) {
        let humanized = message;
        
        // Adiciona imperfeições intencionais
        if (Math.random() < 0.3) {
            humanized = this.addThinkingPause(humanized);
        }
        
        // Adiciona expressões regionais
        if (personality === 'amigavel' && Math.random() < 0.4) {
            humanized = this.addRegionalExpression(humanized);
        }
        
        // Adapta baseado no estado emocional
        humanized = this.adaptToEmotion(humanized, emotionalState);
        
        return humanized;
    }

    addThinkingPause(message) {
        const thinkingPhrases = this.variationsBank.thinking;
        const randomPhrase = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
        return `${randomPhrase}|||delay:1200|||${message}`;
    }

    addRegionalExpression(message) {
        const expressions = this.regionalExpressions;
        const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];
        return `${randomExpression}, ${message.toLowerCase()}`;
    }

    adaptToEmotion(message, emotion) {
        const emotionalPrefixes = {
            entusiasmo: "Que legal! ",
            preocupacao: "Olha, ",
            ceticismo: "Entendo sua dúvida... ",
            urgencia: "Certo, vamos direto ao ponto! "
        };
        
        if (emotionalPrefixes[emotion]) {
            return emotionalPrefixes[emotion] + message;
        }
        
        return message;
    }

    varyResponse(baseResponse) {
        // Substitui palavras comuns por variações
        const substitutions = {
            'obrigado': ['valeu', 'show', 'perfeito'],
            'entendo': ['saquei', 'compreendo', 'faz sentido'],
            'legal': ['bacana', 'interessante', 'massa'],
            'sim': ['isso mesmo', 'exato', 'certinho']
        };
        
        let varied = baseResponse;
        for (const [original, variations] of Object.entries(substitutions)) {
            if (varied.toLowerCase().includes(original)) {
                const randomVariation = variations[Math.floor(Math.random() * variations.length)];
                varied = varied.replace(new RegExp(original, 'gi'), randomVariation);
            }
        }
        
        return varied;
    }
}

module.exports = { HumanizedMessaging };