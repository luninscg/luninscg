#!/bin/bash

echo "🔍 === ANÁLISE AUTOMÁTICA DE CONVERSAS REAIS ==="
echo "Iniciando análise de todas as conversas..."
echo ""

# Executa análise completa com dotenv
node -e "
require('dotenv').config();
const RealConversationAnalyzer = require('./real-conversation-analyzer');
const analyzer = new RealConversationAnalyzer();

(async () => {
    try {
        console.log('📊 Gerando relatório de performance...');
        const report = await analyzer.generatePerformanceReport();
        
        console.log('📈 Analisando tendências...');
        const trends = await analyzer.analyzeTrends(30);
        
        console.log('\\n=== RESUMO EXECUTIVO ===');
        if (report && report.report) {
            console.log(JSON.stringify(report.report, null, 2));
        } else {
            console.log('Relatório não disponível');
        }
        
        console.log('\\n=== TENDÊNCIAS (30 DIAS) ===');
        if (trends && !trends.error) {
            console.log(JSON.stringify(trends, null, 2));
        } else {
            console.log('Tendências não disponíveis');
        }
        
        console.log('\\n✅ Análise concluída!');
        if (report && report.filename) {
            console.log('📁 Relatórios salvos em:', report.filename);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na análise:', error);
        process.exit(1);
    }
})();
"

echo ""
echo "🎯 Para visualizar o dashboard, acesse: http://localhost:3001/conversation-dashboard"
echo "📊 Para análise individual, use: http://localhost:3001/api/analyze-conversation/[WHATSAPP]"
echo "📈 Para tendências, use: http://localhost:3001/api/analyze-trends/[DIAS]"