// index.js (v36.2 - com Leitura Dinâmica do Prompt e Rastreio de Campanha)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// --- MECANISMO DE TRAVA PARA EVITAR PROCESSAMENTO DUPLICADO ---
const processingUsers = new Set();

// --- Validação de Variáveis de Ambiente ---
const requiredEnvVars = [ 'EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE_NAME', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GEMINI_API_KEY', 'ADMIN_WHATSAPP_NUMBER_1' ];
for (const varName of requiredEnvVars) { if (!process.env[varName]) { console.error(`ERRO CRÍTICO: A variável de ambiente ${varName} não está definida.`); process.exit(1); } }

// --- INICIALIZAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES E CONSTANTES ---
const PORT = process.env.PORT || 8080; // Use 8080 para o Cloud Run
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_WHATSAPP_NUMBER_1 = process.env.ADMIN_WHATSAPP_NUMBER_1;
const ADMIN_WHATSAPP_NUMBER_2 = process.env.ADMIN_WHATSAPP_NUMBER_2;
const INTENTION_TO_CLOSE_STAGE = 5;
const FINAL_STAGE_GATE = 8;

// NOVO: Cache para o System Prompt
let systemPromptCache = null;
let promptCacheTimestamp = null;
const PROMPT_CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// Cliente Axios pré-configurado para a Evolution API
const evolutionApi = axios.create({
    baseURL: EVOLUTION_API_URL,
    headers: { 'apikey': EVOLUTION_API_KEY }
});

// --- INICIALIZAÇÃO DAS APIS ---
console.log("Inicializando clientes de API...");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
const geminiFlashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
const geminiProModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro", safetySettings });
const serviceAccountAuth = new JWT({ email: GOOGLE_SERVICE_ACCOUNT_EMAIL, key: GOOGLE_PRIVATE_KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'], });
const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
console.log("Clientes de API inicializados com sucesso.");

// --- FUNÇÕES AUXILIARES ---

async function sendWhatsAppMessage(to, text) {
    if (!to || typeof text !== 'string' || text.trim() === "") {
        console.error(`Tentativa de enviar mensagem inválida ou vazia. Para: ${to}.`);
        return;
    }
    const humanDelayMs = Math.max(500, Math.min((text.length / 25) * 1000, 2500));
    console.log(`Aguardando ${humanDelayMs.toFixed(0)}ms antes de enviar para ${to}: "${text.substring(0, 50)}..."`);
    await new Promise(resolve => setTimeout(resolve, humanDelayMs));
    try {
        await evolutionApi.post(`/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
            number: to,
            options: { delay: 1200, presence: "composing" },
            textMessage: { text: text }
        });
    } catch (error) {
        console.error(`Erro ao enviar mensagem para ${to}:`, error.response ? JSON.stringify(error.response.data) : error.message);
    }
}

// NOVO: Função para buscar o prompt mais recente da planilha com cache
async function getLatestSystemPrompt() {
    const now = new Date();
    if (systemPromptCache && promptCacheTimestamp && (now - promptCacheTimestamp < PROMPT_CACHE_DURATION_MS)) {
        console.log("Usando prompt do cache.");
        return systemPromptCache;
    }
    try {
        console.log("Buscando novo prompt da planilha...");
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['prompt_atual'];
        await sheet.loadCells('B2');
        const promptValue = sheet.getCellByA1('B2').value;
        if (!promptValue || promptValue.trim() === '') throw new Error("Célula B2 do prompt está vazia.");
        systemPromptCache = promptValue;
        promptCacheTimestamp = now;
        console.log("Novo prompt carregado e cache atualizado.");
        return systemPromptCache;
    } catch (error) {
        console.error("ERRO CRÍTICO AO BUSCAR PROMPT. Usando o último cache válido ou um fallback.", error);
        return systemPromptCache || "Você é um assistente prestativo. Responda em JSON.";
    }
}

async function sendAdminNotification(type, data) {
    let message_to_gestor1 = null;
    let message_to_gestor2 = null;
    switch (type) {
        case 'NEW_LEAD': message_to_gestor1 = `👋 Novo Lead!\n*Contato:* ${data.from}`; break;
        case 'HIGH_INTEREST': message_to_gestor1 = message_to_gestor2 = `🔥 Interesse Alto Detectado!\n\n*Nome:* ${data.name || 'N/A'}\n*Contato:* ${data.from}\n*Nível:* *${data.interest}*`; break;
        case 'QUALIFIED_LEAD': message_to_gestor1 = message_to_gestor2 = `🏆✨ LEAD QUENTE (INTENÇÃO DE FECHAR)! ✨🏆\n\n*Cliente:* ${data.name}\n*Contato:* ${data.from}\n\n*Resumo da IA:*\n_${data.summary || 'Cliente aceitou a proposta.'}_\n\n*Nível de Interesse:* *${data.interest || 'Alto'}*`; break;
        case 'HUMAN_INTERVENTION': message_to_gestor1 = message_to_gestor2 = `🆘 AJUDA SOLICITADA!\n\n*Contato:* ${data.from}\n*Motivo:* Cliente pediu para falar com um humano.`; break;
        case 'SYSTEM_ERROR': message_to_gestor1 = `🆘 ERRO GRAVE NO BOT 🆘\n\nFalha em msg de ${data.from}.\n\n*Erro:* ${data.errorMessage}`; break;
    }
    if (message_to_gestor1 && ADMIN_WHATSAPP_NUMBER_1) await sendWhatsAppMessage(ADMIN_WHATSAPP_NUMBER_1, message_to_gestor1);
    if (message_to_gestor2 && ADMIN_WHATSAPP_NUMBER_2 && ADMIN_WHATSAPP_NUMBER_2 !== ADMIN_WHATSAPP_NUMBER_1) await sendWhatsAppMessage(ADMIN_WHATSAPP_NUMBER_2, message_to_gestor2);
}

// MUDANÇA: A função agora recebe o systemPrompt como parâmetro
async function getAiResponse(history, userInput, currentStage, knownData, systemPrompt, dossierContent = null, proposalData = null) {
    try {
        const chat = geminiFlashModel.startChat({ systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }, history });
        const proposalInstruction = proposalData ? `DADOS DA PROPOSTA CALCULADA: ${JSON.stringify(proposalData)}.` : '';
        const dossierInstruction = dossierContent ? `INFORMAÇÃO DO DOSSIÊ: "${dossierContent}".` : '';
        const promptForModel = `INSTRUÇÃO INTERNA: Estágio: ${currentStage}. Dados conhecidos: ${JSON.stringify(knownData)}. Input do cliente: "${userInput}". ${proposalInstruction} ${dossierInstruction} Responda em JSON.`;
        const result = await chat.sendMessage(promptForModel);
        const responseText = result.response.text();
        console.log("Resposta bruta do Gemini:", responseText);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Nenhum JSON válido na resposta da IA.");
    } catch (e) {
        console.error("ERRO CRÍTICO EM getAiResponse:", e);
        return { response_messages: ["Desculpe, tive uma instabilidade. Um de nossos especialistas já foi notificado e entrará em contato."], next_stage: currentStage };
    }
}

async function processMedia(messageObject) {
    try {
        const mediaResponse = await evolutionApi.post(`/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE_NAME}`, { message: messageObject });
        const { base64: base64Data, mimetype: mimeType } = mediaResponse.data;
        if (!base64Data || !mimeType) throw new Error("Dados da mídia em base64 não obtidos.");
        const filePart = { inlineData: { data: base64Data, mimeType } };
        let prompt = mimeType.startsWith('audio/')
            ? "Transcreva este áudio na íntegra. Retorne apenas o texto."
            : "Você é um OCR especialista em faturas de energia. Extraia os dados em um objeto JSON com as chaves: 'nomeTitular', 'documentoTitular', 'enderecoCompleto', 'consumoKwh', 'valorTotal', 'valorCip', 'tarifaEnergiaKwh', 'bandeiraTarifaria', e 'tipoConexao' ('MONOFASICO', 'BIFASICO' ou 'TRIFASICO'). Se não for uma fatura, retorne `{\"error\": \"Arquivo não é uma fatura de energia.\"}`.";
        const result = await geminiProModel.generateContent([prompt, filePart]);
        const cleanedText = result.response.text().replace(/```json|```/g, '').trim();
        return mimeType.startsWith('audio/')
            ? { type: 'audio_transcription', data: { transcription: cleanedText } }
            : { type: 'media_analysis', data: JSON.parse(cleanedText || '{}') };
    } catch (error) {
        console.error("Erro em processMedia:", error.response?.data || error);
        return { type: 'media_analysis', data: { error: "Falha ao processar o arquivo de mídia." } };
    }
}

async function searchDossier(text) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['Dossie'];
        if (!sheet) return null;
        const rows = await sheet.getRows();
        for (const row of rows) {
            const keywords = (row.get('PalavrasChave') || '').split(',').map(k => k.trim().toLowerCase());
            if (keywords.some(keyword => keyword && text.toLowerCase().includes(keyword))) {
                return row.get('RespostaOficial');
            }
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar no dossiê:", error);
        return null;
    }
}

function calculateProposal(faturaData) {
    const { valorTotal, valorCip, tipoConexao, tarifaEnergiaKwh } = faturaData;
    const custoDisponibilidadeKwh = { 'MONOFASICO': 30, 'BIFASICO': 50, 'TRIFASICO': 100 };
    const taxaMinimaKwh = custoDisponibilidadeKwh[tipoConexao?.toUpperCase()] || 50;
    const taxaMinimaValor = taxaMinimaKwh * (parseFloat(tarifaEnergiaKwh) || 0.8);
    const baseDeCalculo = parseFloat(valorTotal || 0) - parseFloat(valorCip || 0) - taxaMinimaValor;
    if (baseDeCalculo <= 0) return null;
    const economiaMensal = baseDeCalculo * 0.20;
    return {
        economiaMensal: economiaMensal.toFixed(2).replace('.', ','),
        economiaAnual: (economiaMensal * 12).toFixed(2).replace('.', ','),
        economia5Anos: (economiaMensal * 60).toFixed(2).replace('.', ','),
    };
}

async function processIncomingMessage(message) {
    const from = message.from;
    let textInput = null, dossierContent = null, proposalData = null, extractedDataForSheet = null;

    if (message.type === 'text') {
        textInput = message.text.body.trim();
        dossierContent = await searchDossier(textInput);
    } else if (message.type === 'audio' || message.type === 'image' || message.type === 'document') {
        const mediaResult = await processMedia(message.originalMessage);
        if (message.type === 'audio') {
            textInput = mediaResult.data?.transcription || "Falha ao transcrever o áudio.";
        } else {
            extractedDataForSheet = mediaResult.data;
            textInput = mediaResult.data?.error ? `Análise da Fatura Falhou: ${mediaResult.data.error}` : "Análise da Fatura Concluída.";
        }
    }

    if (!textInput) return console.log(`[${from}] Mensagem ignorada.`);

    const systemPrompt = await getLatestSystemPrompt(); // NOVO: Busca o prompt dinâmico

    await doc.loadInfo();
    const crmSheet = doc.sheetsByTitle['CRM'];
    if (!crmSheet) return console.error("ERRO CRÍTICO: Aba 'CRM' não encontrada.");
    const crmRows = await crmSheet.getRows();
    let userRow = crmRows.find(r => r.get('whatsapp_number') === from);
    const currentUserStage = userRow ? parseInt(userRow.get('stage'), 10) || 0 : 0;
    
    // NOVO: Lógica de Rastreio de Campanha
    const leadSource = userRow ? userRow.get('source') : 'Organico';
    console.log(`[${from}] Fonte do lead identificada: *${leadSource}*`);
    if (leadSource.startsWith('Campanha_')) {
        const campaignSheet = doc.sheetsByTitle['Campanha_Disparos'];
        if (campaignSheet) {
            const campaignRows = await campaignSheet.getRows();
            const campaignUserRow = campaignRows.find(r => r.get('Numero') === from);
            if (campaignUserRow && !campaignUserRow.get('Observacoes')) {
                campaignUserRow.set('Observacoes', 'Respondeu');
                await campaignUserRow.save();
                console.log(`[${from}] Resposta de campanha registrada.`);
            }
        }
    }

    if (currentUserStage >= FINAL_STAGE_GATE) return console.log(`[${from}] Usuário no estágio final.`);

    if (currentUserStage === 3) {
        if (extractedDataForSheet && !extractedDataForSheet.error) {
            proposalData = calculateProposal(extractedDataForSheet);
        } else if (!isNaN(parseFloat(textInput))) {
            const billValue = parseFloat(textInput);
            const monthlySavings = (billValue - 50) * 0.20;
            if (monthlySavings > 0) proposalData = { economiaMensal: monthlySavings.toFixed(2), economiaAnual: (monthlySavings * 12).toFixed(2), economia5Anos: (monthlySavings * 60).toFixed(2) };
        }
        if (proposalData) textInput += ` Proposta calculada.`;
    }

    const history = userRow ? JSON.parse(userRow.get('conversation_history') || '[]') : [];
    const knownData = userRow ? { name: userRow.get('name'), cpf: userRow.get('cpf'), email: userRow.get('email') } : {};
    
    console.log(`[${from}] Estágio: ${currentUserStage}. Processando input para IA: "${textInput}"`);
    const aiResponse = await getAiResponse(history, textInput, currentUserStage, knownData, systemPrompt, dossierContent, proposalData);

    if (aiResponse.response_messages?.length) {
        for (const msg of aiResponse.response_messages) { await sendWhatsAppMessage(from, msg); }
        const updatedHistory = [...history, { role: "user", parts: [{ text: textInput }] }, { role: "model", parts: [{ text: JSON.stringify(aiResponse) }] }];
        const dataToUpdate = {
            stage: aiResponse.next_stage, conversation_history: JSON.stringify(updatedHistory), last_interaction_timestamp: new Date().toISOString(),
            ...Object.fromEntries(Object.entries(aiResponse).filter(([k, v]) => v && ['name', 'cpf', 'email', 'address', 'summary', 'interest_level'].includes(k)))
        };
        if (extractedDataForSheet && !extractedDataForSheet.error) {
            Object.assign(dataToUpdate, { fatura_nome_titular: extractedDataForSheet.nomeTitular, fatura_cpf_cnpj_titular: extractedDataForSheet.documentoTitular, /* ...outros campos da fatura... */ });
        }

        if (!userRow) {
            userRow = await crmSheet.addRow({ whatsapp_number: from, protocol: new Date().getTime(), source: 'Organico', ...dataToUpdate });
            await sendAdminNotification('NEW_LEAD', { from });
        } else {
            const previousInterest = userRow.get('interest_level');
            userRow.assign(dataToUpdate);
            await userRow.save();
            const { next_stage: newStage, interest_level: newInterest } = aiResponse;
            if (newStage >= INTENTION_TO_CLOSE_STAGE && currentUserStage < INTENTION_TO_CLOSE_STAGE) {
                await sendAdminNotification('QUALIFIED_LEAD', { from, name: userRow.get('name'), summary: aiResponse.summary, interest: newInterest });
            } else if ((newInterest === 'Alto' || newInterest === 'Quente') && newInterest !== previousInterest) {
                await sendAdminNotification('HIGH_INTEREST', { from, name: userRow.get('name'), interest: newInterest });
            } else if (newInterest === 'Precisa de Intervenção Humana' && newInterest !== previousInterest) {
                await sendAdminNotification('HUMAN_INTERVENTION', { from });
            }
        }
    }
}

// --- ROTAS E INICIALIZAÇÃO DO SERVIDOR ---
app.get('/', (req, res) => res.send('Servidor do Bot (Evolution API) está no ar! ☀️'));

app.post('/webhook', (req, res) => {
    res.sendStatus(200);
    const eventData = req.body;
    if (eventData.event !== 'messages.upsert' || eventData.data?.key?.fromMe) return;
    const rawMessage = eventData.data;
    const messageContent = rawMessage.message;
    if (!messageContent) return;

    const message = { from: rawMessage.key.remoteJid.split('@')[0], type: '', originalMessage: rawMessage };
    if (messageContent.extendedTextMessage?.text) {
        message.type = 'text'; message.text = { body: messageContent.extendedTextMessage.text };
    } else if (messageContent.conversation) {
        message.type = 'text'; message.text = { body: messageContent.conversation };
    } else if (messageContent.audioMessage) { message.type = 'audio'; }
    else if (messageContent.imageMessage) { message.type = 'image'; }
    else if (messageContent.documentMessage) { message.type = 'document'; }
    else { return; }

    if (processingUsers.has(message.from)) return console.log(`[${message.from}] MENSAGEM IGNORADA: Processamento em andamento.`);
    
    processingUsers.add(message.from);
    console.log(`[${message.from}] Trava ativada. Processando tipo: ${message.type}`);
    processIncomingMessage(message)
        .catch(error => {
            console.error("ERRO FATAL NO WEBHOOK:", error);
            sendAdminNotification('SYSTEM_ERROR', { from: message.from, errorMessage: error.message });
        })
        .finally(() => {
            processingUsers.delete(message.from);
            console.log(`[${message.from}] Processamento finalizado. Trava liberada.`);
        });
});

app.listen(PORT, () => console.log(`🚀 Servidor iniciado na porta ${PORT}`));