class AdvancedAnalyticsSystem {
    constructor() {
        this.metrics = {
            conversions: new Map(),
            stageDropoffs: new Map(),
            responsePatterns: new Map(),
            ocrAccuracy: new Map(),
            customerSegments: new Map()
        };
    }

    // Análise de Performance de Conversão
    analyzeConversionFunnel(leads) {
        const funnel = {
            total: leads.length,
            byStage: {},
            conversionRates: {},
            avgTimePerStage: {},
            dropoffPoints: []
        };

        // Análise por estágio
        for (let stage = 0; stage <= 10; stage++) {
            const stageLeads = leads.filter(lead => lead.stage >= stage);
            funnel.byStage[stage] = stageLeads.length;
            
            if (stage > 0) {
                funnel.conversionRates[stage] = 
                    (funnel.byStage[stage] / funnel.byStage[stage - 1]) * 100;
            }
        }

        // Identificar pontos de abandono críticos
        Object.keys(funnel.conversionRates).forEach(stage => {
            if (funnel.conversionRates[stage] < 70) {
                funnel.dropoffPoints.push({
                    stage: parseInt(stage),
                    conversionRate: funnel.conversionRates[stage],
                    severity: funnel.conversionRates[stage] < 50 ? 'critical' : 'warning'
                });
            }
        });

        return funnel;
    }

    // Análise de Segmentação de Clientes
    analyzeCustomerSegments(leads) {
        const segments = {
            byConsumption: {
                low: leads.filter(l => l.consumo_medio < 300).length,
                medium: leads.filter(l => l.consumo_medio >= 300 && l.consumo_medio < 600).length,
                high: leads.filter(l => l.consumo_medio >= 600).length
            },
            byInterest: {
                baixo: leads.filter(l => l.interest_level === 'baixo').length,
                medio: leads.filter(l => l.interest_level === 'médio').length,
                alto: leads.filter(l => l.interest_level === 'alto').length
            },
            byRegion: {},
            conversionBySegment: {}
        };

        // Análise regional
        leads.forEach(lead => {
            const city = lead.address_cidade || 'Não informado';
            segments.byRegion[city] = (segments.byRegion[city] || 0) + 1;
        });

        // Taxa de conversão por segmento
        const proposalsSent = leads.filter(l => l.proposta_enviada).length;
        segments.conversionBySegment = {
            overall: (proposalsSent / leads.length) * 100,
            byConsumption: {
                low: this.calculateSegmentConversion(leads, l => l.consumo_medio < 300),
                medium: this.calculateSegmentConversion(leads, l => l.consumo_medio >= 300 && l.consumo_medio < 600),
                high: this.calculateSegmentConversion(leads, l => l.consumo_medio >= 600)
            }
        };

        return segments;
    }

    calculateSegmentConversion(leads, filter) {
        const segmentLeads = leads.filter(filter);
        const segmentConversions = segmentLeads.filter(l => l.proposta_enviada).length;
        return segmentLeads.length > 0 ? (segmentConversions / segmentLeads.length) * 100 : 0;
    }

    // Análise de Padrões de Resposta
    analyzeResponsePatterns(messages) {
        const patterns = {
            avgResponseTime: 0,
            messageLength: { avg: 0, distribution: {} },
            sentimentTrends: [],
            engagementScore: 0
        };

        // Análise de tempo de resposta
        const responseTimes = [];
        for (let i = 1; i < messages.length; i++) {
            if (messages[i].sender !== messages[i-1].sender) {
                const timeDiff = new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp);
                responseTimes.push(timeDiff / 1000 / 60); // em minutos
            }
        }
        patterns.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;

        // Análise de comprimento de mensagens
        const userMessages = messages.filter(m => m.sender === 'user');
        const lengths = userMessages.map(m => m.message.length);
        patterns.messageLength.avg = lengths.reduce((a, b) => a + b, 0) / lengths.length || 0;

        // Score de engajamento baseado em frequência e comprimento
        patterns.engagementScore = Math.min(100, 
            (userMessages.length * 10) + (patterns.messageLength.avg / 10)
        );

        return patterns;
    }

    // Recomendações Automáticas
    generateOptimizationRecommendations(analytics) {
        const recommendations = [];

        // Recomendações baseadas no funil
        analytics.funnel.dropoffPoints.forEach(dropoff => {
            if (dropoff.stage === 3) {
                recommendations.push({
                    type: 'conversion',
                    priority: 'high',
                    message: 'Alto abandono no estágio de diagnóstico. Considere simplificar a coleta de dados.',
                    action: 'Implementar coleta progressiva de dados'
                });
            }
            if (dropoff.stage === 8) {
                recommendations.push({
                    type: 'conversion',
                    priority: 'critical',
                    message: 'Abandono crítico na geração de proposta. Verificar API e processo.',
                    action: 'Otimizar processo de geração de proposta'
                });
            }
        });

        // Recomendações baseadas em segmentação
        if (analytics.segments.conversionBySegment.byConsumption.high > 
            analytics.segments.conversionBySegment.byConsumption.low * 2) {
            recommendations.push({
                type: 'targeting',
                priority: 'medium',
                message: 'Clientes de alto consumo convertem melhor. Focar marketing neste segmento.',
                action: 'Ajustar estratégia de aquisição'
            });
        }

        return recommendations;
    }
}

module.exports = { AdvancedAnalyticsSystem };