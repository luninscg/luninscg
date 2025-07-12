// test-webhook.js
require('dotenv').config();
const axios = require('axios');

async function testWebhook() {
    console.log('🧪 Testando webhook do bot...');
    
    // Simular uma mensagem do WhatsApp via Evolution API
    const testMessage = {
        event: 'messages.upsert',
        instance: process.env.EVOLUTION_INSTANCE_NAME,
        data: {
            key: {
                remoteJid: '5511999999999@s.whatsapp.net',
                fromMe: false,
                id: 'test_message_' + Date.now()
            },
            message: {
                conversation: 'Olá! Este é um teste do webhook.'
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Teste Usuario'
        }
    };
    
    try {
        console.log('📤 Enviando mensagem de teste para o webhook...');
        console.log('🎯 URL:', 'http://localhost:3001/webhook');
        
        const response = await axios.post('http://localhost:3001/webhook', testMessage, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ Webhook respondeu com sucesso!');
        console.log('📋 Status:', response.status);
        console.log('📄 Resposta:', response.data || 'Sem dados na resposta');
        
        console.log('\n🎉 O bot está funcionando corretamente!');
        console.log('📱 Agora você pode enviar mensagens pelo WhatsApp e o bot deve responder.');
        
    } catch (error) {
        console.error('❌ Erro ao testar webhook:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('🔧 O servidor não está acessível. Verifique se está rodando na porta 3001.');
        } else if (error.response) {
            console.log('📋 Status do erro:', error.response.status);
            console.log('📄 Dados do erro:', error.response.data);
        }
    }
}

testWebhook();