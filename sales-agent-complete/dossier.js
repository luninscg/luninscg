// dossier.js - Base de Conhecimento da Energia A

const conhecimentoEnergia = {
    // PERGUNTAS SOBRE O PRODUTO
    'como funciona': `A Energia por Assinatura funciona assim: você assina um plano mensal e recebe créditos de energia de nossas fazendas solares. Esses créditos são aplicados automaticamente na sua conta da Energisa, reduzindo sua fatura em até 20%.`,
    
    'energia por assinatura': `É um serviço onde você não precisa instalar nada na sua casa. Você assina um plano e recebe créditos de energia limpa de nossas fazendas solares em MS. Os créditos são aplicados direto na sua conta da Energisa.`,
    
    'sem obras': `Exato! Não há obras, instalação ou modificação na sua casa. Tudo é feito administrativamente. Você apenas assina o plano e os créditos aparecem na sua fatura da Energisa.`,
    
    // PERGUNTAS FINANCEIRAS
    'quanto custa': `O valor do plano é calculado com base no seu consumo atual. Você paga menos do que pagaria na Energisa e ainda economiza até 20% na conta de luz. É um investimento que se paga sozinho.`,
    
    'economia': `Com nosso Plano Otimizado 20%, você economiza até 20% na sua conta de luz. Isso porque conseguimos abater os créditos sobre toda a base de cálculo, incluindo impostos.`,
    
    'desconto': `Oferecemos até 20% de economia na sua conta de luz através do nosso Plano Otimizado. É uma economia real e garantida todos os meses.`,
    
    // PERGUNTAS TÉCNICAS
    'titularidade': `A transferência de titularidade é um processo 100% regulamentado pela ANEEL. É temporário e administrativo, permitindo que apliquemos os créditos sobre toda a base de cálculo da sua fatura, maximizando sua economia.`,
    
    'aneel': `Sim, somos 100% regulamentados pela ANEEL. A energia por assinatura é uma modalidade oficial de compensação de energia elétrica, prevista na Resolução Normativa 482/2012 da ANEEL.`,
    
    'seguro': `Totalmente seguro! Somos regulamentados pela ANEEL, temos todas as licenças necessárias e milhares de clientes satisfeitos em MS. Você pode verificar nossa situação no site da ANEEL.`,
    
    // PERGUNTAS SOBRE INSTALAÇÃO
    'placas solares': `Oferecemos dois serviços: Energia por Assinatura (sem instalação) e Instalação de Placas Solares. Para instalação, nossa equipe de engenharia faz uma análise técnica completa da sua propriedade.`,
    
    'instalar': `Se você quer instalar placas na sua casa, temos esse serviço também! Nossa equipe de engenharia analisa sua propriedade e elabora um projeto personalizado. Quer que eu encaminhe para análise?`,
    
    // PERGUNTAS SOBRE PROCESSO
    'contrato': `O contrato é simples e transparente. Enviamos por e-mail para assinatura digital. Não há pegadinhas, taxas ocultas ou surpresas. Tudo muito claro e direto.`,
    
    'cancelar': `Você pode cancelar a qualquer momento com 30 dias de antecedência. Não há multa ou taxa de cancelamento. Somos transparentes em tudo.`,
    
    'prazo': `Após a assinatura do contrato, o processo leva de 30 a 60 dias para começar a aparecer os créditos na sua fatura. Isso depende dos trâmites com a Energisa.`,
    
    // PERGUNTAS SOBRE A EMPRESA
    'empresa': `A Energia A é uma empresa especializada em soluções de energia limpa em Mato Grosso do Sul. Temos fazendas solares próprias e milhares de clientes satisfeitos.`,
    
    'campo grande': `Sim, somos de Campo Grande - MS! Conhecemos bem o mercado local, o clima da região e as particularidades da Energisa aqui no estado.`,
    
    // OBJEÇÕES COMUNS
    'muito bom': `Entendo que pareça bom demais para ser verdade! Mas é real e regulamentado. Temos milhares de clientes economizando todo mês. Posso mostrar cases reais se quiser.`,
    
    'golpe': `Entendo sua preocupação! Somos uma empresa séria, regulamentada pela ANEEL. Você pode verificar nossa situação no site da ANEEL e conversar com nossos clientes. Transparência total!`,
    
    'confiança': `Sua desconfiança é normal e saudável! Somos regulamentados pela ANEEL, temos CNPJ ativo, endereço físico em Campo Grande e milhares de clientes. Que tal marcarmos um café para você conhecer melhor?`
};

// Função para buscar conhecimento
function buscarConhecimento(pergunta) {
    const perguntaLower = pergunta.toLowerCase();
    
    // Buscar por palavras-chave
    for (const [chave, resposta] of Object.entries(conhecimentoEnergia)) {
        if (perguntaLower.includes(chave)) {
            return {
                encontrado: true,
                conteudo: resposta,
                chave: chave
            };
        }
    }
    
    // Buscar por sinônimos e variações
    const sinonimos = {
        'preço': 'quanto custa',
        'valor': 'quanto custa',
        'custo': 'quanto custa',
        'funciona': 'como funciona',
        'confiável': 'seguro',
        'verdade': 'seguro',
        'real': 'seguro',
        'fraude': 'golpe',
        'enganação': 'golpe',
        'placas': 'placas solares',
        'painel': 'placas solares',
        'solar': 'placas solares'
    };
    
    for (const [sinonimo, chaveOriginal] of Object.entries(sinonimos)) {
        if (perguntaLower.includes(sinonimo) && conhecimentoEnergia[chaveOriginal]) {
            return {
                encontrado: true,
                conteudo: conhecimentoEnergia[chaveOriginal],
                chave: chaveOriginal
            };
        }
    }
    
    return {
        encontrado: false,
        conteudo: null,
        chave: null
    };
}

module.exports = { buscarConhecimento, conhecimentoEnergia };