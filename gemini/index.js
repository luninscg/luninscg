// index.js (v35.2 - Correção Definitiva do searchDossier)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// --- MECANISMO DE TRAVA PARA EVITAR PROCESSAMENTO DUPLICADO ---
const processingUsers = new Set();

// --- Validação de Variáveis de Ambiente ---
const requiredEnvVars = [ 'WHATSAPP_TOKEN', 'VERIFY_TOKEN', 'PHONE_NUMBER_ID', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GEMINI_API_KEY', 'GEMINI_SYSTEM_PROMPT', 'ADMIN_WHATSAPP_NUMBER_1' ];
for (const varName of requiredEnvVars) { if (!process.env[varName]) { console.error(`ERRO CRÍTICO: A variável de ambiente ${varName} não está definida.`); process.exit(1); } }

// --- INICIALIZAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES E CONSTANTES ---
const PORT = process.env.PORT || 8080;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_SYSTEM_PROMPT = process.env.GEMINI_SYSTEM_PROMPT;
const ADMIN_WHATSAPP_NUMBER_1 = process.env.ADMIN_WHATSAPP_NUMBER_1;
const ADMIN_WHATSAPP_NUMBER_2 = process.env.ADMIN_WHATSAPP_NUMBER_2;
const INTENTION_TO_CLOSE_STAGE = 5;
const FINAL_STAGE_GATE = 8;
const MINIMUM_BILL_VALUE = 300;

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
        await axios.post(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            { messaging_product: 'whatsapp', to, text: { body: text } },
            { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } }
        );
    } catch (error) {
        console.error(`Erro ao enviar mensagem para ${to}:`, error.response ? JSON.stringify(error.response.data) : error.message);
    }
}

async function sendAdminNotification(type, data) {
    let message_to_gestor1 = null;
    let message_to_gestor2 = null;
    switch (type) {
        case 'NEW_LEAD':
            message_to_gestor1 = `👋 Novo Lead!\n*Contato:* ${data.from}`;
            break;
        case 'HIGH_INTEREST':
            const highInterestMessage = `🔥 Interesse Alto Detectado!\n\n*Nome:* ${data.name || 'N/A'}\n*Contato:* ${data.from}\n*Nível:* *${data.interest}*`;
            message_to_gestor1 = highInterestMessage;
            message_to_gestor2 = highInterestMessage;
            break;
        case 'QUALIFIED_LEAD':
            const qualifiedMessage = `🏆✨ LEAD QUENTE (INTENÇÃO DE FECHAR)! ✨🏆\n\n*Cliente:* ${data.name}\n*Contato:* ${data.from}\n\n*Resumo da IA:*\n_${data.summary || 'Cliente aceitou a proposta e iniciou a coleta de dados.'}_\n\n*Nível de Interesse:* *${data.interest || 'Alto'}*`;
            message_to_gestor1 = qualifiedMessage;
            message_to_gestor2 = qualifiedMessage;
            break;
        case 'HUMAN_INTERVENTION':
            const interventionMessage = `🆘 AJUDA SOLICITADA!\n\n*Contato:* ${data.from}\n*Motivo:* Cliente pediu para falar com um humano ou fez uma pergunta complexa.`;
            message_to_gestor1 = interventionMessage;
            message_to_gestor2 = interventionMessage;
            break;
        case 'SYSTEM_ERROR':
            message_to_gestor1 = `🆘 ERRO GRAVE NO BOT 🆘\n\nFalha em msg de ${data.from}.\n\n*Erro:* ${data.errorMessage}`;
            break;
    }
    if (message_to_gestor1 && ADMIN_WHATSAPP_NUMBER_1) await sendWhatsAppMessage(ADMIN_WHATSAPP_NUMBER_1, message_to_gestor1);
    if (message_to_gestor2 && ADMIN_WHATSAPP_NUMBER_2 && ADMIN_WHATSAPP_NUMBER_2 !== ADMIN_WHATSAPP_NUMBER_1) await sendWhatsAppMessage(ADMIN_WHATSAPP_NUMBER_2, message_to_gestor2);
}

async function getAiResponse(history, userInput, currentStage, knownData, dossierContent = null, proposalData = null) {
    try {
        const chat = geminiFlashModel.startChat({ systemInstruction: { role: "system", parts: [{ text: GEMINI_SYSTEM_PROMPT }] }, history });
        const proposalInstruction = proposalData ? `DADOS DA PROPOSTA CALCULADA PARA USAR NO TEMPLATE: ${JSON.stringify(proposalData)}.` : '';
        const dossierInstruction = dossierContent ? `INFORMAÇÃO ADICIONAL DO DOSSIÊ: "${dossierContent}".` : '';
        const promptForModel = `INSTRUÇÃO INTERNA: Estágio: ${currentStage}. Dados conhecidos: ${JSON.stringify(knownData)}. Input do cliente: "${userInput}". ${proposalInstruction} ${dossierInstruction} Responda em JSON.`;
        const result = await chat.sendMessage(promptForModel);
        const responseText = result.response.text();
        console.log("Resposta bruta do Gemini:", responseText);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Nenhum JSON válido na resposta da IA.");
    } catch (e) {
        console.error("ERRO CRÍTICO EM getAiResponse:", e);
        return { response_messages: ["Desculpe, tive uma instabilidade em nossos sistemas. Um de nossos especialistas já foi notificado e entrará em contato em breve."], next_stage: currentStage };
    }
}

async function processMedia(mediaId, mimeType) {
    try {
        const mediaUrlResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } });
        const mediaData = await axios.get(mediaUrlResponse.data.url, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }, responseType: 'arraybuffer' });
        const filePart = { inlineData: { data: Buffer.from(mediaData.data).toString("base64"), mimeType } };
        let prompt;
        if (mimeType.startsWith('audio/')) {
            prompt = "Transcreva este áudio na íntegra. Retorne apenas o texto.";
        } else {
            prompt = "Você é um OCR especialista em faturas de energia. Extraia os seguintes dados, retornando APENAS um objeto JSON. As chaves devem ser: 'nomeTitular', 'documentoTitular', 'enderecoCompleto', 'consumoKwh', 'valorTotal', 'valorCip', 'tarifaEnergiaKwh', 'bandeiraTarifaria', e 'tipoConexao' (o valor deve ser 'MONOFASICO', 'BIFASICO' ou 'TRIFASICO'). Se um campo não for encontrado, retorne null. Se não for uma fatura, retorne `{\"error\": \"Arquivo não é uma fatura de energia.\"}`.";
        }
        const result = await geminiProModel.generateContent([prompt, filePart]);
        const cleanedText = (result.response.text() || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
        if (mimeType.startsWith('audio/')) return { type: 'audio_transcription', data: { transcription: cleanedText } };
        return { type: 'media_analysis', data: JSON.parse(cleanedText) };
    } catch (error) {
        console.error("Erro em processMedia:", error);
        return { type: 'media_analysis', data: { error: "Falha ao processar o arquivo de mídia." } };
    }
}

// *** FUNÇÃO QUE ESTAVA FALTANDO, AGORA NO LUGAR CERTO ***
async function searchDossier(text) {
    try {
        await doc.loadInfo(); // Garante que o doc está carregado
        const sheet = doc.sheetsByTitle['Dossie']; // O nome da sua aba do dossiê
        if (!sheet) {
            console.log("Aba 'Dossie' não encontrada, pulando busca.");
            return null;
        }
        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        for (const row of rows) {
            const keywords = (row.get('PalavrasChave') || '').split(',').map(k => k.trim().toLowerCase());
            for (const keyword of keywords) {
                if (keyword && text.toLowerCase().includes(keyword)) {
                    console.log(`Keyword do dossiê encontrada: '${keyword}'`);
                    return row.get('RespostaOficial');
                }
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

    if (message.type === 'text' && message.text?.body && message.text.body.trim()) {
        textInput = message.text.body.trim();
        dossierContent = await searchDossier(textInput);
    } else if (message.type === 'audio' && message.audio?.id) {
        await sendWhatsAppMessage(from, "");
        const audioResult = await processMedia(message.audio.id, message.audio.mime_type);
        if (audioResult.data?.transcription) textInput = audioResult.data.transcription;
    } else if ((message.type === 'image' || message.type === 'document') && message[message.type]?.id) {
        await sendWhatsAppMessage(from, "");
        const mediaResult = await processMedia(message[message.type].id, message[message.type].mime_type);
        extractedDataForSheet = mediaResult.data;
        if (mediaResult.data?.error) {
            textInput = `Análise da Fatura Falhou: ${mediaResult.data.error}`;
        } else if (mediaResult.data) {
            textInput = `Análise da Fatura Concluída.`;
        }
    }

    if (!textInput) return console.log(`[${from}] Mensagem ignorada (conteúdo final vazio ou tipo não suportado).`);

    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['CRM'];
    if (!sheet) { return console.error("ERRO CRÍTICO: Aba 'CRM' não encontrada."); }
    const rows = await sheet.getRows();
    const userRow = rows.find(r => r.get('whatsapp_number') === from);
    const currentUserStage = userRow ? parseInt(userRow.get('stage'), 10) || 0 : 0;
    
    if (currentUserStage >= FINAL_STAGE_GATE) return console.log(`[${from}] Usuário no estágio final (${currentUserStage}).`);

    if (currentUserStage === 3) {
        if (extractedDataForSheet && !extractedDataForSheet.error) {
            proposalData = calculateProposal(extractedDataForSheet);
            if (proposalData) textInput += ` Proposta calculada com base na última fatura.`;
        } else if (!isNaN(parseFloat(textInput))) {
            const billValue = parseFloat(textInput);
            const monthlySavings = (billValue - 50) * 0.20; // Estimativa simples
            if (monthlySavings > 0) proposalData = { economiaMensal: monthlySavings.toFixed(2), economiaAnual: (monthlySavings * 12).toFixed(2), economia5Anos: (monthlySavings * 60).toFixed(2) };
        }
    }

    const history = userRow ? JSON.parse(userRow.get('conversation_history') || '[]') : [];
    const knownData = userRow ? { name: userRow.get('name'), cpf: userRow.get('cpf'), email: userRow.get('email') } : {};
    
    console.log(`[${from}] Estágio: ${currentUserStage}. Processando input para IA: "${textInput}"`);
    const aiResponse = await getAiResponse(history, textInput, currentUserStage, knownData, dossierContent, proposalData);

    if (aiResponse.response_messages && Array.isArray(aiResponse.response_messages)) {
        for (const msg of aiResponse.response_messages) { await sendWhatsAppMessage(from, msg); }

        const updatedHistory = [...history, { role: "user", parts: [{ text: textInput }] }, { role: "model", parts: [{ text: JSON.stringify(aiResponse) }] }];
        const dataToUpdate = {
            stage: aiResponse.next_stage, conversation_history: JSON.stringify(updatedHistory), last_interaction_timestamp: new Date().toISOString(),
            ...(aiResponse.name && { name: aiResponse.name }),
            ...(aiResponse.cpf && { cpf: aiResponse.cpf }),
            ...(aiResponse.email && { email: aiResponse.email }),
            ...(aiResponse.address && { address: aiResponse.address }),
            ...(aiResponse.summary && { conversation_summary: aiResponse.summary }),
            ...(aiResponse.interest_level && { interest_level: aiResponse.interest_level }),
        };

        if (extractedDataForSheet && !extractedDataForSheet.error) {
            dataToUpdate.fatura_nome_titular = extractedDataForSheet.nomeTitular;
            dataToUpdate.fatura_cpf_cnpj_titular = extractedDataForSheet.documentoTitular;
            dataToUpdate.fatura_endereco = extractedDataForSheet.enderecoCompleto;
            dataToUpdate.fatura_consumo_kwh = extractedDataForSheet.consumoKwh;
            dataToUpdate.fatura_valor_total = extractedDataForSheet.valorTotal;
            dataToUpdate.fatura_valor_iluminacao_publica = extractedDataForSheet.valorCip;
            dataToUpdate.fatura_valor_kwh = extractedDataForSheet.tarifaEnergiaKwh;
            dataToUpdate.fatura_bandeira_tarifaria = extractedDataForSheet.bandeiraTarifaria;
            dataToUpdate.fatura_tipo_conexao = extractedDataForSheet.tipoConexao;
        }

        if (!userRow) {
            await sheet.addRow({ whatsapp_number: from, protocol: new Date().getTime(), ...dataToUpdate });
            await sendAdminNotification('NEW_LEAD', { from });
        } else {
            const previousInterest = userRow.get('interest_level');
            userRow.assign(dataToUpdate);
            await userRow.save();

            const newStage = aiResponse.next_stage;
            const newInterest = aiResponse.interest_level;

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
app.get('/', (req, res) => res.send('Servidor do Bot de Energia Solar está no ar e operando! ☀️'));

app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        console.log("Webhook verificado com sucesso!");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Falha na verificação do webhook. Tokens não correspondem.");
        res.sendStatus(403);
    }
});

app.post('/webhook', (req, res) => {
    res.sendStatus(200);
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
        const from = message.from;
        if (processingUsers.has(from)) {
            return console.log(`[${from}] MENSAGEM IGNORADA: Processamento em andamento.`);
        }
        processingUsers.add(from);
        console.log(`[${from}] Trava ativada. Iniciando processamento...`);
        processIncomingMessage(message).catch(error => {
            console.error("ERRO FATAL NO PROCESSAMENTO DO WEBHOOK:", error);
            sendAdminNotification('SYSTEM_ERROR', { from: message.from, errorMessage: error.message });
        }).finally(() => {
            processingUsers.delete(from);
            console.log(`[${from}] Processamento finalizado. Trava liberada.`);
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Servidor iniciado na porta ${PORT}`));