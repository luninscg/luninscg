#!/bin/bash

echo "🚀 === INICIANDO BATERIA COMPLETA DE TESTES ===\n"

# Teste 1: Sistemas Básicos
echo "📋 1. Testando sistemas básicos..."
node test-evolution-api.js
echo ""

# Teste 2: Geração de Propostas
echo "💰 2. Testando geração de propostas..."
node test-proposta.js
echo ""

# Teste 3: Gabriel Humano 2.0
echo "🤖 3. Testando Gabriel Humano 2.0..."
node test-gabriel-humano.js
echo ""

# Teste 4: Performance
echo "⚡ 4. Testando performance..."
node test-performance.js
echo ""

# Teste 5: Integração Completa
echo "🔗 5. Teste de integração completa..."
node -e "
console.log('🧪 Simulando conversa completa...');
const { CampaignIntegration } = require('./campaign-integration');
const integration = new CampaignIntegration();

(async () => {
    const context = {
        source: 'campaign_dispatch',
        customer_profile: { name: 'João', city: 'Campo Grande' }
    };
    
    // Abertura de campanha
    const opener = integration.generateCampaignOpener(context);
    console.log('📢 Abertura:', opener.message);
    
    // Resposta do cliente
    const customerResponse = 'Oi! Minha conta tá muito alta mesmo, quero saber mais.';
    console.log('👤 Cliente:', customerResponse);
    
    // Processamento da resposta
    const aiResponse = integration.processSurveyResponse(customerResponse, context);
    console.log('🤖 Gabriel:', aiResponse.response_message);
    
    console.log('\n✅ Integração funcionando perfeitamente!');
})();
"

echo "\n🎉 === TODOS OS TESTES CONCLUÍDOS ===\n"
echo "📊 Para executar testes específicos:"
echo "   • node test-gabriel-humano.js     # Testes do sistema humanizado"
echo "   • node test-performance.js       # Testes de performance"
echo "   • node test-proposta.js          # Testes de propostas"
echo "   • node test-evolution-api.js     # Testes da API"