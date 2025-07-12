class LeadRecoverySystem {
    constructor() {
        this.recoveryStrategies = new Map();
        this.automationRules = [];
    }

    // Identificar leads para recuperação
    identifyLeadsForRecovery(leads) {
        const now = new Date();
        const recoveryTargets = [];

        leads.forEach(lead => {
            const lastInteraction = new Date(lead.last_interaction_timestamp);
            const daysSinceLastContact = (now - lastInteraction) / (1000 * 60 * 60 * 24);

            // Critérios para recuperação
            if (this.shouldAttemptRecovery(lead, daysSinceLastContact)) {
                recoveryTargets.push({
                    ...lead,
                    daysSinceLastContact,
                    recoveryStrategy: this.selectRecoveryStrategy(lead, daysSinceLastContact),
                    priority: this.calculateRecoveryPriority(lead)
                });
            }
        });

        return recoveryTargets.sort((a, b) => b.priority - a.priority);
    }

    shouldAttemptRecovery(lead, daysSinceLastContact) {
        // Não recuperar se já enviou proposta recentemente
        if (lead.proposta_enviada && daysSinceLastContact < 7) return false;
        
        // Recuperar leads com interesse médio/alto após 2 dias
        if (['médio', 'alto'].includes(lead.interest_level) && daysSinceLastContact >= 2) return true;
        
        // Recuperar leads no estágio avançado após 1 dia
        if (lead.stage >= 6 && daysSinceLastContact >= 1) return true;
        
        // Recuperar leads com dados completos após 3 dias
        if (lead.consumo_medio && lead.address_cidade && daysSinceLastContact >= 3) return true;
        
        // Recuperar leads antigos após 7 dias
        if (daysSinceLastContact >= 7) return true;
        
        return false;
    }

    selectRecoveryStrategy(lead, daysSinceLastContact) {
        // Estratégia baseada no perfil e tempo
        if (lead.interest_level === 'alto' && daysSinceLastContact <= 3) {
            return 'urgent_follow_up';
        }
        
        if (lead.stage >= 8 && !lead.proposta_enviada) {
            return 'proposal_reminder';
        }
        
        if (lead.consumo_medio > 500) {
            return 'high_value_reengagement';
        }
        
        if (daysSinceLastContact >= 7) {
            return 'educational_content';
        }
        
        return 'gentle_check_in';
    }

    calculateRecoveryPriority(lead) {
        let priority = 0;
        
        // Pontuação baseada no interesse
        const interestScores = { 'alto': 30, 'médio': 20, 'baixo': 10 };
        priority += interestScores[lead.interest_level] || 0;
        
        // Pontuação baseada no estágio
        priority += lead.stage * 5;
        
        // Pontuação baseada no consumo
        if (lead.consumo_medio > 600) priority += 20;
        else if (lead.consumo_medio > 300) priority += 10;
        
        // Penalidade por tempo sem contato
        const daysSinceLastContact = (new Date() - new Date(lead.last_interaction_timestamp)) / (1000 * 60 * 60 * 24);
        if (daysSinceLastContact > 14) priority -= 10;
        
        return Math.max(0, priority);
    }

    // Gerar mensagens de recuperação
    generateRecoveryMessage(lead, strategy) {
        const messages = {
            // SUBSTITUIR AS MENSAGENS ATUAIS:
            
            urgent_follow_up: {
                message: `${lead.name}, ATENÇÃO! 🚨|||delay:1000|||Sua vaga para economia de R$ ${economia} expira HOJE!|||delay:1500|||Não perca essa oportunidade única.|||delay:1200|||Confirmo sua vaga agora?`,
                next_stage: lead.stage + 1
            },
            
            high_value_reengagement: {
                message: `${lead.name}, URGENTE! ⚡|||delay:1000|||Consumo alto = economia GIGANTE!|||delay:1500|||R$ ${economia} por mês no seu bolso.|||delay:1200|||Últimas 2 vagas. Quer uma?`,
                next_stage: 8
            },
            
            proposal_reminder: {
                message: `${lead.name}, tudo bem? 😊|||delay:1000|||Estava aqui organizando e vi que você estava interessado na proposta de energia solar.|||delay:1500|||Quer que eu finalize os cálculos para você?|||delay:1200|||É rapidinho!`,
                next_stage: 8
            },
            
            value_proposition: {
                message: `Oi ${lead.name}! 🌟|||delay:1000|||Vi que você tem um consumo alto de energia.|||delay:1500|||Preparei algumas informações específicas que podem te interessar sobre economia.|||delay:1200|||Posso compartilhar?`,
                next_stage: 4
            },
            
            educational_content: {
                message: `Oi ${lead.name}! ☀️|||delay:1000|||Como está a conta de luz aí?|||delay:1500|||Tenho visto muitas novidades sobre energia solar que podem te interessar.|||delay:1200|||Quer que eu compartilhe algumas dicas?`,
                next_stage: 2
            },
            
            gentle_check_in: {
                message: `Oi ${lead.name}! 😊|||delay:1000|||Como você está?|||delay:1500|||Lembrei de você e da nossa conversa sobre energia.|||delay:1200|||Ainda tem interesse no assunto?`,
                next_stage: lead.stage > 0 ? lead.stage : 1
            }
        };
        
        return messages[strategy] || messages.gentle_check_in;
    }
}

module.exports = { LeadRecoverySystem };