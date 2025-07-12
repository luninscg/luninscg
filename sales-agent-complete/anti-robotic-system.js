class AntiRoboticSystem {
    constructor() {
        this.usedPhrases = new Map();
        this.conversationMemory = new Map();
        this.humanizationTechniques = {
            typos: ['tá', 'né', 'pq', 'vc'],
            contractions: {
                'não é': 'né',
                'você': 'vc', 
                'porque': 'pq',
                'para': 'pra',
                'está': 'tá',
                'vamos': 'vamo'
            },
            fillers: ['né', 'sabe', 'tipo assim', 'olha'],
            corrections: ['aliás', 'melhor dizendo', 'na verdade']
        };
    }

    preventRepetition(message, conversationId) {
        if (!this.usedPhrases.has(conversationId)) {
            this.usedPhrases.set(conversationId, new Set());
        }
        
        const usedInConversation = this.usedPhrases.get(conversationId);
        const messageKey = this.extractKeyPhrase(message);
        
        if (usedInConversation.has(messageKey)) {
            return this.generateVariation(message);
        }
        
        usedInConversation.add(messageKey);
        return message;
    }

    extractKeyPhrase(message) {
        // Remove delays e extrai frase principal
        return message.replace(/\|\|\|delay:\d+\|\|\|/g, '').substring(0, 30);
    }

    generateVariation(originalMessage) {
        const variations = {
            'entendo': ['saquei', 'compreendo', 'faz sentido'],
            'perfeito': ['show', 'excelente', 'ótimo'],
            'legal': ['bacana', 'interessante', 'massa'],
            'obrigado': ['valeu', 'show', 'perfeito']
        };
        
        let varied = originalMessage;
        for (const [original, options] of Object.entries(variations)) {
            if (varied.toLowerCase().includes(original)) {
                const randomOption = options[Math.floor(Math.random() * options.length)];
                varied = varied.replace(new RegExp(original, 'gi'), randomOption);
                break;
            }
        }
        
        return varied;
    }

    addHumanImperfections(message) {
        // Adiciona pequenas imperfeições humanas
        if (Math.random() < 0.2) {
            message = this.addSelfCorrection(message);
        }
        
        if (Math.random() < 0.3) {
            message = this.addFiller(message);
        }
        
        // Aplica contrações
        message = this.applyContractions(message);
        
        return message;
    }

    applyContractions(message) {
        let contracted = message;
        for (const [full, contracted_form] of Object.entries(this.humanizationTechniques.contractions)) {
            contracted = contracted.replace(new RegExp(full, 'gi'), contracted_form);
        }
        return contracted;
    }

    addSelfCorrection(message) {
        const corrections = this.humanizationTechniques.corrections;
        const randomCorrection = corrections[Math.floor(Math.random() * corrections.length)];
        
        // Adiciona correção no meio da mensagem
        const parts = message.split('|||');
        if (parts.length > 1) {
            parts.splice(1, 0, `${randomCorrection}`);
            return parts.join('|||');
        }
        
        return message;
    }

    addFiller(message) {
        const fillers = this.humanizationTechniques.fillers;
        const randomFiller = fillers[Math.floor(Math.random() * fillers.length)];
        
        return `${randomFiller}, ${message.toLowerCase()}`;
    }
}

module.exports = { AntiRoboticSystem };