// utils.js
require('dotenv').config();
const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;

const evolutionApi = axios.create({
    baseURL: EVOLUTION_API_URL,
    headers: { 'apikey': EVOLUTION_API_KEY }
});

// FUNÇÃO AUSENTE - ADICIONANDO
async function checkInstanceStatus() {
    try {
        const response = await evolutionApi.get(`/instance/fetchInstances`);
        const instances = response.data;
        
        // Procura pela instância específica
        const instance = instances.find(inst => inst.instance.instanceName === EVOLUTION_INSTANCE_NAME);
        
        if (instance) {
            return {
                status: instance.instance.status,
                instanceName: instance.instance.instanceName,
                connected: instance.instance.status === 'open'
            };
        } else {
            return {
                status: 'not_found',
                instanceName: EVOLUTION_INSTANCE_NAME,
                connected: false
            };
        }
    } catch (error) {
        console.error('Erro ao verificar status da instância:', error.message);
        return {
            status: 'error',
            instanceName: EVOLUTION_INSTANCE_NAME,
            connected: false,
            error: error.message
        };
    }
}

async function sendWhatsAppMessage(to, text) {
    if (!to || typeof text !== 'string' || text.trim() === "") {
        console.error(`Tentativa de enviar mensagem inválida ou vazia. Para: ${to}.`);
        return false;
    }
    
    try {
        await evolutionApi.post(`/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
            number: to,
            text: text
        });
        return true;
    } catch (error) {
        console.error(`Erro ao enviar mensagem para ${to}:`, error.response ? JSON.stringify(error.response.data) : error.message);
        return false;
    }
}

module.exports = { sendWhatsAppMessage, evolutionApi, checkInstanceStatus };