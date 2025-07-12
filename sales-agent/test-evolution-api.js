// test-evolution-api.js
require('dotenv').config();
const { evolutionApi, checkInstanceStatus, sendWhatsAppMessage } = require('./utils');

async function testEvolutionApi() {
    console.log('Iniciando teste da Evolution API...');
    console.log('Verificando variáveis de ambiente:');
    console.log(`EVOLUTION_API_URL: ${process.env.EVOLUTION_API_URL}`);
    console.log(`EVOLUTION_INSTANCE_NAME: ${process.env.EVOLUTION_INSTANCE_NAME}`);
    console.log(`EVOLUTION_API_KEY: ${process.env.EVOLUTION_API_KEY ? '***' + process.env.EVOLUTION_API_KEY.slice(-5) : 'Não definida'}`);
    
    try {
        // Verificar status da instância
        console.log('\nVerificando status da instância...');
        const status = await checkInstanceStatus();
        console.log('Status da instância:', status);
        
        // Enviar mensagem de teste
        if (process.env.ADMIN_WHATSAPP_NUMBER_1) {
            console.log('\nEnviando mensagem de teste para o administrador...');
            const result = await sendWhatsAppMessage(
                process.env.ADMIN_WHATSAPP_NUMBER_1, 
                'Mensagem de teste do sistema - ' + new Date().toLocaleString()
            );
            console.log('Resultado do envio:', result ? 'Sucesso' : 'Falha');
        } else {
            console.log('\nNúmero do administrador não configurado. Pulando teste de envio.');
        }
    } catch (error) {
        console.error('Erro durante o teste:', error);
    }
}

testEvolutionApi();