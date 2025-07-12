const { getLead, addLead, updateLead } = require('./database');

// Função de cálculo de proposta (copiada do index.js)
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

// Função para simular geração de proposta
async function testarGeracaoProposta() {
    console.log('🧪 === TESTE DE GERAÇÃO DE PROPOSTA ===\n');
    
    // Dados de exemplo para teste
    const dadosTeste = {
        valorTotal: 350.50,
        valorCip: 15.20,
        tipoConexao: 'BIFASICO',
        tarifaEnergiaKwh: 0.85
    };
    
    console.log('📊 Dados da Fatura de Teste:');
    console.log(`   • Valor Total: R$ ${dadosTeste.valorTotal}`);
    console.log(`   • Valor CIP: R$ ${dadosTeste.valorCip}`);
    console.log(`   • Tipo Conexão: ${dadosTeste.tipoConexao}`);
    console.log(`   • Tarifa kWh: R$ ${dadosTeste.tarifaEnergiaKwh}\n`);
    
    // Calcular proposta
    const proposta = calculateProposal(dadosTeste);
    
    if (proposta) {
        console.log('✅ PROPOSTA GERADA COM SUCESSO!');
        console.log('💰 Resultados:');
        console.log(`   • Economia Mensal: R$ ${proposta.economiaMensal}`);
        console.log(`   • Economia Anual: R$ ${proposta.economiaAnual}`);
        console.log(`   • Economia 5 Anos: R$ ${proposta.economia5Anos}\n`);
    } else {
        console.log('❌ ERRO: Não foi possível gerar a proposta (base de cálculo <= 0)\n');
    }
    
    // Teste com diferentes cenários
    console.log('🔄 Testando diferentes cenários:\n');
    
    const cenarios = [
        { nome: 'Conta Baixa', valorTotal: 120, valorCip: 10, tipoConexao: 'MONOFASICO', tarifaEnergiaKwh: 0.75 },
        { nome: 'Conta Média', valorTotal: 280, valorCip: 15, tipoConexao: 'BIFASICO', tarifaEnergiaKwh: 0.80 },
        { nome: 'Conta Alta', valorTotal: 650, valorCip: 25, tipoConexao: 'TRIFASICO', tarifaEnergiaKwh: 0.90 },
        { nome: 'Conta Muito Baixa', valorTotal: 80, valorCip: 5, tipoConexao: 'MONOFASICO', tarifaEnergiaKwh: 0.70 }
    ];
    
    cenarios.forEach((cenario, index) => {
        console.log(`${index + 1}. ${cenario.nome}:`);
        const resultado = calculateProposal(cenario);
        if (resultado) {
            console.log(`   ✅ Economia Mensal: R$ ${resultado.economiaMensal}`);
        } else {
            console.log(`   ❌ Proposta inviável (valor muito baixo)`);
        }
        console.log('');
    });
}

// Função para testar com dados de um lead real
async function testarComLeadReal(whatsappNumber) {
    console.log(`🔍 Buscando dados do lead: ${whatsappNumber}\n`);
    
    try {
        const lead = await getLead(whatsappNumber);
        
        if (!lead) {
            console.log('❌ Lead não encontrado no banco de dados\n');
            return;
        }
        
        console.log('👤 Dados do Lead:');
        console.log(`   • Nome: ${lead.name || 'N/A'}`);
        console.log(`   • CPF: ${lead.cpf || 'N/A'}`);
        console.log(`   • Estágio: ${lead.stage}`);
        console.log(`   • Consumo Médio: ${lead.consumo_medio || 'N/A'} kWh`);
        console.log(`   • Taxa Iluminação: R$ ${lead.taxa_iluminacao || 'N/A'}`);
        console.log(`   • Tipo Conexão: ${lead.tipo_conexao || 'N/A'}\n`);
        
        if (lead.consumo_medio && lead.taxa_iluminacao) {
            // Simular dados de fatura baseados nos dados do lead
            const dadosSimulados = {
                valorTotal: lead.consumo_medio * 0.8 + parseFloat(lead.taxa_iluminacao || 0),
                valorCip: 15,
                tipoConexao: lead.tipo_conexao || 'BIFASICO',
                tarifaEnergiaKwh: 0.8
            };
            
            console.log('📊 Simulando proposta com dados do lead...');
            const proposta = calculateProposal(dadosSimulados);
            
            if (proposta) {
                console.log('✅ PROPOSTA SIMULADA:');
                console.log(`   • Economia Mensal: R$ ${proposta.economiaMensal}`);
                console.log(`   • Economia Anual: R$ ${proposta.economiaAnual}`);
                console.log(`   • Economia 5 Anos: R$ ${proposta.economia5Anos}\n`);
            } else {
                console.log('❌ Não foi possível gerar proposta com os dados disponíveis\n');
            }
        } else {
            console.log('⚠️  Dados insuficientes para gerar proposta (faltam consumo_medio ou taxa_iluminacao)\n');
        }
        
    } catch (error) {
        console.error('❌ Erro ao buscar lead:', error.message);
    }
}

// Função principal
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Teste padrão
        await testarGeracaoProposta();
    } else if (args[0] === '--lead' && args[1]) {
        // Teste com lead específico
        await testarComLeadReal(args[1]);
    } else {
        console.log('\n📖 Como usar:');
        console.log('   node test-proposta.js                    # Teste padrão');
        console.log('   node test-proposta.js --lead 5511999999999  # Teste com lead específico\n');
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { calculateProposal, testarGeracaoProposta, testarComLeadReal };