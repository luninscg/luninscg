class SmartScheduling {
    constructor() {
        this.schedulingStrategies = {
            cetico: {
                approach: 'prova_social',
                message: "Que tal marcarmos uma videochamada de 15 minutos? Posso te mostrar casos reais de clientes aqui de Campo Grande mesmo.",
                urgency: 'baixa'
            },
            interessado: {
                approach: 'finalizacao',
                message: "Perfeito! Para finalizar, que tal agendarmos uma conversa rápida por vídeo? Assim posso tirar qualquer dúvida final.",
                urgency: 'media'
            },
            urgente: {
                approach: 'imediata',
                message: "Vejo que você precisa resolver isso rápido! Posso te ligar agora mesmo ou prefere agendar para hoje ainda?",
                urgency: 'alta'
            },
            tecnico: {
                approach: 'especialista',
                message: "Seu caso é bem específico. Vou conectar você com nosso especialista técnico. Quando seria melhor?",
                urgency: 'media'
            }
        };
    }

    determineSchedulingStrategy(customerProfile, conversationHistory) {
        const { personality, emotional_state, objection_type, interest_level } = customerProfile;
        
        if (objection_type === 'confianca' || emotional_state === 'ceticismo') {
            return 'cetico';
        }
        
        if (interest_level > 7 || emotional_state === 'entusiasmo') {
            return 'interessado';
        }
        
        if (emotional_state === 'urgencia') {
            return 'urgente';
        }
        
        if (objection_type === 'tecnico') {
            return 'tecnico';
        }
        
        return 'interessado'; // default
    }

    generateSchedulingMessage(strategy, customerName) {
        const strategyData = this.schedulingStrategies[strategy];
        let message = strategyData.message;
        
        // Personaliza com o nome
        if (customerName) {
            message = `Olha, ${customerName}, ${message.toLowerCase()}`;
        }
        
        // Adiciona opções de horário baseado na urgência
        if (strategyData.urgency === 'alta') {
            message += "|||delay:1000|||Tenho disponibilidade agora ou nas próximas 2 horas.";
        } else if (strategyData.urgency === 'media') {
            message += "|||delay:1200|||Prefere manhã ou tarde? Hoje ou amanhã?";
        } else {
            message += "|||delay:1500|||Que dia da semana funciona melhor para você?";
        }
        
        return message;
    }

    shouldEscalateToHuman(conversationMetrics) {
        const { objection_count, message_count, interest_level, customer_authority } = conversationMetrics;
        
        return (
            objection_count >= 3 ||
            (message_count > 15 && interest_level < 5) ||
            customer_authority === 'high' ||
            conversationMetrics.explicit_human_request
        );
    }
}

module.exports = { SmartScheduling };