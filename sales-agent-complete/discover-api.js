// discover-api.js
require('dotenv').config();
const { evolutionApi } = require('./utils');

async function discoverAPI() {
    console.log('🔍 Descobrindo endpoints da Evolution API...');
    
    const endpoints = [
        '/instance/fetchInstances',
        `/instance/connectionState/${process.env.EVOLUTION_INSTANCE_NAME}`,
        `/instance/status/${process.env.EVOLUTION_INSTANCE_NAME}`,
        '/webhook',
        '/settings',
        '/manager/fetchInstances'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`\n📡 Testando: ${endpoint}`);
            const response = await evolutionApi.get(endpoint);
            console.log(`✅ Sucesso:`, JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log(`❌ Erro ${error.response?.status}: ${error.response?.statusText || error.message}`);
        }
    }
    
    // Tentar descobrir configurações de webhook
    console.log('\n🔧 Tentando descobrir configurações de webhook...');
    
    const webhookEndpoints = [
        `/webhook/${process.env.EVOLUTION_INSTANCE_NAME}`,
        `/instance/webhook/${process.env.EVOLUTION_INSTANCE_NAME}`,
        `/settings/webhook/${process.env.EVOLUTION_INSTANCE_NAME}`,
        '/webhook/set',
        '/webhook/find'
    ];
    
    for (const endpoint of webhookEndpoints) {
        try {
            console.log(`\n📡 Testando webhook: ${endpoint}`);
            const response = await evolutionApi.get(endpoint);
            console.log(`✅ Sucesso:`, JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log(`❌ Erro ${error.response?.status}: ${error.response?.statusText || error.message}`);
        }
    }
}

discoverAPI();