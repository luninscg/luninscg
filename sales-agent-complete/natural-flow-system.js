class NaturalFlowSystem {
    constructor() {
        this.conversationPatterns = {
            energy_survey: {
                stage_1: 'opener_with_survey',
                stage_2: 'empathetic_listening',
                stage_3: 'natural_transition',
                stage_4: 'solution_introduction',
                stage_5: 'value_demonstration'
            }
        };
        
        this.responseAdaptations = {
            high_bill: {
                empathy: "Nossa, realmente tá pesado...",
                transition: "Olha, é exatamente por isso que muitas famílias têm nos procurado",
                solution_hint: "Tem uma forma de reduzir isso sem investimento inicial"
            },
            moderate_bill: {
                empathy: "Entendo, mesmo não sendo absurdo, sempre dá para melhorar, né?",
                transition: "Muitos clientes nossos pensavam assim também",
                solution_hint: "E descobriram que dava para economizar mais do que imaginavam"
            },
            satisfied: {
                empathy: "Que bom que não tá pesando muito!",
                transition: "Mesmo assim, sempre é interessante conhecer alternativas",
                solution_hint: "Principalmente quando não precisa investir nada"
            }
        };
    }

    generateNaturalResponse(customerResponse, conversationContext) {
        const responseType = this.classifyCustomerResponse(customerResponse);
        const adaptation = this.responseAdaptations[responseType];
        const personalityHints = this.extractPersonalityHints(customerResponse);
        
        return {
            empathetic_response: adaptation.empathy,
            natural_transition: adaptation.transition,
            solution_introduction: adaptation.solution_hint,
            personality_adaptation: personalityHints,
            next_stage_guidance: this.determineNextStage(responseType, personalityHints)
        };
    }

    classifyCustomerResponse(response) {
        const text = response.toLowerCase();
        
        // Detecta sinais de conta alta
        if (text.includes('caro') || text.includes('alto') || text.includes('pesado') || 
            text.match(/r\$\s*[3-9]\d{2}/) || text.match(/r\$\s*\d{4}/)) {
            return 'high_bill';
        }
        
        // Detecta satisfação
        if (text.includes('normal') || text.includes('ok') || text.includes('tranquilo') ||
            text.includes('não reclamo')) {
            return 'satisfied';
        }
        
        return 'moderate_bill';
    }

    extractPersonalityHints(response) {
        const text = response.toLowerCase();
        const hints = {
            communication_style: 'unknown',
            detail_level: 'medium',
            decision_speed: 'medium'
        };
        
        // Detecta estilo analítico
        if (text.includes('kwh') || text.includes('tarifa') || text.includes('como funciona')) {
            hints.communication_style = 'analytical';
            hints.detail_level = 'high';
        }
        
        // Detecta estilo direto
        if (text.length < 20 || text.includes('quanto') || text.includes('preço')) {
            hints.communication_style = 'direct';
            hints.decision_speed = 'fast';
        }
        
        // Detecta estilo expressivo
        if (text.length > 50 || text.includes('família') || text.includes('casa')) {
            hints.communication_style = 'expressive';
            hints.detail_level = 'story_based';
        }
        
        return hints;
    }

    determineNextStage(responseType, personalityHints) {
        if (responseType === 'high_bill' && personalityHints.decision_speed === 'fast') {
            return 'accelerated_solution_demo';
        }
        
        if (personalityHints.communication_style === 'analytical') {
            return 'technical_explanation_first';
        }
        
        return 'standard_empathetic_flow';
    }
}

module.exports = { NaturalFlowSystem };