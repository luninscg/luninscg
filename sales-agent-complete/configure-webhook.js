// configure-webhook.js
require('dotenv').config();
const { evolutionApi } = require('./utils');

async function configureWebhook() {
    console.log('🔗 Configurando webhook na Evolution API externa...');
    
    // Para servidor local, você precisará usar ngrok ou similar para expor publicamente
    // Por enquanto, vou mostrar como configurar para localhost (não funcionará externamente)
    const webhookUrl = `http://localhost:${process.env.PORT || 3001}/webhook`;
    
    console.log('⚠️  ATENÇÃO: Para funcionar com Evolution API externa, você precisa:');
    console.log('1. Usar ngrok ou similar para expor seu servidor local');
    console.log('2. Ou hospedar seu bot em um servidor público');
    console.log('');
    
    try {
        // Configuração do webhook usando o endpoint correto da documentação
        const webhookConfig = {
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: [
                'MESSAGES_UPSERT',  // Mensagens recebidas
                'SEND_MESSAGE',     // Mensagens enviadas
                'CONNECTION_UPDATE' // Status da conexão
            ]
        };
        
        console.log(`📡 URL do webhook: ${webhookUrl}`);
        console.log(`📱 Instância: ${process.env.EVOLUTION_INSTANCE_NAME}`);
        console.log('📋 Eventos configurados:', webhookConfig.events);
        
        // Usar o endpoint correto da documentação
        const response = await evolutionApi.post(
            `/webhook/set/${process.env.EVOLUTION_INSTANCE_NAME}`,
            webhookConfig
        );
        
        console.log('✅ Webhook configurado com sucesso!');
        console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro ao configurar webhook:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('\n💡 Possíveis soluções:');
            console.log('1. Verifique se a instância "Gabriel" existe na Evolution API');
            console.log('2. Confirme se a URL da Evolution API está correta');
            console.log('3. Verifique se a API Key está válida');
        }
    }
}

async function checkWebhook() {
    try {
        console.log('🔍 Verificando webhook atual...');
        
        const response = await evolutionApi.get(
            `/webhook/find/${process.env.EVOLUTION_INSTANCE_NAME}`
        );
        
        console.log('📋 Webhook atual:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro ao verificar webhook:', error.response?.data || error.message);
    }
}

// Executar baseado no argumento
const action = process.argv[2];

switch (action) {
    case 'check':
        checkWebhook();
        break;
    default:
        configureWebhook();
}

module.exports = { configureWebhook, checkWebhook };