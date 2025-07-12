// fix-webhook.js
require('dotenv').config();
const { evolutionApi } = require('./utils');

async function fixWebhook() {
    console.log('🔧 Corrigindo webhook para o IP externo...');
    
    // Usar o IP que estava funcionando antes
    const webhookUrl = `http://34.16.123.182:3001/webhook`;
    
    try {
        // Configuração mínima do webhook
        const webhookConfig = {
            url: webhookUrl,
            events: ['MESSAGES_UPSERT']
        };
        
        console.log(`📡 URL do webhook: ${webhookUrl}`);
        console.log(`📱 Instância: ${process.env.EVOLUTION_INSTANCE_NAME}`);
        
        const response = await evolutionApi.post(
            `/webhook/set/${process.env.EVOLUTION_INSTANCE_NAME}`,
            webhookConfig
        );
        
        console.log('✅ Webhook configurado com sucesso!');
        console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro ao configurar webhook:', error.response?.data || error.message);
        
        // Tentar verificar o webhook atual
        console.log('\n🔍 Verificando webhook atual...');
        try {
            const currentWebhook = await evolutionApi.get(
                `/webhook/find/${process.env.EVOLUTION_INSTANCE_NAME}`
            );
            console.log('📋 Webhook atual:', JSON.stringify(currentWebhook.data, null, 2));
            
            if (currentWebhook.data.url.includes('34.16.123.182')) {
                console.log('\n✅ O webhook já está configurado corretamente!');
                console.log('🎯 Agora vamos testar se o bot está recebendo mensagens...');
            }
            
        } catch (checkError) {
            console.error('❌ Erro ao verificar webhook:', checkError.response?.data || checkError.message);
        }
    }
}

fixWebhook();