class MinimalMessageSystem {
    constructor() {
        this.usedMessages = new Map();
        this.messageTemplates = {
            understanding: [
                "Entendi sua situação",
                "Compreendo perfeitamente",
                "Faz total sentido",
                "Saquei o que você tá passando",
                "Imagino como deve ser",
                "Realmente, é uma situação complicada",
                "Entendo sua preocupação",
                "Sei como é essa situação",
                "Compreendo sua frustração",
                "Faz sentido você pensar assim"
            ],
            agreement: [
                "Exato!",
                "Isso mesmo!",
                "Perfeito!",
                "Show!",
                "Certinho!",
                "É isso aí!",
                "Concordo totalmente!",
                "Você tem razão!",
                "Pensamento certeiro!",
                "Falou tudo!"
            ],
            empathy: [
                "Imagino como deve ser difícil",
                "Realmente é uma situação chata",
                "Entendo sua frustração",
                "Sei que é complicado",
                "Deve ser bem estressante",
                "Compreendo sua preocupação",
                "É natural se sentir assim",
                "Qualquer um ficaria incomodado",
                "Sua reação é totalmente compreensível",
                "Sei que pesa no orçamento"
            ]
        };
    }

    generateDynamicMessage(context, messageType, personalityAdaptation) {
        const conversationId = context.conversation_id || 'default';
        
        if (!this.usedMessages.has(conversationId)) {
            this.usedMessages.set(conversationId, new Set());
        }
        
        const usedInConversation = this.usedMessages.get(conversationId);
        const templates = this.messageTemplates[messageType] || this.messageTemplates.understanding;
        
        // Filtra mensagens não usadas
        const availableTemplates = templates.filter(template => !usedInConversation.has(template));
        
        // Se todas foram usadas, reseta
        if (availableTemplates.length === 0) {
            usedInConversation.clear();
            availableTemplates.push(...templates);
        }
        
        // Seleciona mensagem aleatória
        const selectedMessage = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
        usedInConversation.add(selectedMessage);
        
        // Adapta à personalidade se fornecida
        if (personalityAdaptation && personalityAdaptation.adaptation_level === 'high') {
            return this.adaptToPersonality(selectedMessage, personalityAdaptation.personality_type);
        }
        
        return selectedMessage;
    }
    
    adaptToPersonality(message, personalityType) {
        const adaptations = {
            analytical: {
                'Entendi': 'Analisando sua situação',
                'Exato': 'Correto',
                'Show': 'Perfeito'
            },
            friendly: {
                'Entendi': 'Saquei',
                'Perfeito': 'Show de bola',
                'Correto': 'Isso aí'
            },
            professional: {
                'Show': 'Excelente',
                'Saquei': 'Compreendo',
                'Massa': 'Muito bom'
            }
        };
        
        const personalityAdaptations = adaptations[personalityType] || {};
        let adaptedMessage = message;
        
        for (const [original, adapted] of Object.entries(personalityAdaptations)) {
            adaptedMessage = adaptedMessage.replace(new RegExp(original, 'gi'), adapted);
        }
        
        return adaptedMessage;
    }
    
    resetConversationMemory(conversationId) {
        this.usedMessages.delete(conversationId);
    }
}

module.exports = { MinimalMessageSystem };