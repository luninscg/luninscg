// Integração com o sistema existente
const { CampaignNaturalSystem } = require('./campaign-natural-system');
const { NaturalFlowSystem } = require('./natural-flow-system');
const { MinimalMessageSystem } = require('./minimal-message-system');

class CampaignIntegration {
    constructor() {
        this.campaignSystem = new CampaignNaturalSystem();
        this.flowSystem = new NaturalFlowSystem();
        this.messageSystem = new MinimalMessageSystem();
    }

    // Detecta se é início de campanha
    isCampaignInitiation(context) {
        return context.source === 'campaign_dispatch' || 
               context.trigger === 'energy_survey_campaign';
    }

    // Gera abertura natural para campanha
    generateCampaignOpener(contactData) {
        const timeOfDay = this.getTimeOfDay();
        const campaignData = this.campaignSystem.generateNaturalCampaignOpener(contactData, timeOfDay);
        
        return {
            response_message: `${campaignData.opener}|||delay:1500|||${campaignData.survey_approach.message}`,
            next_stage: 2, // Vai para escuta empática
            campaign_context: {
                type: 'energy_survey',
                approach: campaignData.survey_approach,
                personality_hints: campaignData.personality_hints
            },
            conversation_flow: 'campaign_initiated'
        };
    }

    // Processa resposta à pesquisa de energia
    processSurveyResponse(customerResponse, context) {
        const naturalResponse = this.flowSystem.generateNaturalResponse(customerResponse, context);
        const dynamicMessage = this.messageSystem.generateDynamicMessage(
            context, 
            'understanding', 
            naturalResponse.personality_adaptation
        );
        
        return {
            response_message: `${dynamicMessage}|||delay:1200|||${naturalResponse.empathetic_response}|||delay:1500|||${naturalResponse.natural_transition}|||delay:1000|||${naturalResponse.solution_introduction}`,
            next_stage: this.determineNextStage(naturalResponse),
            personality_profile: naturalResponse.personality_adaptation,
            conversation_flow: 'survey_to_solution'
        };
    }

    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    determineNextStage(naturalResponse) {
        switch (naturalResponse.next_stage_guidance) {
            case 'accelerated_solution_demo': return 4;
            case 'technical_explanation_first': return 3;
            default: return 3;
        }
    }
}

module.exports = { CampaignIntegration };