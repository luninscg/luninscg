const axios = require('axios');
const { updateLead } = require('./database');

/**
 * Valida se um CPF é válido
 * @param {string} cpf - CPF a ser validado
 * @returns {boolean} - True se válido, false caso contrário
 */
function validarCPF(cpf) {
    if (!cpf) return false;
    
    // Remove caracteres não numéricos
    cpf = cpf.replace(/[^\d]/g, '');
    
    // Verifica se tem 11 dígitos
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

/**
 * Formata dados para o payload da API
 * @param {Object} dados - Dados do lead
 * @returns {Object} - Payload formatado
 */
function formatarPayload(dados) {
    return {
        nome: dados.nome?.trim() || '',
        cpf: dados.cpf?.replace(/[^\d]/g, '') || '',
        whatsapp: dados.whatsapp?.replace(/[^\d]/g, '') || '',
        sessionId: dados.sessionId || Date.now().toString(),
        endereco: {
            logradouro: dados.endereco?.logradouro?.trim() || '',
            numero: dados.endereco?.numero?.toString().trim() || '',
            bairro: dados.endereco?.bairro?.trim() || '',
            cidade: dados.endereco?.cidade?.trim() || '',
            uf: dados.endereco?.uf?.trim().toUpperCase() || ''
        },
        consumo_medio: parseFloat(dados.consumo_medio) || 0,
        taxa_iluminacao: parseFloat(dados.taxa_iluminacao) || 0,
        tipo_conexao: dados.tipo_conexao?.toUpperCase() || 'MONOFASICO'
    };
}

/**
 * Valida os dados obrigatórios
 * @param {Object} dados - Dados a serem validados
 * @returns {Object} - Resultado da validação
 */
function validarDados(dados) {
    const erros = [];
    
    // Validações obrigatórias
    if (!dados.nome || dados.nome.trim().length < 2) {
        erros.push('Nome deve ter pelo menos 2 caracteres');
    }
    
    if (!validarCPF(dados.cpf)) {
        erros.push('CPF inválido');
    }
    
    if (!dados.whatsapp || dados.whatsapp.replace(/[^\d]/g, '').length < 10) {
        erros.push('WhatsApp deve ter pelo menos 10 dígitos');
    }
    
    if (!dados.endereco?.logradouro || dados.endereco.logradouro.trim().length < 3) {
        erros.push('Logradouro deve ter pelo menos 3 caracteres');
    }
    
    if (!dados.endereco?.cidade || dados.endereco.cidade.trim().length < 2) {
        erros.push('Cidade deve ter pelo menos 2 caracteres');
    }
    
    if (!dados.endereco?.uf || dados.endereco.uf.trim().length !== 2) {
        erros.push('UF deve ter exatamente 2 caracteres');
    }
    
    if (!dados.consumo_medio || dados.consumo_medio <= 0) {
        erros.push('Consumo médio deve ser maior que zero');
    }
    
    if (dados.taxa_iluminacao === undefined || dados.taxa_iluminacao < 0) {
        erros.push('Taxa de iluminação deve ser informada (pode ser 0)');
    }
    
    const tiposValidos = ['MONOFASICO', 'BIFASICO', 'TRIFASICO'];
    if (!tiposValidos.includes(dados.tipo_conexao?.toUpperCase())) {
        erros.push('Tipo de conexão deve ser MONOFASICO, BIFASICO ou TRIFASICO');
    }
    
    return {
        valido: erros.length === 0,
        erros
    };
}

/**
 * Gera proposta de energia solar via API GEUS
 * @param {Object} dadosLead - Dados do lead para geração da proposta
 * @returns {Promise<Object>} - Resultado da operação
 */
async function gerarPropostaEnergiaSolar(dadosLead) {
    const logPrefix = `[PROPOSTA-${dadosLead.whatsapp}]`;
    
    try {
        console.log(`${logPrefix} Iniciando geração de proposta...`);
        console.log(`${logPrefix} Dados recebidos:`, JSON.stringify(dadosLead, null, 2));
        
        // Formatar dados
        const payload = formatarPayload(dadosLead);
        console.log(`${logPrefix} Payload formatado:`, JSON.stringify(payload, null, 2));
        
        // Validar dados
        const validacao = validarDados(payload);
        if (!validacao.valido) {
            console.error(`${logPrefix} Dados inválidos:`, validacao.erros);
            return {
                sucesso: false,
                mensagem: `Dados inválidos: ${validacao.erros.join(', ')}`,
                erros: validacao.erros
            };
        }
        
        console.log(`${logPrefix} Dados validados com sucesso`);
        
        // Configurar requisição para API GEUS
        const config = {
            method: 'POST',
            url: 'https://geus.energiaa.com.br/api/propostaAgente/receber-proposta/',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SalesAgent/1.0'
            },
            data: payload,
            timeout: 30000 // 30 segundos
        };
        
        console.log(`${logPrefix} Enviando requisição para API GEUS...`);
        console.log(`${logPrefix} URL: ${config.url}`);
        
        // Fazer requisição
        const response = await axios(config);
        
        console.log(`${logPrefix} Resposta da API GEUS:`);
        console.log(`${logPrefix} Status: ${response.status}`);
        console.log(`${logPrefix} Headers:`, response.headers);
        console.log(`${logPrefix} Data:`, JSON.stringify(response.data, null, 2));
        
        // Verificar se a resposta indica sucesso
        if (response.status >= 200 && response.status < 300) {
            console.log(`${logPrefix} Proposta enviada com sucesso!`);
            
            // Atualizar lead no banco com informações da proposta
            try {
                await updateLead(dadosLead.whatsapp, {
                    proposta_enviada: true,
                    proposta_data: new Date().toISOString(),
                    proposta_session_id: payload.sessionId,
                    stage: 9 // Avança para estágio pós-proposta
                });
                console.log(`${logPrefix} Lead atualizado no banco de dados`);
            } catch (dbError) {
                console.error(`${logPrefix} Erro ao atualizar lead no banco:`, dbError);
                // Não falha a operação por erro de banco
            }
            
            return {
                sucesso: true,
                mensagem: 'Proposta gerada e enviada com sucesso',
                sessionId: payload.sessionId,
                response: response.data
            };
        } else {
            console.error(`${logPrefix} API retornou status não-sucesso: ${response.status}`);
            return {
                sucesso: false,
                mensagem: `Erro na API: Status ${response.status}`,
                status: response.status,
                response: response.data
            };
        }
        
    } catch (error) {
        console.error(`${logPrefix} Erro ao gerar proposta:`, error);
        
        // Tratamento específico para diferentes tipos de erro
        if (error.code === 'ECONNABORTED') {
            return {
                sucesso: false,
                mensagem: 'Timeout na conexão com o servidor de propostas',
                erro: 'TIMEOUT'
            };
        }
        
        if (error.response) {
            // Erro de resposta HTTP
            console.error(`${logPrefix} Erro HTTP:`, {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
            
            return {
                sucesso: false,
                mensagem: `Erro do servidor: ${error.response.status} - ${error.response.statusText}`,
                status: error.response.status,
                response: error.response.data
            };
        }
        
        if (error.request) {
            // Erro de rede
            console.error(`${logPrefix} Erro de rede:`, error.message);
            return {
                sucesso: false,
                mensagem: 'Erro de conexão com o servidor de propostas',
                erro: 'NETWORK_ERROR'
            };
        }
        
        // Erro genérico
        return {
            sucesso: false,
            mensagem: `Erro interno: ${error.message}`,
            erro: error.message
        };
    }
}

module.exports = {
    gerarPropostaEnergiaSolar,
    validarCPF,
    formatarPayload,
    validarDados
};