const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getMessages, getAllLeads, getLead } = require('./database');
const fs = require('fs');

class RealConversationAnalyzer {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        this.analysisCache = new Map();
    }

    // Análise individual de conversa
    async analyzeConversation(whatsappNumber) {
        try {
            const lead = await getLead(whatsappNumber);
            const messages = await getMessages(whatsappNumber);
            
            if (!messages || messages.length === 0) {
                return { error: 'Nenhuma mensagem encontrada para este lead' };
            }

            const conversationText = messages.map(msg => 
                `${msg.sender}: ${msg.message} (${new Date(msg.timestamp).toLocaleString('pt-BR')})`
            ).join('\n');

            const prompt = `
            Como especialista em vendas e análise conversacional, analise esta conversa REAL:
            
            DADOS DO LEAD:
            - WhatsApp: ${whatsappNumber}
            - Nome: ${lead?.name || 'Não informado'}
            - Estágio: ${lead?.stage || 0}
            - Nível de Interesse: ${lead?.interest_level || 'Não definido'}
            - Última Interação: ${lead?.last_interaction_timestamp}
            
            HISTÓRICO DA CONVERSA:
            ${conversationText}
            
            FORNEÇA UMA ANÁLISE DETALHADA EM FORMATO JSON:
            {
                "resumo_executivo": "Resumo da conversa em 2-3 frases",
                "estagio_atual": "Estágio identificado na jornada de vendas",
                "nivel_interesse": "Alto/Médio/Baixo com justificativa",
                "personalidade_detectada": "Analítico/Impulsivo/Conservador/Prático",
                "objecoes_identificadas": ["lista de objeções mencionadas"],
                "pontos_fortes_conversa": ["o que funcionou bem"],
                "pontos_fracos_conversa": ["o que pode melhorar"],
                "proximos_passos_sugeridos": ["ações específicas recomendadas"],
                "probabilidade_fechamento": "0-100% com justificativa",
                "urgencia_followup": "Alta/Média/Baixa",
                "estrategia_recomendada": "Estratégia específica para este lead",
                "mensagem_sugerida": "Próxima mensagem recomendada",
                "insights_comerciais": ["insights valiosos para vendas"],
                "alertas": ["pontos de atenção ou riscos"]
            }
            `;

            const result = await this.model.generateContent(prompt);
            const analysis = JSON.parse(result.response.text());
            
            // Cache da análise
            this.analysisCache.set(whatsappNumber, {
                ...analysis,
                timestamp: new Date().toISOString(),
                lead_data: lead,
                message_count: messages.length
            });

            return analysis;
        } catch (error) {
            console.error('Erro na análise da conversa:', error);
            return { error: error.message };
        }
    }

    // Análise em lote de todas as conversas
    async analyzeBatchConversations() {
        try {
            const leads = await getAllLeads();
            const analyses = [];
            
            console.log(`🔍 Analisando ${leads.length} conversas...`);
            
            for (const lead of leads) {
                const messages = await getMessages(lead.whatsapp_number);
                if (messages && messages.length > 0) {
                    console.log(`Analisando conversa: ${lead.whatsapp_number}`);
                    const analysis = await this.analyzeConversation(lead.whatsapp_number);
                    if (!analysis.error) {
                        analyses.push({
                            whatsapp: lead.whatsapp_number,
                            lead_name: lead.name,
                            ...analysis
                        });
                    }
                }
                // Delay para não sobrecarregar a API
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return analyses;
        } catch (error) {
            console.error('Erro na análise em lote:', error);
            return [];
        }
    }

    // Relatório consolidado de performance
    async generatePerformanceReport() {
        try {
            const analyses = await this.analyzeBatchConversations();
            
            const prompt = `
            Como especialista em análise de vendas, crie um RELATÓRIO EXECUTIVO baseado nestas análises:
            
            DADOS DAS ANÁLISES:
            ${JSON.stringify(analyses, null, 2)}
            
            GERE UM RELATÓRIO COMPLETO EM JSON:
            {
                "resumo_executivo": "Visão geral da performance de vendas",
                "metricas_principais": {
                    "total_conversas": 0,
                    "taxa_conversao_estimada": "0%",
                    "nivel_interesse_medio": "Alto/Médio/Baixo",
                    "estagio_medio_pipeline": 0,
                    "tempo_medio_resposta": "estimativa"
                },
                "analise_por_estagio": {
                    "prospeccao": { "quantidade": 0, "taxa_avanco": "0%" },
                    "qualificacao": { "quantidade": 0, "taxa_avanco": "0%" },
                    "proposta": { "quantidade": 0, "taxa_fechamento": "0%" }
                },
                "personalidades_detectadas": {
                    "analitico": 0,
                    "impulsivo": 0,
                    "conservador": 0,
                    "pratico": 0
                },
                "objecoes_mais_comuns": ["lista das objeções frequentes"],
                "pontos_fortes_equipe": ["o que está funcionando bem"],
                "areas_melhoria": ["pontos críticos para melhorar"],
                "recomendacoes_estrategicas": ["ações prioritárias"],
                "leads_prioritarios": ["leads com maior potencial"],
                "alertas_criticos": ["situações que precisam atenção imediata"],
                "projecao_resultados": "Projeção de fechamentos para próximo período"
            }
            `;

            const result = await this.model.generateContent(prompt);
            const report = JSON.parse(result.response.text());
            
            // Salva relatório
            const filename = `performance-report-${Date.now()}.json`;
            fs.writeFileSync(filename, JSON.stringify({
                timestamp: new Date().toISOString(),
                report,
                raw_analyses: analyses
            }, null, 2));
            
            console.log(`📊 Relatório de performance salvo: ${filename}`);
            return { report, filename, analyses };
        } catch (error) {
            console.error('Erro no relatório de performance:', error);
            return { error: error.message };
        }
    }

    // Análise de tendências temporais
    async analyzeTrends(days = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const leads = await getAllLeads();
            const recentLeads = leads.filter(lead => 
                new Date(lead.last_interaction_timestamp) > cutoffDate
            );

            const trendData = [];
            for (const lead of recentLeads) {
                const messages = await getMessages(lead.whatsapp_number);
                if (messages && messages.length > 0) {
                    trendData.push({
                        date: lead.last_interaction_timestamp,
                        stage: lead.stage,
                        interest: lead.interest_level,
                        message_count: messages.length
                    });
                }
            }

            const prompt = `
            Analise as TENDÊNCIAS TEMPORAIS dos últimos ${days} dias:
            
            DADOS:
            ${JSON.stringify(trendData, null, 2)}
            
            FORNEÇA ANÁLISE EM JSON:
            {
                "tendencia_geral": "Melhorando/Estável/Piorando",
                "volume_conversas": "Análise do volume",
                "qualidade_leads": "Análise da qualidade",
                "padroes_temporais": ["padrões identificados"],
                "recomendacoes_ajustes": ["ajustes recomendados"],
                "previsao_proximos_dias": "Previsão baseada em tendências"
            }
            `;

            const result = await this.model.generateContent(prompt);
            return JSON.parse(result.response.text());
        } catch (error) {
            console.error('Erro na análise de tendências:', error);
            return { error: error.message };
        }
    }

    // Sugestões personalizadas por lead
    async getPersonalizedSuggestions(whatsappNumber) {
        try {
            const analysis = await this.analyzeConversation(whatsappNumber);
            if (analysis.error) return analysis;

            return {
                next_message: analysis.mensagem_sugerida,
                strategy: analysis.estrategia_recomendada,
                urgency: analysis.urgencia_followup,
                probability: analysis.probabilidade_fechamento,
                alerts: analysis.alertas
            };
        } catch (error) {
            return { error: error.message };
        }
    }
}

module.exports = RealConversationAnalyzer;