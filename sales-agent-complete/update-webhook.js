// update-webhook.js
require('dotenv').config();
const { evolutionApi } = require('./utils');
const { execSync } = require('child_process');

async function updateWebhook() {
    console.log('🔄 Atualizando webhook para o servidor atual...');
    
    // Obter o IP atual do servidor
    const currentIP = execSync("hostname -I | awk '{print $1}'").toString().trim();
    const webhookUrl = `http://${currentIP}:${process.env.PORT || 3001}/webhook`;
    
    try {
        // Configuração do webhook com o IP correto
        const webhookConfig = {
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: true,
            events: [
                'MESSAGES_UPSERT',  // Mensagens recebidas (principal)
                'SEND_MESSAGE',     // Mensagens enviadas
                'CONNECTION_UPDATE' // Status da conexão
            ]
        };
        
        console.log(`📡 Novo URL do webhook: ${webhookUrl}`);
        console.log(`📱 Instância: ${process.env.EVOLUTION_INSTANCE_NAME}`);
        console.log('📋 Eventos configurados:', webhookConfig.events);
        
        const response = await evolutionApi.post(
            `/webhook/set/${process.env.EVOLUTION_INSTANCE_NAME}`,
            webhookConfig
        );
        
        console.log('✅ Webhook atualizado com sucesso!');
        console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
        
        // Verificar se o servidor está rodando
        console.log('\n🔍 Verificando se o servidor está acessível...');
        console.log(`🌐 Servidor rodando em: http://${currentIP}:${process.env.PORT || 3001}`);
        console.log('📱 Agora a Evolution API deve conseguir enviar mensagens para o bot!');
        
    } catch (error) {
        console.error('❌ Erro ao atualizar webhook:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('\n💡 Possíveis soluções:');
            console.log('1. Verifique se a instância "Gabriel" existe na Evolution API');
            console.log('2. Confirme se a URL da Evolution API está correta');
            console.log('3. Verifique se a API Key está válida');
        }
    }
}

updateWebhook();