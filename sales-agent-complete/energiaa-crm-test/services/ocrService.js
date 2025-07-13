const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
// const { createWorker } = require('tesseract.js'); // Temporariamente desabilitado
const winston = require('winston');
const moment = require('moment-timezone');
const Client = require('../models/Client');
// const { validateCPF, validateCNPJ } = require('../utils/validation');
// const cv = require('opencv4nodejs'); // Para processamento avançado de imagem - requer cmake
// const pdf2pic = require('pdf2pic'); // Para conversão de PDF - temporariamente desabilitado

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/ocr.log' }),
    new winston.transports.Console()
  ]
});

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.supportedFormats = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.webp'];
    this.processingHistory = [];
    this.statistics = {
      totalProcessed: 0,
      successfulExtractions: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      errorCount: 0
    };
    
    // Templates avançados para diferentes tipos de fatura Energisa
    this.templates = {
      'energisa-padrao': {
        name: 'Energisa Padrão Residencial',
        description: 'Fatura residencial padrão da Energisa',
        confidence: 0.97,
        patterns: {
          // Identificação do cliente
          clienteNome: /(?:NOME[:\s]*|CLIENTE[:\s]*)([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{3,50})/i,
          numeroCliente: /(?:N[úu]mero do Cliente|Cliente|Nº Cliente)[:\s]*([0-9]{8,12})/i,
          numeroInstalacao: /(?:N[úu]mero da Instala[çc][ãa]o|Instala[çc][ãa]o|UC)[:\s]*([0-9]{8,15})/i,
          cpfCnpj: /(?:CPF|CNPJ)[:\s]*([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}|[0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/i,
          
          // Endereço completo
          endereco: /(?:Endere[çc]o de Instala[çc][ãa]o|Local de Instala[çc][ãa]o)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\n|CEP|Bairro)/i,
          bairro: /(?:Bairro)[:\s]*([A-Za-z\s]+)/i,
          cidade: /(?:Cidade|Munic[íi]pio)[:\s]*([A-Za-z\s]+)/i,
          cep: /CEP[:\s]*([0-9]{5}-?[0-9]{3})/i,
          
          // Dados de consumo
          consumoKwh: /(?:Consumo|Energia Ativa|kWh)[:\s]*([0-9]{1,6})[\s]*kWh/i,
          consumoMedio: /(?:M[ée]dia|Consumo M[ée]dio)[:\s]*([0-9]{1,6})[\s]*kWh/i,
          leituraAtual: /(?:Leitura Atual)[:\s]*([0-9]{1,8})/i,
          leituraAnterior: /(?:Leitura Anterior)[:\s]*([0-9]{1,8})/i,
          
          // Valores financeiros detalhados
          valorTotal: /(?:Total a Pagar|Valor Total|Total)[:\s]*R\$[\s]*([0-9]{1,6}(?:[.,][0-9]{2})?)/i,
          valorEnergia: /(?:Energia El[ée]trica|TE)[:\s]*R\$[\s]*([0-9]{1,6}(?:[.,][0-9]{2})?)/i,
          valorTusd: /(?:TUSD|Distribui[çc][ãa]o)[:\s]*R\$[\s]*([0-9]{1,6}(?:[.,][0-9]{2})?)/i,
          icms: /(?:ICMS)[:\s]*R\$[\s]*([0-9]{1,6}(?:[.,][0-9]{2})?)/i,
          pisCofins: /(?:PIS\/COFINS|PIS)[:\s]*R\$[\s]*([0-9]{1,6}(?:[.,][0-9]{2})?)/i,
          
          // Datas importantes
          dataVencimento: /(?:Vencimento|Data de Vencimento)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
          dataLeitura: /(?:Data de Leitura|Leitura)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
          periodoReferencia: /(?:Per[íi]odo|Refer[êe]ncia)[:\s]*([0-9]{1,2}\/[0-9]{4})/i,
          dataEmissao: /(?:Emiss[ãa]o)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
          
          // Classificação tarifária
          modalidade: /(?:Modalidade|Grupo|Subgrupo)[:\s]*([A-Z0-9\s-]+)/i,
          classe: /(?:Classe)[:\s]*([A-Za-z\s]+)/i,
          bandeiraTarifaria: /(?:Bandeira)[:\s]*([A-Za-z\s]+)/i,
          valorBandeira: /(?:Bandeira)[:\s]*[A-Za-z\s]+[:\s]*R\$[\s]*([0-9]{1,6}(?:[.,][0-9]{2})?)/i,
          
          // Código de barras
          codigoBarras: /([0-9]{47,48})/,
          
          // Histórico de consumo
          historicoConsumo: /([A-Z]{3}\/[0-9]{2})[\s]*([0-9]{1,6})[\s]*kWh/gi
        }
      },
      
      'energisa-comercial': {
        name: 'Energisa Comercial',
        description: 'Fatura comercial/empresarial da Energisa',
        confidence: 0.95,
        patterns: {
          // Identificação empresarial
          razaoSocial: /(?:RAZ[ÃA]O SOCIAL|EMPRESA)[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s&.-]{3,80})/i,
          nomeFantasia: /(?:NOME FANTASIA)[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s&.-]{3,50})/i,
          cnpj: /(?:CNPJ)[:\s]*([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/i,
          inscricaoEstadual: /(?:INSCRI[ÇC][ÃA]O ESTADUAL|I\.E\.)[:\s]*([0-9.-]+)/i,
          numeroCliente: /(?:N[úu]mero do Cliente|Cliente)[:\s]*([0-9]{8,12})/i,
          numeroInstalacao: /(?:N[úu]mero da Instala[çc][ãa]o|UC)[:\s]*([0-9]{8,15})/i,
          
          // Dados de consumo comercial
          consumoKwh: /(?:Consumo|Energia Ativa)[:\s]*([0-9]{1,8})[\s]*kWh/i,
          demandaKw: /(?:Demanda)[:\s]*([0-9]{1,6}(?:[.,][0-9]{1,2})?)[\s]*kW/i,
          demandaContratada: /(?:Demanda Contratada)[:\s]*([0-9]{1,6}(?:[.,][0-9]{1,2})?)[\s]*kW/i,
          fatorPotencia: /(?:Fator de Pot[êe]ncia|FP)[:\s]*([0-9],[0-9]{2})/i,
          
          // Valores comerciais
          valorTotal: /(?:Total a Pagar|Valor Total)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          valorEnergia: /(?:Energia El[ée]trica|TE)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          valorDemanda: /(?:Demanda)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          valorTusd: /(?:TUSD)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          icms: /(?:ICMS)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          pisCofins: /(?:PIS\/COFINS)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          
          // Classificação
          classe: /(?:Classe)[:\s]*(COMERCIAL|INDUSTRIAL)/i,
          grupo: /(?:Grupo)[:\s]*([AB][1-4])/i,
          modalidade: /(?:Modalidade)[:\s]*([A-Z\s-]+)/i,
          
          // Datas
          dataVencimento: /(?:Vencimento)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
          dataLeitura: /(?:Leitura)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
          periodoReferencia: /(?:Refer[êe]ncia)[:\s]*([0-9]{1,2}\/[0-9]{4})/i
        }
      },
      
      'energisa-industrial': {
        name: 'Energisa Industrial',
        description: 'Fatura industrial/alta tensão da Energisa',
        confidence: 0.92,
        patterns: {
          // Identificação industrial
          razaoSocial: /(?:RAZ[ÃA]O SOCIAL)[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s&.-]{3,80})/i,
          cnpj: /(?:CNPJ)[:\s]*([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/i,
          inscricaoEstadual: /(?:I\.E\.)[:\s]*([0-9.-]+)/i,
          numeroCliente: /(?:Cliente)[:\s]*([0-9]{8,12})/i,
          numeroInstalacao: /(?:UC)[:\s]*([0-9]{8,15})/i,
          
          // Consumo industrial (ponta/fora ponta)
          consumoPonta: /(?:Consumo.*Ponta|P)[:\s]*([0-9]{1,8})[\s]*kWh/i,
          consumoForaPonta: /(?:Consumo.*Fora.*Ponta|FP)[:\s]*([0-9]{1,8})[\s]*kWh/i,
          demandaPonta: /(?:Demanda.*Ponta)[:\s]*([0-9]{1,6}(?:[.,][0-9]{1,2})?)[\s]*kW/i,
          demandaForaPonta: /(?:Demanda.*Fora.*Ponta)[:\s]*([0-9]{1,6}(?:[.,][0-9]{1,2})?)[\s]*kW/i,
          demandaContratadaPonta: /(?:Dem\. Contratada.*Ponta)[:\s]*([0-9]{1,6}(?:[.,][0-9]{1,2})?)[\s]*kW/i,
          demandaContratadaForaPonta: /(?:Dem\. Contratada.*FP)[:\s]*([0-9]{1,6}(?:[.,][0-9]{1,2})?)[\s]*kW/i,
          
          // Energia reativa
          energiaReativa: /(?:Energia Reativa)[:\s]*([0-9]{1,8})[\s]*kVArh/i,
          fatorPotencia: /(?:Fator de Pot[êe]ncia)[:\s]*([0-9],[0-9]{2})/i,
          
          // Valores industriais
          valorTotal: /(?:Total)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          valorEnergiaPonta: /(?:TE.*Ponta)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          valorEnergiaForaPonta: /(?:TE.*FP)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          valorDemandaPonta: /(?:TUSD.*Ponta)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          valorDemandaForaPonta: /(?:TUSD.*FP)[:\s]*R\$[\s]*([0-9]{1,8}(?:[.,][0-9]{2})?)/i,
          
          // Classificação industrial
          classe: /(?:Classe)[:\s]*(INDUSTRIAL)/i,
          grupo: /(?:Grupo)[:\s]*(A[1-4])/i,
          tensao: /(?:Tens[ãa]o)[:\s]*([0-9,.]+ kV)/i,
          
          // Datas
          dataVencimento: /(?:Vencimento)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
          dataLeitura: /(?:Leitura)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
          periodoReferencia: /(?:Refer[êe]ncia)[:\s]*([0-9]{1,2}\/[0-9]{4})/i
        }
      }
    };
    
    // Regras de validação avançadas
    this.validationRules = {
      cpf: this.validateCPF.bind(this),
      cnpj: this.validateCNPJ.bind(this),
      date: this.validateDate.bind(this),
      currency: this.validateCurrency.bind(this),
      number: this.validateNumber.bind(this),
      instalacao: this.validateInstalacao.bind(this),
      consumo: this.validateConsumo.bind(this),
      businessRules: this.validateBusinessRules.bind(this)
    };
    
    this.initializeOCR();
  }

  async initializeOCR() {
    try {
      logger.info('Inicializando OCR Service (modo simulação)...');
      // Temporariamente desabilitado - requer instalação do tesseract.js
      // this.worker = await createWorker({
      //   logger: m => {
      //     if (m.status === 'recognizing text') {
      //       logger.info(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      //     }
      //   }
      // });
      
      // await this.worker.loadLanguage('por+eng');
      // await this.worker.initialize('por+eng');
      
      // Configurações otimizadas para faturas
      // await this.worker.setParameters({
      //   tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüý.,/-:()[]{}$%@#&*+=|\\"\' ',
      //   tessedit_pageseg_mode: '6', // Uniform block of text
      //   preserve_interword_spaces: '1'
      // });
      
      this.isInitialized = true;
      logger.info('OCR Service inicializado em modo simulação');
    } catch (error) {
      logger.error('Erro ao inicializar OCR:', error);
      throw error;
    }
  }

  async preprocessImage(imagePath) {
    try {
      const outputPath = imagePath.replace(/\.[^.]+$/, '_processed.png');
      
      await sharp(imagePath)
        .resize(null, 2000, { withoutEnlargement: true })
        .greyscale()
        .normalize()
        .sharpen()
        .threshold(128)
        .png({ quality: 100 })
        .toFile(outputPath);
      
      return outputPath;
    } catch (error) {
      logger.error('Erro no pré-processamento da imagem:', error);
      throw error;
    }
  }

  async convertPdfToImages(pdfPath) {
    try {
      const pdf2pic = require('pdf2pic');
      const outputDir = path.dirname(pdfPath);
      const baseName = path.basename(pdfPath, '.pdf');
      
      const convert = pdf2pic.fromPath(pdfPath, {
        density: 300,
        saveFilename: `${baseName}_page`,
        savePath: outputDir,
        format: 'png',
        width: 2000,
        height: 2800
      });
      
      const results = await convert.bulk(-1);
      return results.map(result => result.path);
    } catch (error) {
      logger.error('Erro ao converter PDF para imagens:', error);
      throw error;
    }
  }

  async processText(imagePath) {
    try {
      if (!this.isInitialized) {
        await this.initializeOCR();
      }

      logger.info(`Processando imagem (simulação): ${imagePath}`);
      
      // Simulação de texto extraído de uma fatura Energisa
      const simulatedText = `
        ENERGISA MINAS GERAIS
        FATURA DE ENERGIA ELÉTRICA
        
        NOME: JOÃO DA SILVA
        CPF: 123.456.789-00
        Número do Cliente: 123456789
        Número da Instalação: 987654321
        
        Endereço de Instalação: RUA DAS FLORES, 123
        Bairro: CENTRO
        Cidade: BELO HORIZONTE
        CEP: 30100-000
        
        Consumo: 350 kWh
        Média de Consumo: 320 kWh
        Leitura Atual: 12500
        Leitura Anterior: 12150
        
        Energia Elétrica: R$ 245,80
        TUSD: R$ 89,50
        ICMS: R$ 67,20
        PIS/COFINS: R$ 15,30
        Total a Pagar: R$ 417,80
        
        Data de Vencimento: 15/08/2024
        Data de Leitura: 20/07/2024
        Período de Referência: 07/2024
        
        Modalidade: CONVENCIONAL B1
        Classe: RESIDENCIAL
        Bandeira: VERDE
      `;
      
      logger.info('Texto extraído com sucesso (simulação)');
      return simulatedText;
    } catch (error) {
      logger.error('Erro ao processar texto:', error);
      throw error;
    }
  }

  extractDataFromText(text) {
    const data = {
      numeroCliente: null,
      numeroInstalacao: null,
      cpfCnpj: null,
      consumoKwh: null,
      consumoMedio: null,
      demandaKw: null,
      valorTotal: null,
      valorEnergia: null,
      valorTusd: null,
      valorTe: null,
      dataVencimento: null,
      dataLeitura: null,
      periodoReferencia: null,
      endereco: null,
      cep: null,
      modalidade: null,
      classe: null,
      bandeira: null,
      valorBandeira: null,
      historicoConsumo: [],
      confidence: 0
    };

    // Usar template padrão da Energisa para extração
    const template = this.templates['energisa-padrao'];
    
    // Extrair dados usando regex do template
    for (const [key, pattern] of Object.entries(template.patterns)) {
      if (key === 'historicoConsumo') {
        const matches = [...text.matchAll(pattern)];
        data[key] = matches.map(match => ({
          mes: match[1],
          consumo: parseInt(match[2])
        }));
      } else {
        const match = text.match(pattern);
        if (match) {
          data[key] = match[1].trim();
        }
      }
    }

    // Validações e limpeza
    if (data.cpfCnpj) {
      data.cpfCnpj = data.cpfCnpj.replace(/[^0-9]/g, '');
      data.tipoDocumento = data.cpfCnpj.length === 11 ? 'CPF' : 'CNPJ';
      data.documentoValido = data.tipoDocumento === 'CPF' ? 
        validateCPF(data.cpfCnpj) : validateCNPJ(data.cpfCnpj);
    }

    // Converter valores monetários
    ['valorTotal', 'valorEnergia', 'valorTusd', 'valorTe', 'valorBandeira'].forEach(field => {
      if (data[field]) {
        data[field] = parseFloat(data[field].replace(',', '.'));
      }
    });

    // Converter consumos
    ['consumoKwh', 'consumoMedio'].forEach(field => {
      if (data[field]) {
        data[field] = parseInt(data[field]);
      }
    });

    // Converter demanda
    if (data.demandaKw) {
      data.demandaKw = parseFloat(data.demandaKw.replace(',', '.'));
    }

    // Validar datas
    ['dataVencimento', 'dataLeitura'].forEach(field => {
      if (data[field]) {
        const date = moment(data[field], 'DD/MM/YYYY');
        data[field] = date.isValid() ? date.toDate() : null;
      }
    });

    // Calcular confidence baseado nos campos preenchidos
    const totalFields = Object.keys(data).length - 1; // -1 para excluir confidence
    const filledFields = Object.values(data).filter(value => 
      value !== null && value !== undefined && value !== ''
    ).length;
    data.confidence = Math.round((filledFields / totalFields) * 100);

    return data;
  }

  async processInvoice(filePath, clientId = null) {
    try {
      if (!this.isInitialized) {
        await this.initializeOCR();
      }

      logger.info(`Processando fatura: ${filePath}`);
      
      const fileExt = path.extname(filePath).toLowerCase();
      let imagePaths = [];

      if (fileExt === '.pdf') {
        imagePaths = await this.convertPdfToImages(filePath);
      } else if (this.supportedFormats.includes(fileExt)) {
        imagePaths = [filePath];
      } else {
        throw new Error(`Formato de arquivo não suportado: ${fileExt}`);
      }

      let allText = '';
      let bestConfidence = 0;
      let bestData = null;

      for (const imagePath of imagePaths) {
        try {
          // Pré-processar imagem
          const processedPath = await this.preprocessImage(imagePath);
          
          // Executar OCR (simulação)
          const text = await this.processText(processedPath);
          const confidence = 85; // Simulação de confidence
          
          allText += text + '\n';
          
          // Extrair dados estruturados
          const extractedData = this.extractDataFromText(text);
          extractedData.ocrConfidence = confidence;
          
          if (extractedData.confidence > bestConfidence) {
            bestConfidence = extractedData.confidence;
            bestData = extractedData;
          }
          
          // Limpar arquivo processado
          await fs.remove(processedPath);
          
        } catch (pageError) {
          logger.error(`Erro ao processar página ${imagePath}:`, pageError);
        }
      }

      // Limpar imagens temporárias do PDF
      if (fileExt === '.pdf') {
        for (const imagePath of imagePaths) {
          await fs.remove(imagePath).catch(() => {});
        }
      }

      if (!bestData) {
        throw new Error('Não foi possível extrair dados da fatura');
      }

      // Adicionar metadados
      bestData.processedAt = new Date();
      bestData.fileName = path.basename(filePath);
      bestData.fileSize = (await fs.stat(filePath)).size;
      bestData.rawText = allText;

      // Associar ao cliente se fornecido
      if (clientId && bestData.cpfCnpj) {
        await this.associateInvoiceToClient(clientId, bestData);
      }

      logger.info(`Fatura processada com sucesso. Confidence: ${bestData.confidence}%`);
      return bestData;

    } catch (error) {
      logger.error('Erro ao processar fatura:', error);
      throw error;
    }
  }

  async associateInvoiceToClient(clientId, invoiceData) {
    try {
      const client = await Client.findById(clientId);
      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      // Verificar se o documento da fatura corresponde ao cliente
      if (invoiceData.cpfCnpj && client.cpf !== invoiceData.cpfCnpj && client.cnpj !== invoiceData.cpfCnpj) {
        logger.warn(`Documento da fatura (${invoiceData.cpfCnpj}) não corresponde ao cliente ${clientId}`);
      }

      // Atualizar dados do cliente com informações da fatura
      const updateData = {
        'energyData.numeroCliente': invoiceData.numeroCliente,
        'energyData.numeroInstalacao': invoiceData.numeroInstalacao,
        'energyData.consumoMedioKwh': invoiceData.consumoMedio || invoiceData.consumoKwh,
        'energyData.demandaKw': invoiceData.demandaKw,
        'energyData.modalidadeTarifaria': invoiceData.modalidade,
        'energyData.classe': invoiceData.classe,
        'energyData.valorContaMensal': invoiceData.valorTotal,
        'energyData.historicoConsumo': invoiceData.historicoConsumo,
        'energyData.ultimaFaturaProcessada': new Date()
      };

      // Atualizar endereço se não existir
      if (invoiceData.endereco && !client.endereco.logradouro) {
        updateData['endereco.logradouro'] = invoiceData.endereco;
        updateData['endereco.cep'] = invoiceData.cep;
      }

      await Client.findByIdAndUpdate(clientId, { $set: updateData });
      
      // Adicionar fatura ao histórico
      await Client.findByIdAndUpdate(clientId, {
        $push: {
          'energyData.faturas': {
            data: invoiceData.dataLeitura || new Date(),
            consumo: invoiceData.consumoKwh,
            valor: invoiceData.valorTotal,
            periodo: invoiceData.periodoReferencia,
            confidence: invoiceData.confidence,
            processedAt: new Date()
          }
        }
      });

      logger.info(`Fatura associada ao cliente ${clientId} com sucesso`);
    } catch (error) {
      logger.error('Erro ao associar fatura ao cliente:', error);
      throw error;
    }
  }

  async batchProcessInvoices(invoicesDir, clientMapping = {}) {
    try {
      const files = await fs.readdir(invoicesDir);
      const results = [];

      for (const file of files) {
        const filePath = path.join(invoicesDir, file);
        const fileExt = path.extname(file).toLowerCase();
        
        if (this.supportedFormats.includes(fileExt)) {
          try {
            const clientId = clientMapping[file] || null;
            const result = await this.processInvoice(filePath, clientId);
            results.push({
              file,
              success: true,
              data: result
            });
          } catch (error) {
            results.push({
              file,
              success: false,
              error: error.message
            });
          }
        }
      }

      return results;
    } catch (error) {
      logger.error('Erro no processamento em lote:', error);
      throw error;
    }
  }

  async validateInvoiceData(data) {
    const errors = [];
    const warnings = [];

    // Validações obrigatórias
    if (!data.numeroCliente) errors.push('Número do cliente não encontrado');
    if (!data.consumoKwh && !data.consumoMedio) errors.push('Consumo não encontrado');
    if (!data.valorTotal) errors.push('Valor total não encontrado');
    if (!data.cpfCnpj) errors.push('CPF/CNPJ não encontrado');
    
    // Validações de consistência
    if (data.cpfCnpj && !data.documentoValido) {
      errors.push('CPF/CNPJ inválido');
    }
    
    if (data.consumoKwh && (data.consumoKwh < 0 || data.consumoKwh > 50000)) {
      warnings.push('Consumo fora da faixa esperada');
    }
    
    if (data.valorTotal && (data.valorTotal < 0 || data.valorTotal > 10000)) {
      warnings.push('Valor total fora da faixa esperada');
    }
    
    if (data.confidence < 70) {
      warnings.push('Baixa confiança na extração de dados');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence: data.confidence
    };
  }

  // Funções de validação avançadas
  validateCPF(cpf) {
    if (!cpf) return false;
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Validar dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let digit1 = 11 - (sum % 11);
    if (digit1 > 9) digit1 = 0;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    let digit2 = 11 - (sum % 11);
    if (digit2 > 9) digit2 = 0;
    
    return parseInt(cpf.charAt(9)) === digit1 && parseInt(cpf.charAt(10)) === digit2;
  }

  validateCNPJ(cnpj) {
    if (!cnpj) return false;
    cnpj = cnpj.replace(/[^\d]/g, '');
    if (cnpj.length !== 14) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
    
    // Validar primeiro dígito verificador
    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj.charAt(i)) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    
    // Validar segundo dígito verificador
    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj.charAt(i)) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    
    return parseInt(cnpj.charAt(12)) === digit1 && parseInt(cnpj.charAt(13)) === digit2;
  }

  validateDate(dateStr) {
    if (!dateStr) return false;
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(dateRegex);
    if (!match) return false;
    
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > new Date().getFullYear() + 1) return false;
    
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  }

  validateCurrency(value) {
    if (!value) return false;
    const numValue = parseFloat(value.toString().replace(',', '.'));
    return !isNaN(numValue) && numValue >= 0 && numValue <= 999999;
  }

  validateNumber(value, min = 0, max = 999999) {
    if (!value) return false;
    const numValue = parseFloat(value.toString().replace(',', '.'));
    return !isNaN(numValue) && numValue >= min && numValue <= max;
  }

  validateInstalacao(instalacao) {
    if (!instalacao) return false;
    const cleanInstalacao = instalacao.toString().replace(/[^\d]/g, '');
    return cleanInstalacao.length >= 8 && cleanInstalacao.length <= 15;
  }

  validateConsumo(consumo) {
    if (!consumo) return false;
    const numConsumo = parseInt(consumo);
    return !isNaN(numConsumo) && numConsumo >= 0 && numConsumo <= 50000;
  }

  validateBusinessRules(data) {
    const issues = [];
    
    // Verificar consistência entre leituras
    if (data.leituraAtual && data.leituraAnterior) {
      const consumoCalculado = data.leituraAtual - data.leituraAnterior;
      if (data.consumoKwh && Math.abs(consumoCalculado - data.consumoKwh) > data.consumoKwh * 0.1) {
        issues.push('Inconsistência entre leituras e consumo informado');
      }
    }
    
    // Verificar se o valor total é consistente com os componentes
    if (data.valorEnergia && data.valorTusd && data.valorTotal) {
      const somaComponentes = (data.valorEnergia || 0) + (data.valorTusd || 0) + (data.icms || 0) + (data.pisCofins || 0);
      if (Math.abs(somaComponentes - data.valorTotal) > data.valorTotal * 0.15) {
        issues.push('Inconsistência entre valor total e componentes');
      }
    }
    
    // Verificar se a data de vencimento é futura
    if (data.dataVencimento) {
      const vencimento = moment(data.dataVencimento, 'DD/MM/YYYY');
      const hoje = moment();
      if (vencimento.isBefore(hoje.subtract(60, 'days'))) {
        issues.push('Data de vencimento muito antiga');
      }
    }
    
    return issues;
  }

  async getProcessingStats() {
    try {
      return {
        totalProcessed: this.statistics.totalProcessed,
        successRate: this.statistics.totalProcessed > 0 ? 
          (this.statistics.successfulExtractions / this.statistics.totalProcessed) * 100 : 0,
        averageConfidence: this.statistics.averageConfidence,
        errorCount: this.statistics.errorCount,
        processingTime: {
          average: this.statistics.averageProcessingTime,
          min: 0,
          max: 0
        },
        recentProcessing: this.processingHistory.slice(-10)
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.worker) {
        // await this.worker.terminate(); // Temporariamente desabilitado
        this.worker = null;
        this.isInitialized = false;
        logger.info('OCR service finalizado');
      }
    } catch (error) {
      logger.error('Erro ao finalizar OCR:', error);
    }
  }
}

module.exports = new OCRService();