// campaign.js (v4 - com Personalização Híbrida)
require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendWhatsAppMessage } = require('./utils');

// --- CONFIGURAÇÕES ---
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const CAMPAIGN_SHEET_NAME = 'Campanha_Disparos';
const CRM_SHEET_NAME = 'CRM';
const CAMPAIGN_TAG = 'Campanha_Pesquisa_Outreach';
const INTERVALO_ETAPA_2_MS = 24 * 60 * 60 * 1000; // 24 horas
const MENSAGEM_ETAPA_1 = "Olá {nome}, tudo bem? Aqui é o Gabriel Luz, da Energia A. Passando só para dar um oi e ver como estão as coisas. Grande abraço!";
const MENSAGEM_ETAPA_2 = "Que bom! {nome}, aproveitando o contato, estamos fazendo uma pesquisa rápida por aqui. De 0 a 10, o quão impactado você tem sido pelo aumento na conta de luz nos últimos meses?\n\nSó o número já ajuda bastante. Valeu!";

// --- INICIALIZAÇÃO DAS APIS ---
const serviceAccountAuth = new JWT({ email: GOOGLE_SERVICE_ACCOUNT_EMAIL, key: GOOGLE_PRIVATE_KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiFlashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const PERSONALIZATION_PROMPT = `Você é um assistente de vendas chamado Gabriel Luz. Sua tarefa é criar uma ÚNICA e CURTA mensagem de abertura para o WhatsApp, reaquecendo o contato com um cliente. A mensagem deve ser amigável, profissional e terminar com um "abraço" ou "tudo de bom". Use o seguinte contexto para personalizar a mensagem.

Contexto fornecido: "{contexto}"
Nome do cliente: "{nome}"

Retorne APENAS o texto da mensagem, sem nenhuma outra explicação.`;

async function getPersonalizedMessage(context, name) {
    console.log(`   - 🧠 Solicitando à IA uma mensagem personalizada...`);
    try {
        const prompt = PERSONALIZATION_PROMPT.replace('{contexto}', context).replace('{nome}', name);
        const result = await geminiFlashModel.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("   - ❌ Erro ao gerar mensagem com a IA. Usando mensagem padrão.", error);
        return MENSAGEM_ETAPA_1.replace('{nome}', name);
    }
}

async function runCampaign() {
    console.log("🔄 Carregando planilhas...");
    await doc.loadInfo();
    const campaignSheet = doc.sheetsByTitle[CAMPAIGN_SHEET_NAME];
    const crmSheet = doc.sheetsByTitle[CRM_SHEET_NAME];
    if (!campaignSheet || !crmSheet) {
        console.error("ERRO: Uma das abas ('Campanha_Disparos' ou 'CRM') não foi encontrada.");
        return;
    }
    const campaignRows = await campaignSheet.getRows();
    console.log(`✅ Planilhas carregadas. ${campaignRows.length} contatos na campanha.`);

    for (const row of campaignRows) {
        const status = row.get('Status');
        const etapaAtual = parseInt(row.get('Etapa_Atual'), 10);
        const numero = row.get('Numero');
        const nome = row.get('Nome');
        const contextoPersonalizado = row.get('Contexto_Personalizado') || '';

        try {
            if (status === 'Pendente' && etapaAtual === 0) {
                console.log(`▶️  Processando Etapa 1 para: ${nome}`);
                
                let mensagem;
                if (contextoPersonalizado.trim() !== '') {
                    console.log(`   - Contexto encontrado: "${contextoPersonalizado}"`);
                    mensagem = await getPersonalizedMessage(contextoPersonalizado, nome);
                } else {
                    console.log(`   - Sem contexto. Usando mensagem padrão.`);
                    mensagem = MENSAGEM_ETAPA_1.replace('{nome}', nome);
                }
                
                console.log(`   - Mensagem final a ser enviada: "${mensagem}"`);
                
                console.log(`   - Marcando lead no CRM...`);
                const crmRows = await crmSheet.getRows();
                let userRow = crmRows.find(r => r.get('whatsapp_number') === numero);
                if (userRow) {
                    userRow.set('source', CAMPAIGN_TAG);
                    await userRow.save();
                } else {
                    await crmSheet.addRow({ whatsapp_number: numero, name: nome, source: CAMPAIGN_TAG, stage: 0, protocol: new Date().getTime() });
                }
                
                const enviado = await sendWhatsAppMessage(numero, mensagem);
                if (!enviado) throw new Error("Falha no envio da mensagem pela API.");
                
                row.set('Status', 'Em Andamento');
                row.set('Etapa_Atual', '1');
                row.set('Timestamp_Etapa_1', new Date().toISOString());
                await row.save();
                console.log(`✔️  Etapa 1 enviada e registrada para ${nome}.`);
            }
            else if (status === 'Em Andamento' && etapaAtual === 1) {
                const timestampEtapa1 = new Date(row.get('Timestamp_Etapa_1'));
                if (new Date() - timestampEtapa1 >= INTERVALO_ETAPA_2_MS) {
                    console.log(`▶️  Processando Etapa 2 para: ${nome}`);
                    const mensagem = MENSAGEM_ETAPA_2.replace('{nome}', nome);
                    const enviado = await sendWhatsAppMessage(numero, mensagem);
                    if (!enviado) throw new Error("Falha no envio da mensagem pela API.");

                    row.set('Status', 'Concluído');
                    row.set('Etapa_Atual', '2');
                    row.set('Timestamp_Etapa_2', new Date().toISOString());
                    await row.save();
                    console.log(`✔️  Etapa 2 enviada e registrada para ${nome}.`);
                }
            }
        } catch (error) {
            console.error(`❌ Erro crítico ao processar ${nome}:`, error.message);
            row.set('Status', 'Erro');
            row.set('Observacoes', `Falha na Etapa ${etapaAtual + 1}: ${error.message}`);
            await row.save();
        }
    }
    console.log("🎉 Ciclo da campanha finalizado!");
}

runCampaign();