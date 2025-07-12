require('dotenv').config();
const { getAllLeads } = require('./database');
const { sendWhatsAppMessage } = require('./utils');

class ReportManager {
    constructor() {
        this.adminNumbers = process.env.ADMIN_WHATSAPP_NUMBERS?.split(',') || [];
    }

    async generateDailyReport() {
        try {
            console.log('📊 Gerando relatório diário...');
            
            const leads = await getAllLeads();
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            // Leads criados nas últimas 24h
            const newLeads = leads.filter(lead => {
                const createdAt = new Date(lead.created_at || lead.last_interaction_timestamp);
                return createdAt >= yesterday;
            });
            
            // Leads que interagiram nas últimas 24h
            const activeLeads = leads.filter(lead => {
                const lastInteraction = new Date(lead.last_interaction_timestamp);
                return lastInteraction >= yesterday;
            });
            
            // Estatísticas por estágio
            const stageStats = {};
            leads.forEach(lead => {
                const stage = `Estágio ${lead.stage}`;
                stageStats[stage] = (stageStats[stage] || 0) + 1;
            });
            
            // Estatísticas por interesse
            const interestStats = {};
            leads.forEach(lead => {
                const interest = lead.interest_level || 'Não definido';
                interestStats[interest] = (interestStats[interest] || 0) + 1;
            });
            
            // Leads qualificados (estágio 4+)
            const qualifiedLeads = leads.filter(lead => lead.stage >= 4);
            
            // Taxa de conversão
            const conversionRate = leads.length > 0 ? 
                ((qualifiedLeads.length / leads.length) * 100).toFixed(1) : 0;
            
            // Monta o relatório
            const report = `🌟 *RELATÓRIO DIÁRIO CRM*\n${now.toLocaleDateString('pt-BR')}\n\n` +
                `📈 *RESUMO GERAL*\n` +
                `• Total de Leads: ${leads.length}\n` +
                `• Novos Leads (24h): ${newLeads.length}\n` +
                `• Leads Ativos (24h): ${activeLeads.length}\n` +
                `• Taxa de Conversão: ${conversionRate}%\n\n` +
                
                `🎯 *POR ESTÁGIO*\n` +
                Object.entries(stageStats)
                    .map(([stage, count]) => `• ${stage}: ${count}`)
                    .join('\n') + '\n\n' +
                
                `💡 *POR INTERESSE*\n` +
                Object.entries(interestStats)
                    .map(([interest, count]) => `• ${interest}: ${count}`)
                    .join('\n') + '\n\n' +
                
                `🏆 *LEADS QUALIFICADOS*\n` +
                `• Total: ${qualifiedLeads.length}\n`;
            
            // Adiciona top 5 leads mais promissores
            const topLeads = leads
                .filter(lead => lead.interest_level === 'Alto' && lead.stage >= 2)
                .slice(0, 5);
                
            if (topLeads.length > 0) {
                const topLeadsText = topLeads
                    .map((lead, index) => 
                        `${index + 1}. ${lead.name || 'N/A'} - Estágio ${lead.stage}`
                    )
                    .join('\n');
                    
                report += `\n🔥 *TOP 5 LEADS PROMISSORES*\n${topLeadsText}`;
            }
            
            return report;
            
        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            return `❌ Erro ao gerar relatório diário: ${error.message}`;
        }
    }

    async sendDailyReport() {
        try {
            console.log('📤 Enviando relatório diário...');
            
            const report = await this.generateDailyReport();
            
            if (this.adminNumbers.length === 0) {
                console.log('⚠️ Nenhum número de admin configurado');
                console.log('Relatório gerado:');
                console.log(report);
                return;
            }
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const adminNumber of this.adminNumbers) {
                try {
                    await sendWhatsAppMessage(adminNumber.trim(), report);
                    successCount++;
                    console.log(`✅ Relatório enviado para ${adminNumber}`);
                    
                    // Delay entre envios
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                } catch (error) {
                    console.error(`❌ Erro ao enviar para ${adminNumber}:`, error);
                    errorCount++;
                }
            }
            
            console.log(`📊 Relatório enviado:`);
            console.log(`   ✅ Sucessos: ${successCount}`);
            console.log(`   ❌ Erros: ${errorCount}`);
            
            return {
                success: successCount,
                errors: errorCount,
                total: this.adminNumbers.length
            };
            
        } catch (error) {
            console.error('❌ Erro ao enviar relatório:', error);
            throw error;
        }
    }

    async generateWeeklyReport() {
        try {
            console.log('📊 Gerando relatório semanal...');
            
            const leads = await getAllLeads();
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            // Leads da última semana
            const weekLeads = leads.filter(lead => {
                const lastInteraction = new Date(lead.last_interaction_timestamp);
                return lastInteraction >= weekAgo;
            });
            
            // Progressão de estágios na semana
            const stageProgression = {};
            weekLeads.forEach(lead => {
                const stage = lead.stage;
                stageProgression[stage] = (stageProgression[stage] || 0) + 1;
            });
            
            const report = `📅 *RELATÓRIO SEMANAL*\n${now.toLocaleDateString('pt-BR')}\n\n` +
                `📈 *RESUMO DA SEMANA*\n` +
                `• Total de Leads: ${leads.length}\n` +
                `• Leads Ativos (7 dias): ${weekLeads.length}\n\n` +
                
                `🎯 *DISTRIBUIÇÃO POR ESTÁGIO*\n` +
                Object.entries(stageProgression)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([stage, count]) => `• Estágio ${stage}: ${count}`)
                    .join('\n');
            
            return report;
            
        } catch (error) {
            console.error('❌ Erro ao gerar relatório semanal:', error);
            return `❌ Erro ao gerar relatório semanal: ${error.message}`;
        }
    }
}

// Execução principal
async function main() {
    try {
        const reportManager = new ReportManager();
        
        // Verifica argumentos da linha de comando
        const args = process.argv.slice(2);
        const reportType = args[0] || 'daily';
        
        if (reportType === 'weekly') {
            const report = await reportManager.generateWeeklyReport();
            console.log('📊 Relatório semanal gerado:');
            console.log(report);
        } else {
            await reportManager.sendDailyReport();
        }
        
        console.log('🎉 Relatório executado com sucesso!');
        process.exit(0);
        
    } catch (error) {
        console.error('💥 Erro fatal no relatório:', error);
        process.exit(1);
    }
}

// Executa se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { ReportManager };