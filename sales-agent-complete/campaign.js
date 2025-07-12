require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendWhatsAppMessage } = require('./utils');
const { getAllLeads, updateLead } = require('./database');

// Configuração do Google Sheets
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/spreadsheets']
});

// Configuração do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

class CampaignManager {
    constructor() {
        this.doc = null;
        this.campaignSheet = null;
    }

    async initialize() {
        try {
            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
            await this.doc.loadInfo();
            
            // Procura ou cria a aba de campanhas
            this.campaignSheet = this.doc.sheetsByTitle['Campanha_Disparos'];
            if (!this.campaignSheet) {
                this.campaignSheet = await this.doc.addSheet({
                    title: 'Campanha_Disparos',
                    headerValues: [
                        'Data_Disparo', 'Whatsapp', 'Nome', 'Estagio', 'Interesse',
                        'Mensagem_Enviada', 'Status', 'Resposta_Cliente', 'Observacoes'
                    ]
                });
            }
            
            console.log('✅ Campaign Manager inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar Campaign Manager:', error);
            throw error;
        }
    }

    async generatePersonalizedMessage(lead, campaignType = 'reativacao') {
        try {
            // SUBSTITUIR O PROMPT ATUAL POR:
            
            const prompt = `
            Você é um CLOSER de energia solar que FECHA VENDAS.
            
            DADOS DO LEAD:
            - Nome: ${lead.name}
            - Consumo: ${lead.consumo_medio || 'Alto'} kWh
            - Economia estimada: R$ ${Math.round((lead.consumo_medio || 400) * 0.7 * 0.2)}
            
            Crie uma mensagem de IMPACTO que:
            1. Use o NOME do cliente
            2. Mencione economia ESPECÍFICA em R$
            3. Crie URGÊNCIA (últimas vagas, prazo)
            4. Termine com pergunta de FECHAMENTO
            5. Use emojis estratégicos (🔥💰⚡)
            
            EXEMPLO:
            "Maria, sua conta de R$ 380 pode virar R$ 190! 🔥 Últimas 3 vagas do desconto especial. Quer garantir?"
            
            Máximo 200 caracteres. SEJA DIRETO E PERSUASIVO.
            `;

            const result = await model.generateContent(prompt);
            const message = result.response.text().trim();
            
            return message;
        } catch (error) {
            console.error('Erro ao gerar mensagem personalizada:', error);
            return `Olá ${lead.name || 'cliente'}! Que tal economizar na conta de luz com energia solar? Posso te ajudar com uma proposta personalizada?`;
        }
    }

    async runCampaign(campaignType = 'reativacao', targetStages = [1, 2, 3]) {
        try {
            console.log(`🚀 Iniciando campanha: ${campaignType}`);
            
            // Busca leads elegíveis
            const allLeads = await getAllLeads();
            const eligibleLeads = allLeads.filter(lead => {
                // Filtra por estágio
                if (!targetStages.includes(lead.stage)) return false;
                
                // Verifica última interação (não enviar para quem interagiu nas últimas 24h)
                const lastInteraction = new Date(lead.last_interaction_timestamp);
                const now = new Date();
                const hoursSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60);
                
                return hoursSinceLastInteraction > 24;
            });

            console.log(`📊 Leads elegíveis encontrados: ${eligibleLeads.length}`);
            
            let successCount = 0;
            let errorCount = 0;

            for (const lead of eligibleLeads) {
                try {
                    // Gera mensagem personalizada
                    const message = await this.generatePersonalizedMessage(lead, campaignType);
                    
                    // Envia mensagem
                    await sendWhatsAppMessage(lead.whatsapp_number, message);
                    
                    // Registra no Google Sheets
                    await this.campaignSheet.addRow({
                        Data_Disparo: new Date().toISOString(),
                        Whatsapp: lead.whatsapp_number,
                        Nome: lead.name || 'N/A',
                        Estagio: lead.stage,
                        Interesse: lead.interest_level || 'N/A',
                        Mensagem_Enviada: message,
                        Status: 'Enviado',
                        Resposta_Cliente: '',
                        Observacoes: `Campanha: ${campaignType}`
                    });
                    
                    // Atualiza lead no banco
                    await updateLead(lead.whatsapp_number, {
                        source: `Campanha_${campaignType}`,
                        last_interaction_timestamp: new Date().toISOString()
                    });
                    
                    successCount++;
                    console.log(`✅ Mensagem enviada para ${lead.name || lead.whatsapp_number}`);
                    
                    // Delay entre mensagens (2-5 segundos)
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
                    
                } catch (error) {
                    console.error(`❌ Erro ao enviar para ${lead.whatsapp_number}:`, error);
                    errorCount++;
                    
                    // Registra erro no Google Sheets
                    await this.campaignSheet.addRow({
                        Data_Disparo: new Date().toISOString(),
                        Whatsapp: lead.whatsapp_number,
                        Nome: lead.name || 'N/A',
                        Estagio: lead.stage,
                        Interesse: lead.interest_level || 'N/A',
                        Mensagem_Enviada: '',
                        Status: 'Erro',
                        Resposta_Cliente: '',
                        Observacoes: `Erro: ${error.message}`
                    });
                }
            }

            console.log(`📈 Campanha finalizada:`);
            console.log(`   ✅ Sucessos: ${successCount}`);
            console.log(`   ❌ Erros: ${errorCount}`);
            console.log(`   📊 Total processado: ${eligibleLeads.length}`);
            
            return {
                success: successCount,
                errors: errorCount,
                total: eligibleLeads.length
            };
            
        } catch (error) {
            console.error('❌ Erro na campanha:', error);
            throw error;
        }
    }
}

// Execução principal
async function main() {
    try {
        const campaignManager = new CampaignManager();
        await campaignManager.initialize();
        
        // Executa campanha de reativação para estágios 1, 2 e 3
        await campaignManager.runCampaign('reativacao', [1, 2, 3]);
        
        console.log('🎉 Campanha executada com sucesso!');
        process.exit(0);
        
    } catch (error) {
        console.error('💥 Erro fatal na campanha:', error);
        process.exit(1);
    }
}

// Executa se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { CampaignManager };