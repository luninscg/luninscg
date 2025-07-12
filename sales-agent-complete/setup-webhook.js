// setup-webhook.js
require('dotenv').config();
const { evolutionApi } = require('./utils');

async function setupWebhook() {
    console.log('🔗 Configurando webhook na Evolution API...');
    
    const webhookUrl = `http://localhost:${process.env.PORT || 3001}/webhook`;
    
    try {
        // Configurar webhook para a instância
        const webhookConfig = {
            webhook: {
                url: webhookUrl,
                events: [
                    'APPLICATION_STARTUP',
                    'QRCODE_UPDATED',
                    'CONNECTION_UPDATE',
                    'MESSAGES_UPSERT',
                    'MESSAGES_UPDATE',
                    'SEND_MESSAGE'
                ]
            }
        };
        
        console.log(`📡 Configurando webhook para: ${webhookUrl}`);
        console.log(`📱 Instância: ${process.env.EVOLUTION_INSTANCE_NAME}`);
        
        const response = await evolutionApi.post(
            `/webhook/set/${process.env.EVOLUTION_INSTANCE_NAME}`,
            webhookConfig
        );
        
        console.log('✅ Webhook configurado com sucesso!');
        console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
        
        // Verificar se a instância está conectada
        console.log('\n🔍 Verificando status da instância...');
        const statusResponse = await evolutionApi.get(
            `/instance/connect/${process.env.EVOLUTION_INSTANCE_NAME}`
        );
        
        console.log('📊 Status da instância:', JSON.stringify(statusResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro ao configurar webhook:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('\n💡 A instância pode não existir. Tentando criar...');
            await createInstance();
        }
    }
}

async function createInstance() {
    try {
        console.log('🆕 Criando nova instância...');
        
        const instanceConfig = {
            instanceName: process.env.EVOLUTION_INSTANCE_NAME,
            token: process.env.EVOLUTION_API_KEY,
            qrcode: true,
            webhook: {
                url: `http://localhost:${process.env.PORT || 3001}/webhook`,
                events: [
                    'APPLICATION_STARTUP',
                    'QRCODE_UPDATED', 
                    'CONNECTION_UPDATE',
                    'MESSAGES_UPSERT',
                    'MESSAGES_UPDATE',
                    'SEND_MESSAGE'
                ]
            }
        };
        
        const response = await evolutionApi.post('/instance/create', instanceConfig);
        
        console.log('✅ Instância criada com sucesso!');
        console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
        
        if (response.data.qrcode) {
            console.log('\n📱 QR Code para conectar o WhatsApp:');
            console.log(response.data.qrcode.code);
            console.log('\n👆 Escaneie este QR Code com seu WhatsApp para conectar!');
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar instância:', error.response?.data || error.message);
    }
}

async function getQRCode() {
    try {
        console.log('📱 Obtendo QR Code...');
        
        const response = await evolutionApi.get(
            `/instance/connect/${process.env.EVOLUTION_INSTANCE_NAME}`
        );
        
        if (response.data.qrcode) {
            console.log('\n📱 QR Code para conectar o WhatsApp:');
            console.log(response.data.qrcode.code);
            console.log('\n👆 Escaneie este QR Code com seu WhatsApp para conectar!');
        } else {
            console.log('✅ Instância já está conectada!');
        }
        
    } catch (error) {
        console.error('❌ Erro ao obter QR Code:', error.response?.data || error.message);
    }
}

// Executar baseado no argumento
const action = process.argv[2];

switch (action) {
    case 'qr':
        getQRCode();
        break;
    case 'create':
        createInstance();
        break;
    default:
        setupWebhook();
}

module.exports = { setupWebhook, createInstance, getQRCode };