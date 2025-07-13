/**
 * DOSSIER COMPLETO - ENERGIAA.COM.BR
 * Sistema de Conhecimento Avançado para IA Conversacional
 * Atualizado em: 2024
 */

const energiaaDossier = {
  // INFORMAÇÕES DA EMPRESA
  empresa: {
    nome: "Energiaa",
    website: "energiaa.com.br",
    segmento: "Energia Solar Fotovoltaica",
    foco_principal: "Aluguel de Placas Solares e Usinas Fotovoltaicas",
    modelo_negocio: "Assinatura de Energia Solar (Energy as a Service)",
    diferencial: "Sem investimento inicial, sem obras, economia imediata"
  },

  // MODELO DE NEGÓCIO DETALHADO
  modelo_aluguel: {
    conceito: "O cliente paga uma assinatura mensal para ter direito à energia solar sem precisar comprar os equipamentos",
    vantagens_cliente: [
      "Sem investimento inicial alto (R$ 15.000 a R$ 50.000+)",
      "Sem necessidade de obras no imóvel",
      "Manutenção e monitoramento inclusos",
      "Economia imediata na conta de luz (10% a 20%)",
      "Ideal para imóveis alugados",
      "Portabilidade entre imóveis (mesma distribuidora)",
      "Proteção contra bandeiras tarifárias",
      "Sustentabilidade sem complicação"
    ],
    como_funciona: [
      "1. Cliente assina contrato de aluguel (geralmente 10-15 anos)",
      "2. Energiaa instala sistema ou aloca cota em usina solar",
      "3. Energia gerada é injetada na rede da distribuidora",
      "4. Créditos são compensados na fatura do cliente",
      "5. Cliente paga mensalidade menor que economia gerada"
    ],
    tipos_servico: {
      residencial: {
        descricao: "Placas instaladas no telhado da residência",
        investimento_evitado: "R$ 15.000 a R$ 35.000",
        economia_mensal: "10% a 15%",
        prazo_contrato: "120 meses (10 anos)"
      },
      comercial: {
        descricao: "Cota em usina solar remota",
        investimento_evitado: "R$ 50.000 a R$ 500.000+",
        economia_mensal: "15% a 20%",
        prazo_contrato: "120 a 180 meses"
      }
    }
  },

  // MERCADO E CONTEXTO
  mercado_energia_solar: {
    crescimento: "22% ao ano no Brasil",
    investimentos_2021: "R$ 21,8 bilhões",
    tendencia: "Exponencial devido a crise energética e inflação",
    regulamentacao: "Lei 14.300/22 (Marco Legal da GD)",
    vida_util_equipamentos: "25+ anos (placas), 15+ anos (inversores)"
  },

  // OBJEÇÕES COMUNS E RESPOSTAS
  objections_handling: {
    "muito_caro": {
      resposta: "Na verdade, você não paga nada antecipado! O aluguel mensal é menor que sua economia na conta de luz. É como trocar uma conta cara por uma mais barata.",
      dados: "Economia típica: R$ 200-500/mês vs Aluguel: R$ 150-400/mês"
    },
    "nao_tenho_telhado": {
      resposta: "Perfeito! Nosso modelo de usina remota é ideal para você. Você recebe energia de nossa usina solar sem precisar de espaço próprio.",
      beneficio: "Ideal para apartamentos, casas alugadas, empresas sem espaço"
    },
    "vou_me_mudar": {
      resposta: "Sem problema! Nosso serviço é portável. Você pode transferir para o novo endereço desde que seja na mesma distribuidora de energia.",
      flexibilidade: "Portabilidade garantida por contrato"
    },
    "e_se_quebrar": {
      resposta: "Toda manutenção, monitoramento e seguro são por nossa conta! Você não se preocupa com nada técnico, apenas aproveita a economia.",
      garantia: "Manutenção vitalícia incluída"
    },
    "nao_confio_tecnologia": {
      resposta: "A energia solar é uma tecnologia madura, usada há décadas. Nossas placas têm garantia de 25 anos e são da mais alta qualidade.",
      credibilidade: "Tecnologia comprovada mundialmente"
    },
    "conta_luz_baixa": {
      resposta: "Mesmo com conta baixa, você economiza! Além disso, protege-se dos aumentos futuros e contribui para o meio ambiente.",
      minimo: "Atendemos contas a partir de R$ 150/mês"
    }
  },

  // PROCESSO DE VENDAS
  sales_process: {
    qualificacao: [
      "Valor da conta de luz mensal",
      "Tipo de imóvel (próprio/alugado)",
      "Região/distribuidora de energia",
      "Interesse em sustentabilidade",
      "Urgência da decisão"
    ],
    apresentacao: [
      "Mostrar economia real em reais",
      "Comparar com financiamento tradicional",
      "Destacar benefícios únicos do aluguel",
      "Apresentar cases de sucesso",
      "Simular economia personalizada"
    ],
    fechamento: [
      "Proposta personalizada",
      "Condições especiais por tempo limitado",
      "Garantia de satisfação",
      "Processo de aprovação simplificado"
    ]
  },

  // SIMULADOR DE ECONOMIA
  simulador: {
    inputs_necessarios: [
      "valor_conta_luz_mensal",
      "tipo_cliente", // residencial/comercial
      "regiao",
      "tipo_telhado", // se aplicável
      "area_disponivel" // se aplicável
    ],
    calculos: {
      economia_mensal: "conta_atual * 0.15", // 15% economia média
      valor_aluguel: "economia_mensal * 0.8", // 80% da economia
      economia_liquida: "economia_mensal - valor_aluguel",
      economia_anual: "economia_liquida * 12",
      economia_25_anos: "economia_anual * 25"
    }
  },

  // ARGUMENTOS DE VENDA PODEROSOS
  sales_arguments: {
    financeiro: [
      "Economia imediata sem investimento",
      "Proteção contra aumentos da energia",
      "ROI positivo desde o primeiro mês",
      "Sem risco de inadimplência de equipamentos"
    ],
    praticidade: [
      "Zero burocracia para instalação",
      "Manutenção 100% nossa responsabilidade",
      "Monitoramento 24/7 via app",
      "Suporte técnico especializado"
    ],
    sustentabilidade: [
      "Redução de 2-4 toneladas de CO2/ano",
      "Energia 100% limpa e renovável",
      "Contribuição para futuro sustentável",
      "Valorização do imóvel"
    ],
    seguranca: [
      "Empresa estabelecida no mercado",
      "Equipamentos de primeira linha",
      "Garantias extensas",
      "Regulamentação ANEEL"
    ]
  },

  // CONCORRÊNCIA E POSICIONAMENTO
  competitive_analysis: {
    vs_compra_tradicional: {
      vantagem: "Sem investimento inicial de R$ 20.000-50.000",
      diferencial: "Manutenção e risco por nossa conta"
    },
    vs_financiamento: {
      vantagem: "Sem comprometimento de renda, sem análise de crédito complexa",
      diferencial: "Flexibilidade para mudança de imóvel"
    },
    vs_outros_alugueis: {
      vantagem: "Experiência consolidada, suporte especializado",
      diferencial: "Foco total no modelo de aluguel"
    }
  },

  // CASES DE SUCESSO (EXEMPLOS)
  success_cases: {
    residencial: {
      cliente: "Família Silva - Casa 120m²",
      conta_antes: "R$ 380/mês",
      economia: "R$ 57/mês (15%)",
      aluguel: "R$ 45/mês",
      economia_liquida: "R$ 12/mês + proteção contra aumentos"
    },
    comercial: {
      cliente: "Padaria do João - Comércio",
      conta_antes: "R$ 1.200/mês",
      economia: "R$ 240/mês (20%)",
      aluguel: "R$ 190/mês",
      economia_liquida: "R$ 50/mês + sustentabilidade"
    }
  },

  // PERGUNTAS FREQUENTES
  faq: {
    "como_funciona_tecnicamente": "As placas solares captam luz solar e convertem em energia elétrica através do efeito fotovoltaico. A energia é injetada na rede da distribuidora e você recebe créditos que abatam sua conta.",
    "e_se_nao_tiver_sol": "O sistema funciona mesmo em dias nublados, apenas com menor eficiência. Além disso, os créditos acumulam para usar quando necessário.",
    "posso_cancelar_contrato": "O contrato tem prazo determinado, mas oferecemos condições especiais para casos específicos. Consulte nossos termos.",
    "como_e_instalacao": "Nossa equipe técnica faz toda instalação em 1-2 dias, com mínima interferência na sua rotina.",
    "preciso_mudar_distribuidora": "Não! Continuamos trabalhando com sua distribuidora atual. Apenas adicionamos os créditos solares."
  }
};

// SISTEMA DE PERSONALIDADE PARA IA
const personalidadeIA = {
  tom: "Consultivo, amigável e especialista",
  abordagem: "Educativa primeiro, vendas depois",
  linguagem: "Clara, sem jargões técnicos excessivos",
  foco: "Benefícios práticos e economia real",
  credibilidade: "Dados concretos e cases reais",
  urgencia: "Sutil, baseada em oportunidades limitadas"
};

module.exports = {
  energiaaDossier,
  personalidadeIA
};