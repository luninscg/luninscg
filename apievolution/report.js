// report.js
require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { sendWhatsAppMessage } = require('./utils');

// --- CONFIGURAÇÕES ---
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const SHEET_NAME = 'Campanha_Disparos';
const ADMIN_NUMBER_FOR_REPORTS = process.env.ADMIN_WHATSAPP_NUMBER_1;

// --- INICIALIZAÇÃO ---
const serviceAccountAuth = new JWT({ email: GOOGLE_SERVICE_ACCOUNT_EMAIL, key: GOOGLE_PRIVATE_KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);

async function generateReport() {
    console.log("📊 Gerando relatório da campanha...");
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[SHEET_NAME];
    if (!sheet) {
        console.error(`ERRO: A aba "${SHEET_NAME}" não foi encontrada na planilha.`);
        return;
    }
    const rows = await sheet.getRows();

    let total = rows.length;
    let pendentes = 0, emAndamento = 0, concluidos = 0, comErro = 0, responderam = 0;

    for (const row of rows) {
        if ((row.get('Observacoes') || '').toLowerCase().includes('respondeu')) { responderam++; }
        switch (row.get('Status')) {
            case 'Pendente': pendentes++; break;
            case 'Em Andamento': emAndamento++; break;
            case 'Concluído': concluidos++; break;
            case 'Erro': comErro++; break;
        }
    }
    
    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const reportMessage = `📊 *Relatório da Campanha de Disparos*
*Data:* ${dataHora}

*Resumo Geral:*
Total de Contatos: *${total}*

*Status dos Disparos:*
⏳ Pendentes: *${pendentes}*
➡️ Em Andamento (Etapa 1 enviada): *${emAndamento}*
✅ Concluídos (Todas as etapas): *${concluidos}*
❌ Com Erro: *${comErro}*

*Engajamento:*
💬 Leads que responderam: *${responderam}*
📈 Taxa de Resposta: *${total > 0 ? ((responderam / total) * 100).toFixed(2) : 0}%*

Este é um status automático do seu sistema.`;

    console.log("--- Relatório ---\n" + reportMessage + "\n-----------------");

    if (ADMIN_NUMBER_FOR_REPORTS) {
        console.log(`Enviando relatório para o administrador: ${ADMIN_NUMBER_FOR_REPORTS}`);
        await sendWhatsAppMessage(ADMIN_NUMBER_FOR_REPORTS, reportMessage);
        console.log("✅ Relatório enviado.");
    }
}

generateReport();