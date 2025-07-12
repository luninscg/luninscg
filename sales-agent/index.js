// index.js (v36.2 - com Leitura Dinâmica do Prompt e Rastreio de Campanha)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { initializeDb, getLead, addLead, updateLead, addMessage, getMessages } = require('./database');
const dashboardRouter = require('./dashboard');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { sendWhatsAppMessage } = require('./utils');
const { gerarPropostaEnergiaSolar } = require('./propostaGenerator');
const schedule = require('node-schedule');
const fs = require('fs');
const util = require('util');
const log_file = fs.createWriteStream(__dirname + '/server.log', {flags : 'w'});
const log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};


const { systemPrompt } = require('./prompt.js');

// --- MECANISMO DE TRAVA PARA EVITAR PROCESSAMENTO DUPLICADO ---
const processingUsers = new Set();

// --- Validação de Variáveis de Ambiente ---
const requiredEnvVars = [ 'EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE_NAME', 'GEMINI_API_KEY', 'ADMIN_WHATSAPP_NUMBER_1' ];
for (const varName of requiredEnvVars) { if (!process.env[varName]) { console.error(`ERRO CRÍTICO: A variável de ambiente ${varName} não está definida.`); process.exit(1); } }

// --- INICIALIZAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES E CONSTANTES ---
const PORT = process.env.PORT || 8080; // Use 8080 para o Cloud Run
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_WHATSAPP_NUMBER_1 = process.env.ADMIN_WHATSAPP_NUMBER_1;
const ADMIN_WHATSAPP_NUMBER_2 = process.env.ADMIN_WHATSAPP_NUMBER_2;
const INTENTION_TO_CLOSE_STAGE = 5;
const FINAL_STAGE_GATE = 8;

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
app.use('/dashboard', dashboardRouter);
console.log("Clientes de API inicializados com sucesso.");

// --- FUNÇÕES AUXILIARES ---

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

async function getAiResponse(history, userInput, currentStage, knownData, dossierContent = null, proposalData = null) {
    try {
        console.log("[DEBUG] Iniciando getAiResponse...");
        const chat = geminiFlashModel.startChat({ systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }, history });
        console.log("[DEBUG] Chat iniciado com sucesso");
        const proposalInstruction = proposalData ? `DADOS DA PROPOSTA CALCULADA: ${JSON.stringify(proposalData)}.` : '';
        const dossierInstruction = dossierContent ? `INFORMAÇÃO DO DOSSIÊ: "${dossierContent}".` : '';
        const promptForModel = `INSTRUÇÃO INTERNA: Estágio: ${currentStage}. Dados conhecidos: ${JSON.stringify(knownData)}. Input do cliente: "${userInput}". ${proposalInstruction} ${dossierInstruction} Responda em JSON.`;
        console.log("[DEBUG] Enviando mensagem para IA...");
        const result = await chat.sendMessage(promptForModel);
        console.log("[DEBUG] Resposta recebida da IA");
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
            : `Você é um especialista em análise de faturas de energia elétrica brasileiras da ENERGISA, CEMIG, CPFL, ENEL e outras distribuidoras.
               
               ANALISE ESTA FATURA E EXTRAIA OS DADOS ESSENCIAIS:
               
               PROCURE POR:
               - Nome do titular (geralmente no topo da fatura)
               - CPF/CNPJ (formato XXX.XXX.XXX-XX ou XX.XXX.XXX/XXXX-XX)
               - Endereço de instalação (diferente do endereço de correspondência)
               - Consumo em kWh (procure por "Consumo" ou "kWh")
               - Valor total da fatura (valor final a pagar)
               - CIP/Contribuição Iluminação Pública (taxa municipal)
               - Tipo de ligação: Monofásica, Bifásica ou Trifásica
               - Tarifa de energia (R$/kWh)
               
               RETORNE APENAS ESTE JSON:
               {
                 "nomeTitular": "nome completo ou null",
                 "documentoTitular": "apenas números ou null",
                 "enderecoCompleto": "endereço completo ou null",
                 "consumoKwh": número ou null,
                 "valorTotal": número ou null,
                 "valorCip": número ou null,
                 "tarifaEnergiaKwh": número ou null,
                 "tipoConexao": "MONOFASICO/BIFASICO/TRIFASICO ou null",
                 "confianca": "ALTA/MEDIA/BAIXA"
               }
               
               REGRAS CRÍTICAS:
               - Use apenas números para valores (ex: 150.75, não "R$ 150,75")
               - Se não conseguir ler algo com certeza, use null
               - Indique sua confiança na extração
               - Se não for uma fatura de energia, retorne: {"error": "Não é uma fatura de energia"}`;
        
        // Usar Gemini Pro para melhor precisão
        const result = await geminiProModel.generateContent([prompt, filePart]);
        const cleanedText = result.response.text().replace(/```json|```/g, '').trim();
        
        if (mimeType.startsWith('audio/')) {
            return { type: 'audio_transcription', data: { transcription: cleanedText } };
        } else {
            try {
                const parsedData = JSON.parse(cleanedText || '{}');
                
                if (parsedData.error) {
                    console.log(`[OCR] Arquivo rejeitado: ${parsedData.error}`);
                    return { type: 'media_analysis', data: parsedData };
                }
                
                // Validação e limpeza dos dados
                const validatedData = validateAndCleanOCRData(parsedData);
                console.log('[OCR] Dados extraídos e validados:', JSON.stringify(validatedData, null, 2));
                
                return { type: 'media_analysis', data: validatedData };
            } catch (parseError) {
                console.error('[OCR] Erro ao fazer parse do JSON:', parseError);
                // Tentar extração com prompt mais simples
                return await fallbackOCR(filePart);
            }
        }
    } catch (error) {
        console.error("Erro em processMedia:", error.response?.data || error);
        return { type: 'media_analysis', data: { error: "Falha ao processar o arquivo de mídia." } };
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
    
    try {
        console.log(`[${from}] Iniciando processamento da mensagem...`);

    if (message.type === 'text') {
        textInput = message.text.body.trim();
        console.log(`[${from}] Buscando no dossiê...`);
        
        console.log(`[${from}] Dossiê processado:`, dossierContent ? 'encontrado' : 'não encontrado');
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

    await addMessage(from, 'user', textInput);

    let userRow = await getLead(from);
    const currentUserStage = userRow ? userRow.stage : 0;
    console.log(`[${from}] Usuário encontrado:`, !!userRow, `Estágio atual:`, currentUserStage);
    
    // NOVO: Lógica de Rastreio de Campanha
    const leadSource = userRow ? userRow.source : 'Organico';
    console.log(`[${from}] Fonte do lead identificada: *${leadSource}*`);


    if (currentUserStage >= FINAL_STAGE_GATE && currentUserStage !== 8) return console.log(`[${from}] Usuário no estágio final.`);

    if (currentUserStage === 8) { // Estágio de Geração de Proposta
        console.log(`[${from}] ESTÁGIO 10: Iniciando geração de proposta...`);
        const leadData = await getLead(from);
        if (leadData && leadData.name && leadData.cpf && leadData.consumo_medio && leadData.taxa_iluminacao && leadData.address_logradouro) {
            const propostaResult = await gerarPropostaEnergiaSolar({
                nome: leadData.name,
                cpf: leadData.cpf,
                whatsapp: from,
                sessionId: leadData.protocol, // Usando o protocolo como sessionId
                endereco: {
                    logradouro: leadData.address_logradouro,
                    numero: leadData.address_numero,
                    bairro: leadData.address_bairro,
                    cidade: leadData.address_cidade,
                    uf: leadData.address_uf
                },
                consumo_medio: leadData.consumo_medio,
                taxa_iluminacao: leadData.taxa_iluminacao,
                tipo_conexao: leadData.tipo_conexao
            });

            if (propostaResult.sucesso) {
                console.log(`[${from}] Proposta gerada e enviada via webhook com sucesso.`);
                // A IA será informada no próximo passo que a proposta foi enviada.
                textInput = "INSTRUÇÃO INTERNA: A proposta foi gerada e enviada com sucesso. Informe o cliente e pergunte o que ele achou.";
            } else {
                console.error(`[${from}] Falha ao gerar proposta:`, propostaResult.mensagem);
                textInput = `INSTRUÇÃO INTERNA: Ocorreu um erro ao gerar a proposta: ${propostaResult.mensagem}. Informe o cliente sobre o erro e diga que um especialista irá verificar.`;
            }
        } else {
            console.error(`[${from}] Dados insuficientes para gerar proposta.`);
            textInput = "INSTRUÇÃO INTERNA: Dados insuficientes para gerar a proposta. Peça ao cliente para confirmar as informações que faltam.";
        }
    }

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

    console.log(`[${from}] Obtendo histórico e dados conhecidos...`);
    const history = (await getMessages(from)).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }]
    }));
    const knownData = userRow ? { name: userRow.name, cpf: userRow.cpf, email: userRow.email } : {};
    console.log(`[${from}] Histórico carregado, tamanho:`, history.length, `Dados conhecidos:`, Object.keys(knownData));
    
    console.log(`[${from}] Estágio: ${currentUserStage}. Processando input para IA: "${textInput}"`);
    console.log(`[${from}] Chamando getAiResponse...`);
    const aiResponse = await getAiResponse(history, textInput, currentUserStage, knownData, dossierContent, proposalData);
    console.log(`[${from}] getAiResponse retornou:`, JSON.stringify(aiResponse));

    // Verifica se há mensagens para enviar (suporta tanto response_messages quanto response_message)
    const messagesToSend = aiResponse.response_messages || (aiResponse.response_message ? aiResponse.response_message.split('|||') : []);
    
    if (messagesToSend?.length) {
        console.log(`[${from}] Enviando ${messagesToSend.length} mensagem(ns) para o WhatsApp...`);
        for (const msg of messagesToSend) {
            const trimmedMsg = msg.trim();
            if (trimmedMsg) {
                // Adiciona um delay variável para simular digitação
                const delayMatch = trimmedMsg.match(/^delay:(\d+)/);
                if (delayMatch) {
                    const delayMs = parseInt(delayMatch[1], 10);
                    console.log(`[${from}] Atrasando por ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                } else {
                    console.log(`[${from}] Enviando: "${trimmedMsg.substring(0, 50)}..."`);
                    await sendWhatsAppMessage(from, trimmedMsg);
                    await addMessage(from, 'agent', trimmedMsg); // Salva a mensagem do agente
                }
            }
        }
        const dataToUpdate = {
            stage: aiResponse.next_stage, last_interaction_timestamp: new Date().toISOString(),
            ...Object.fromEntries(Object.entries(aiResponse).filter(([k, v]) => v && ['name', 'cpf', 'email', 'address', 'summary', 'interest_level'].includes(k)))
        };
        if (extractedDataForSheet && !extractedDataForSheet.error) {
            Object.assign(dataToUpdate, { fatura_nome_titular: extractedDataForSheet.nomeTitular, fatura_cpf_cnpj_titular: extractedDataForSheet.documentoTitular, /* ...outros campos da fatura... */ });
        }

        if (!userRow) {
            await addLead({ whatsapp_number: from, protocol: new Date().getTime(), source: 'Organico', ...dataToUpdate });
            await sendAdminNotification('NEW_LEAD', { from });
        } else {
            const previousInterest = userRow.interest_level;
            await updateLead(from, dataToUpdate);
            const { next_stage: newStage, interest_level: newInterest } = aiResponse;
            if (newStage >= INTENTION_TO_CLOSE_STAGE && currentUserStage < INTENTION_TO_CLOSE_STAGE) {
                await sendAdminNotification('QUALIFIED_LEAD', { from, name: userRow.name, summary: aiResponse.summary, interest: newInterest });
            } else if ((newInterest === 'Alto' || newInterest === 'Quente') && newInterest !== previousInterest) {
                await sendAdminNotification('HIGH_INTEREST', { from, name: userRow.name, interest: newInterest });
            } else if (newInterest === 'Precisa de Intervenção Humana' && newInterest !== previousInterest) {
                await sendAdminNotification('HUMAN_INTERVENTION', { from });
            }
        }
    }
    
    } catch (error) {
        console.error(`[${from}] ERRO FATAL em processIncomingMessage:`, error);
        throw error; // Re-throw para que seja capturado pelo webhook
    }
}

// --- AGENDAMENTO DE TAREFAS (DESATIVADO) ---
// const schedule = require('node-schedule');



// --- ROTAS E INICIALIZAÇÃO DO SERVIDOR ---
app.post('/reset-user', async (req, res) => {
    const { number } = req.body;
    if (!number) {
        return res.status(400).send({ error: 'O número do usuário é obrigatório.' });
    }

    try {
        const user = await getLead(number);
        if (user) {
            await updateLead(number, { stage: 0 });
            // Opcional: Limpar o histórico de mensagens também
            // await db.run('DELETE FROM messages WHERE lead_whatsapp = ?', [number]);
            console.log(`[${number}] Estágio do usuário resetado para 0.`);
            res.send({ success: `Estágio do usuário ${number} resetado para 0.` });
        } else {
            res.status(404).send({ error: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error(`[${number}] Erro ao resetar o estágio do usuário:`, error);
        res.status(500).send({ error: 'Erro interno ao resetar o estágio do usuário.' });
    }
});

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

async function startServer() {
    try {
        initializeDb();
        console.log("Banco de dados inicializado com sucesso.");

        const server = app.listen(PORT, () => {
            console.log(`🚀 Servidor iniciado na porta ${PORT}`);
            console.log(`🔗 Dashboard disponível em http://localhost:${PORT}/dashboard`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`ERRO: A porta ${PORT} já está em uso. O servidor não pode ser iniciado.`);
                process.exit(1);
            } else {
                console.error('Ocorreu um erro inesperado no servidor:', err);
            }
        });

    } catch (error) {
        console.error("ERRO CRÍTICO AO INICIAR:", error);
        process.exit(1);
    }
}

startServer();


function validateAndCleanOCRData(data) {
    const cleaned = {};
    
    // Limpar e validar nome
    if (data.nomeTitular && typeof data.nomeTitular === 'string') {
        cleaned.nomeTitular = data.nomeTitular.trim().toUpperCase();
    }
    
    // Limpar e validar CPF/CNPJ
    if (data.documentoTitular) {
        const doc = data.documentoTitular.toString().replace(/\D/g, '');
        if (doc.length === 11 || doc.length === 14) {
            cleaned.documentoTitular = doc;
        }
    }
    
    // Validar consumo
    if (data.consumoKwh && !isNaN(parseFloat(data.consumoKwh))) {
        const consumo = parseFloat(data.consumoKwh);
        if (consumo > 0 && consumo < 10000) { // Consumo razoável
            cleaned.consumoKwh = consumo;
        }
    }
    
    // Validar valor total
    if (data.valorTotal && !isNaN(parseFloat(data.valorTotal))) {
        const valor = parseFloat(data.valorTotal);
        if (valor > 0 && valor < 50000) { // Valor razoável
            cleaned.valorTotal = valor;
        }
    }
    
    // Validar CIP
    if (data.valorCip && !isNaN(parseFloat(data.valorCip))) {
        const cip = parseFloat(data.valorCip);
        if (cip >= 0 && cip < 1000) {
            cleaned.valorCip = cip;
        }
    }
    
    // Validar tarifa
    if (data.tarifaEnergiaKwh && !isNaN(parseFloat(data.tarifaEnergiaKwh))) {
        const tarifa = parseFloat(data.tarifaEnergiaKwh);
        if (tarifa > 0 && tarifa < 5) { // Tarifa razoável
            cleaned.tarifaEnergiaKwh = tarifa;
        }
    }
    
    // Validar tipo de conexão
    if (data.tipoConexao) {
        const tipo = data.tipoConexao.toUpperCase();
        if (['MONOFASICO', 'BIFASICO', 'TRIFASICO'].includes(tipo)) {
            cleaned.tipoConexao = tipo;
        }
    }
    
    // Limpar endereço
    if (data.enderecoCompleto && typeof data.enderecoCompleto === 'string') {
        cleaned.enderecoCompleto = data.enderecoCompleto.trim();
    }
    
    // Manter indicador de confiança
    cleaned.confianca = data.confianca || 'MEDIA';
    
    return cleaned;
}