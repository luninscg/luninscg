const fs = require('fs-extra');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const winston = require('winston');
const Client = require('../models/Client');
const simulationService = require('./simulationService');
// const { formatCurrency, formatNumber } = require('../utils/formatters'); // Temporariamente desabilitado

// Funções de formatação temporárias
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
};

const formatNumber = (value, decimals = 0) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value || 0);
};

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/proposal.log' }),
    new winston.transports.Console()
  ]
});

class ProposalService {
  constructor() {
    this.templatesPath = path.join(__dirname, '../templates/proposals');
    this.outputPath = path.join(__dirname, '../generated/proposals');
    this.initializeTemplates();
  }

  async initializeTemplates() {
    try {
      await fs.ensureDir(this.templatesPath);
      await fs.ensureDir(this.outputPath);
      
      // Registrar helpers do Handlebars
      this.registerHandlebarsHelpers();
      
      logger.info('Serviço de propostas inicializado');
    } catch (error) {
      logger.error('Erro ao inicializar templates:', error);
    }
  }

  registerHandlebarsHelpers() {
    // Helper para formatação de moeda
    handlebars.registerHelper('currency', (value) => {
      return formatCurrency(value);
    });

    // Helper para formatação de números
    handlebars.registerHelper('number', (value, decimals = 0) => {
      return formatNumber(value, decimals);
    });

    // Helper para formatação de datas
    handlebars.registerHelper('date', (date, format = 'DD/MM/YYYY') => {
      return moment(date).format(format);
    });

    // Helper para cálculos
    handlebars.registerHelper('calculate', (value1, operator, value2) => {
      const v1 = parseFloat(value1) || 0;
      const v2 = parseFloat(value2) || 0;
      
      switch (operator) {
        case '+': return v1 + v2;
        case '-': return v1 - v2;
        case '*': return v1 * v2;
        case '/': return v2 !== 0 ? v1 / v2 : 0;
        case '%': return v2 !== 0 ? (v1 / v2) * 100 : 0;
        default: return 0;
      }
    });

    // Helper para condicionais
    handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // Helper para loops com índice
    handlebars.registerHelper('times', function(n, options) {
      let result = '';
      for (let i = 0; i < n; i++) {
        result += options.fn({ index: i, number: i + 1 });
      }
      return result;
    });
  }

  async generateProposal(clientId, options = {}) {
    try {
      logger.info(`Gerando proposta para cliente ${clientId}`);
      
      // Buscar dados do cliente
      const client = await Client.findById(clientId).lean();
      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      // Executar simulação se não existir ou se forçada
      let simulation = client.simulation;
      if (!simulation || options.forceNewSimulation) {
        simulation = await simulationService.calculateSimulation({
          consumoMedioKwh: client.energyData?.consumoMedioKwh || 300,
          valorContaMensal: client.energyData?.valorContaMensal || 200,
          estado: client.endereco?.estado || 'SP',
          cidade: client.endereco?.cidade || 'São Paulo',
          tipoTelhado: client.energyData?.tipoTelhado || 'ceramico',
          orientacao: client.energyData?.orientacao || 'sul',
          sombreamento: client.energyData?.sombreamento || 'nenhum'
        });
        
        // Salvar simulação no cliente
        await simulationService.saveSimulationToClient(clientId, simulation);
      }

      // Preparar dados para a proposta
      const proposalData = await this.prepareProposalData(client, simulation, options);
      
      // Gerar proposta baseada no template
      const templateType = options.templateType || this.selectBestTemplate(proposalData);
      const proposal = await this.renderProposal(templateType, proposalData);
      
      // Salvar proposta
      const proposalPath = await this.saveProposal(clientId, proposal, options.format || 'pdf');
      
      // Registrar no cliente
      await this.registerProposalInClient(clientId, {
        templateType,
        generatedAt: new Date(),
        filePath: proposalPath,
        simulation: simulation,
        options
      });

      logger.info(`Proposta gerada com sucesso: ${proposalPath}`);
      
      return {
        success: true,
        filePath: proposalPath,
        data: proposalData,
        simulation
      };

    } catch (error) {
      logger.error('Erro ao gerar proposta:', error);
      throw error;
    }
  }

  async prepareProposalData(client, simulation, options) {
    const now = moment().tz('America/Sao_Paulo');
    
    return {
      // Dados da empresa
      empresa: {
        nome: process.env.ENERGIAA_COMPANY_NAME || 'Energiaa',
        website: process.env.ENERGIAA_WEBSITE || 'https://energiaa.com.br',
        telefone: process.env.ENERGIAA_PHONE || '+55 11 99999-9999',
        email: process.env.ENERGIAA_EMAIL || 'contato@energiaa.com.br',
        endereco: process.env.ENERGIAA_ADDRESS || 'São Paulo, SP',
        cnpj: process.env.ENERGIAA_CNPJ || '00.000.000/0001-00'
      },
      
      // Dados do cliente
      cliente: {
        nome: client.nome,
        email: client.email,
        telefone: client.telefone,
        cpf: client.cpf,
        cnpj: client.cnpj,
        endereco: client.endereco,
        numeroCliente: client.energyData?.numeroCliente,
        numeroInstalacao: client.energyData?.numeroInstalacao
      },
      
      // Dados energéticos atuais
      situacaoAtual: {
        consumoMedio: client.energyData?.consumoMedioKwh || simulation.input.consumoMedioKwh,
        valorConta: client.energyData?.valorContaMensal || simulation.input.valorContaMensal,
        tarifaKwh: simulation.input.tarifaKwh,
        modalidade: client.energyData?.modalidadeTarifaria,
        classe: client.energyData?.classe,
        historicoConsumo: client.energyData?.historicoConsumo || []
      },
      
      // Simulação e dimensionamento
      sistema: {
        potenciaKwp: simulation.dimensionamento.potenciaKwp,
        numeroModulos: simulation.dimensionamento.numeroModulos,
        potenciaModulo: simulation.dimensionamento.potenciaModulo,
        areaOcupada: simulation.dimensionamento.areaOcupada,
        geracaoMensal: simulation.dimensionamento.geracaoMensalKwh,
        geracaoAnual: simulation.dimensionamento.geracaoAnualKwh,
        eficiencia: simulation.parametros.eficienciaPainel,
        perdas: simulation.parametros.perdas
      },
      
      // Economia e financeiro
      economia: {
        economiaPercentual: simulation.economia.economiaPercentual,
        economiaMensal: simulation.economia.economiaMensal,
        economiaAnual: simulation.economia.economiaAnual,
        economiaTotal25Anos: simulation.economia.economiaTotal25Anos,
        valorAluguelMensal: simulation.aluguel.valorMensal,
        contaComAluguel: simulation.aluguel.contaFinal,
        payback: simulation.financeiro.payback,
        roi: simulation.financeiro.roi,
        tir: simulation.financeiro.tir
      },
      
      // Projeções
      projecoes: {
        ano1: this.calculateYearProjection(simulation, 1),
        ano5: this.calculateYearProjection(simulation, 5),
        ano10: this.calculateYearProjection(simulation, 10),
        ano25: this.calculateYearProjection(simulation, 25)
      },
      
      // Impacto ambiental
      impactoAmbiental: {
        co2Evitado: simulation.impactoAmbiental.co2EvitadoAnual,
        arvoresEquivalentes: simulation.impactoAmbiental.arvoresEquivalentes,
        carrosRetirados: simulation.impactoAmbiental.carrosRetirados
      },
      
      // Dados da proposta
      proposta: {
        numero: this.generateProposalNumber(),
        dataGeracao: now.toDate(),
        dataValidade: now.add(30, 'days').toDate(),
        versao: '1.0',
        observacoes: options.observacoes || '',
        condicoes: this.getTermsAndConditions(),
        garantias: this.getWarranties()
      },
      
      // Configurações
      config: {
        mostrarDetalhes: options.showDetails !== false,
        mostrarGraficos: options.showCharts !== false,
        mostrarComparacao: options.showComparison !== false,
        idioma: options.language || 'pt-BR'
      }
    };
  }

  calculateYearProjection(simulation, year) {
    const degradacao = Math.pow(1 - simulation.parametros.degradacaoAnual, year - 1);
    const inflacao = Math.pow(1.04, year - 1); // 4% ao ano
    
    return {
      geracao: simulation.dimensionamento.geracaoAnualKwh * degradacao,
      economia: simulation.economia.economiaAnual * degradacao * inflacao,
      valorAluguel: simulation.aluguel.valorMensal * 12 * inflacao,
      contaFinal: simulation.aluguel.contaFinal * inflacao
    };
  }

  selectBestTemplate(proposalData) {
    // Lógica para selecionar o melhor template baseado nos dados
    const consumo = proposalData.situacaoAtual.consumoMedio;
    const economia = proposalData.economia.economiaPercentual;
    
    if (consumo > 1000) {
      return 'comercial';
    } else if (economia > 20) {
      return 'residencial-premium';
    } else {
      return 'residencial-standard';
    }
  }

  async renderProposal(templateType, data) {
    try {
      const templatePath = path.join(this.templatesPath, `${templateType}.hbs`);
      
      // Verificar se template existe, senão usar padrão
      if (!await fs.pathExists(templatePath)) {
        await this.createDefaultTemplate(templateType);
      }
      
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const template = handlebars.compile(templateContent);
      
      return template(data);
    } catch (error) {
      logger.error('Erro ao renderizar template:', error);
      throw error;
    }
  }

  async createDefaultTemplate(templateType) {
    const templatePath = path.join(this.templatesPath, `${templateType}.hbs`);
    
    const defaultTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proposta Energiaa - {{cliente.nome}}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #2E8B57, #32CD32);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .section {
            background: #f8f9fa;
            padding: 25px;
            margin-bottom: 20px;
            border-radius: 8px;
            border-left: 4px solid #2E8B57;
        }
        
        .section h2 {
            color: #2E8B57;
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .card h3 {
            color: #2E8B57;
            margin-bottom: 10px;
        }
        
        .highlight {
            background: #e8f5e8;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        
        .value {
            font-size: 1.8em;
            font-weight: bold;
            color: #2E8B57;
        }
        
        .savings {
            background: linear-gradient(135deg, #32CD32, #228B22);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .table th,
        .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        .table th {
            background: #2E8B57;
            color: white;
        }
        
        .footer {
            background: #333;
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px;
            margin-top: 30px;
        }
        
        @media print {
            .container {
                max-width: none;
                margin: 0;
                padding: 0;
            }
            
            .section {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Cabeçalho -->
        <div class="header">
            <h1>{{empresa.nome}}</h1>
            <p>Proposta de Energia Solar - {{cliente.nome}}</p>
            <p>Proposta Nº {{proposta.numero}} | {{date proposta.dataGeracao}}</p>
        </div>

        <!-- Dados do Cliente -->
        <div class="section">
            <h2>📋 Dados do Cliente</h2>
            <div class="grid">
                <div>
                    <strong>Nome:</strong> {{cliente.nome}}<br>
                    <strong>Email:</strong> {{cliente.email}}<br>
                    <strong>Telefone:</strong> {{cliente.telefone}}
                </div>
                <div>
                    <strong>Endereço:</strong><br>
                    {{cliente.endereco.logradouro}}<br>
                    {{cliente.endereco.cidade}} - {{cliente.endereco.estado}}<br>
                    CEP: {{cliente.endereco.cep}}
                </div>
            </div>
        </div>

        <!-- Situação Atual -->
        <div class="section">
            <h2>⚡ Situação Atual</h2>
            <div class="grid">
                <div class="card">
                    <h3>Consumo Médio</h3>
                    <div class="value">{{number situacaoAtual.consumoMedio}} kWh/mês</div>
                </div>
                <div class="card">
                    <h3>Valor da Conta</h3>
                    <div class="value">{{currency situacaoAtual.valorConta}}/mês</div>
                </div>
            </div>
        </div>

        <!-- Sistema Proposto -->
        <div class="section">
            <h2>🔆 Sistema Solar Proposto</h2>
            <div class="grid">
                <div class="card">
                    <h3>Potência</h3>
                    <div class="value">{{number sistema.potenciaKwp 2}} kWp</div>
                </div>
                <div class="card">
                    <h3>Módulos</h3>
                    <div class="value">{{sistema.numeroModulos}} unidades</div>
                </div>
                <div class="card">
                    <h3>Geração Mensal</h3>
                    <div class="value">{{number sistema.geracaoMensal}} kWh</div>
                </div>
                <div class="card">
                    <h3>Área Ocupada</h3>
                    <div class="value">{{number sistema.areaOcupada}} m²</div>
                </div>
            </div>
        </div>

        <!-- Economia -->
        <div class="savings">
            <h2>💰 Sua Economia com a Energiaa</h2>
            <div class="grid">
                <div>
                    <h3>Economia Mensal</h3>
                    <div class="value">{{currency economia.economiaMensal}}</div>
                </div>
                <div>
                    <h3>Economia em 25 anos</h3>
                    <div class="value">{{currency economia.economiaTotal25Anos}}</div>
                </div>
            </div>
            <div class="highlight">
                <h3>🎯 Modelo de Aluguel Energiaa</h3>
                <p><strong>Valor do Aluguel:</strong> {{currency economia.valorAluguelMensal}}/mês</p>
                <p><strong>Sua nova conta:</strong> {{currency economia.contaComAluguel}}/mês</p>
                <p><strong>Economia garantida:</strong> {{number economia.economiaPercentual}}%</p>
            </div>
        </div>

        <!-- Impacto Ambiental -->
        <div class="section">
            <h2>🌱 Impacto Ambiental</h2>
            <div class="grid">
                <div class="card">
                    <h3>CO₂ Evitado/Ano</h3>
                    <div class="value">{{number impactoAmbiental.co2Evitado}} kg</div>
                </div>
                <div class="card">
                    <h3>Equivale a</h3>
                    <div class="value">{{number impactoAmbiental.arvoresEquivalentes}} árvores</div>
                </div>
            </div>
        </div>

        <!-- Projeções -->
        <div class="section">
            <h2>📈 Projeções de Economia</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Ano</th>
                        <th>Geração (kWh)</th>
                        <th>Economia</th>
                        <th>Aluguel</th>
                        <th>Conta Final</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1º Ano</td>
                        <td>{{number projecoes.ano1.geracao}}</td>
                        <td>{{currency projecoes.ano1.economia}}</td>
                        <td>{{currency projecoes.ano1.valorAluguel}}</td>
                        <td>{{currency projecoes.ano1.contaFinal}}</td>
                    </tr>
                    <tr>
                        <td>5º Ano</td>
                        <td>{{number projecoes.ano5.geracao}}</td>
                        <td>{{currency projecoes.ano5.economia}}</td>
                        <td>{{currency projecoes.ano5.valorAluguel}}</td>
                        <td>{{currency projecoes.ano5.contaFinal}}</td>
                    </tr>
                    <tr>
                        <td>10º Ano</td>
                        <td>{{number projecoes.ano10.geracao}}</td>
                        <td>{{currency projecoes.ano10.economia}}</td>
                        <td>{{currency projecoes.ano10.valorAluguel}}</td>
                        <td>{{currency projecoes.ano10.contaFinal}}</td>
                    </tr>
                    <tr>
                        <td>25º Ano</td>
                        <td>{{number projecoes.ano25.geracao}}</td>
                        <td>{{currency projecoes.ano25.economia}}</td>
                        <td>{{currency projecoes.ano25.valorAluguel}}</td>
                        <td>{{currency projecoes.ano25.contaFinal}}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Condições -->
        <div class="section">
            <h2>📋 Condições da Proposta</h2>
            <ul>
                {{#each proposta.condicoes}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
            
            <h3>🛡️ Garantias</h3>
            <ul>
                {{#each proposta.garantias}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
        </div>

        <!-- Rodapé -->
        <div class="footer">
            <h3>{{empresa.nome}}</h3>
            <p>{{empresa.website}} | {{empresa.telefone}} | {{empresa.email}}</p>
            <p>{{empresa.endereco}} | CNPJ: {{empresa.cnpj}}</p>
            <p><strong>Proposta válida até:</strong> {{date proposta.dataValidade}}</p>
        </div>
    </div>
</body>
</html>
    `;
    
    await fs.writeFile(templatePath, defaultTemplate);
    logger.info(`Template padrão criado: ${templateType}`);
  }

  async saveProposal(clientId, htmlContent, format = 'pdf') {
    try {
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const fileName = `proposta_${clientId}_${timestamp}`;
      
      if (format === 'html') {
        const filePath = path.join(this.outputPath, `${fileName}.html`);
        await fs.writeFile(filePath, htmlContent);
        return filePath;
      } else {
        // Gerar PDF
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const filePath = path.join(this.outputPath, `${fileName}.pdf`);
        await page.pdf({
          path: filePath,
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
          }
        });
        
        await browser.close();
        return filePath;
      }
    } catch (error) {
      logger.error('Erro ao salvar proposta:', error);
      throw error;
    }
  }

  async registerProposalInClient(clientId, proposalInfo) {
    try {
      await Client.findByIdAndUpdate(clientId, {
        $push: {
          propostas: proposalInfo
        },
        $set: {
          ultimaPropostaGerada: proposalInfo.generatedAt
        }
      });
    } catch (error) {
      logger.error('Erro ao registrar proposta no cliente:', error);
    }
  }

  generateProposalNumber() {
    const now = moment();
    const year = now.format('YYYY');
    const month = now.format('MM');
    const day = now.format('DD');
    const time = now.format('HHmmss');
    
    return `ENE-${year}${month}${day}-${time}`;
  }

  getTermsAndConditions() {
    return [
      'Proposta válida por 30 dias a partir da data de emissão',
      'Instalação realizada em até 60 dias após aprovação',
      'Projeto sujeito à aprovação da concessionária local',
      'Valores podem sofrer alteração conforme variação do dólar',
      'Garantia de 25 anos para os módulos fotovoltaicos',
      'Garantia de 12 anos para inversores',
      'Monitoramento remoto incluído por 25 anos',
      'Manutenção preventiva anual incluída'
    ];
  }

  getWarranties() {
    return [
      'Garantia de performance dos módulos: 25 anos',
      'Garantia dos inversores: 12 anos',
      'Garantia da instalação: 5 anos',
      'Garantia de geração mínima: 90% do projetado',
      'Seguro contra danos climáticos: 20 anos',
      'Suporte técnico 24/7 via aplicativo'
    ];
  }

  async getProposalHistory(clientId) {
    try {
      const client = await Client.findById(clientId).select('propostas').lean();
      return client?.propostas || [];
    } catch (error) {
      logger.error('Erro ao buscar histórico de propostas:', error);
      return [];
    }
  }

  async deleteProposal(clientId, proposalId) {
    try {
      const client = await Client.findById(clientId);
      const proposal = client.propostas.id(proposalId);
      
      if (proposal && proposal.filePath) {
        await fs.remove(proposal.filePath).catch(() => {});
      }
      
      await Client.findByIdAndUpdate(clientId, {
        $pull: { propostas: { _id: proposalId } }
      });
      
      return true;
    } catch (error) {
      logger.error('Erro ao deletar proposta:', error);
      return false;
    }
  }

  async getProposalStats() {
    try {
      const stats = await Client.aggregate([
        { $unwind: '$propostas' },
        {
          $group: {
            _id: null,
            totalPropostas: { $sum: 1 },
            proposalsPorMes: {
              $push: {
                mes: { $dateToString: { format: '%Y-%m', date: '$propostas.generatedAt' } },
                template: '$propostas.templateType'
              }
            }
          }
        }
      ]);
      
      return stats[0] || { totalPropostas: 0, proposalsPorMes: [] };
    } catch (error) {
      logger.error('Erro ao obter estatísticas de propostas:', error);
      return { totalPropostas: 0, proposalsPorMes: [] };
    }
  }
}

module.exports = new ProposalService();