#!/bin/bash

echo "🤖 === SIMULAÇÃO MASSIVA COM ANÁLISE IA ===\n"

# Executa simulação com análise
node -e "
const { MassiveSimulator } = require('./massive-simulator');
const { AIConversationAnalyzer } = require('./ai-conversation-analyzer');

async function runWithAnalysis() {
    const simulator = new MassiveSimulator();
    
    const config = {
        personality: 5000,
        campaigns: 2500,
        antiRobotic: 10000,
        messaging: 7500,
        autoImplement: true  // Implementa melhorias automáticas
    };
    
    const results = await simulator.runFullSimulationWithAnalysis(config);
    
    console.log('\n🎉 Simulação e análise concluídas!');
    console.log('📊 Relatório salvo:', results.reportFile);
    console.log('🌐 Acesse: http://localhost:3000/ai-analysis');
}

runWithAnalysis().catch(console.error);
"

echo "✅ Análise IA concluída!"
echo "🌐 Acesse o dashboard: http://localhost:3000/ai-analysis"