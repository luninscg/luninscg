// utils.js
const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;

const evolutionApi = axios.create({
    baseURL: EVOLUTION_API_URL,
    headers: { 'apikey': EVOLUTION_API_KEY }
});

async function sendWhatsAppMessage(to, text) {
    if (!to || typeof text !== 'string' || text.trim() === "") {
        console.error(`Tentativa de enviar mensagem inválida ou vazia. Para: ${to}.`);
        return false;
    }
    
    try {
        await evolutionApi.post(`/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
            number: to,
            options: { delay: 1200, presence: "composing" },
            textMessage: { text: text }
        });
        return true;
    } catch (error) {
        console.error(`Erro ao enviar mensagem para ${to}:`, error.response ? JSON.stringify(error.response.data) : error.message);
        return false;
    }
}

module.exports = { sendWhatsAppMessage, evolutionApi };