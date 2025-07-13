/**
 * SERVIÇO DE SIMULAÇÃO DE ECONOMIA SOLAR
 * Sistema avançado de cálculo de economia para Energiaa
 */

const axios = require('axios');
const ClientModel = require('../models/Client');

class SimulationService {
  constructor() {
    // Dados base para simulação
    this.solarData = {
      // Irradiação solar média por região (kWh/m²/dia)
      irradiation: {
        'norte': 5.5,
        'nordeste': 6.2,
        'centro-oeste': 5.8,
        'sudeste': 5.2,
        'sul': 4.8,
        'default': 5.5
      },
      
      // Eficiência dos painéis (%) por tipo
      panelEfficiency: {
        'monocristalino': 0.22,
        'policristalino': 0.18,
        'filme-fino': 0.12,
        'default': 0.20
      },
      
      // Fatores de perda do sistema
      systemLosses: {
        inversor: 0.03,        // 3% perda no inversor
        cabeamento: 0.02,      // 2% perda nos cabos
        sujeira: 0.05,         // 5% perda por sujeira
        temperatura: 0.08,     // 8% perda por temperatura
        sombreamento: 0.03,    // 3% perda por sombreamento
        degradacao: 0.005      // 0.5% degradação anual
      },
      
      // Preços médios por kWp instalado
      pricePerKwp: {
        'residencial': 4500,   // R$ por kWp
        'comercial': 4200,     // R$ por kWp
        'industrial': 3800,    // R$ por kWp
        'rural': 4000          // R$ por kWp
      },
      
      // Tarifas médias de energia por região (R$/kWh)
      energyTariffs: {
        'norte': 0.65,
        'nordeste': 0.58,
        'centro-oeste': 0.62,
        'sudeste': 0.68,
        'sul': 0.59,
        'default': 0.62
      },
      
      // Bandeiras tarifárias
      tariffFlags: {
        'verde': 0,
        'amarela': 0.01874,
        'vermelha-1': 0.03971,
        'vermelha-2': 0.09492
      }
    };
    
    // Configurações do modelo de aluguel Energiaa
    this.rentalModel = {
      // Percentual de economia garantida
      guaranteedSavings: 0.15, // 15% mínimo
      
      // Percentual médio de economia
      averageSavings: 0.25, // 25% em média
      
      // Percentual máximo de economia
      maxSavings: 0.35, // 35% máximo
      
      // Taxa de administração Energiaa
      adminFee: 0.10, // 10% sobre a economia
      
      // Valor mínimo de conta para viabilidade
      minMonthlyBill: 150, // R$ 150/mês
      
      // Período mínimo de contrato
      minContractPeriod: 12, // 12 meses
      
      // Período padrão de contrato
      defaultContractPeriod: 24, // 24 meses
      
      // Período máximo de contrato
      maxContractPeriod: 60 // 60 meses
    };
  }

  /**
   * Simulação principal de economia solar
   */
  async simulateEconomy(clientData) {
    try {
      console.log('🔄 Iniciando simulação de economia solar...');
      
      // Validar dados de entrada
      const validatedData = this.validateInputData(clientData);
      if (!validatedData.isValid) {
        return {
          success: false,
          error: validatedData.errors,
          message: 'Dados insuficientes para simulação'
        };
      }
      
      // Obter dados complementares
      const enrichedData = await this.enrichClientData(validatedData.data);
      
      // Calcular consumo e perfil energético
      const energyProfile = this.calculateEnergyProfile(enrichedData);
      
      // Calcular dimensionamento do sistema
      const systemSizing = this.calculateSystemSizing(energyProfile, enrichedData);
      
      // Calcular economia com modelo de aluguel
      const economyCalculation = this.calculateRentalEconomy(energyProfile, systemSizing, enrichedData);
      
      // Calcular métricas financeiras
      const financialMetrics = this.calculateFinancialMetrics(economyCalculation, enrichedData);
      
      // Gerar projeções
      const projections = this.generateProjections(economyCalculation, financialMetrics, enrichedData);
      
      // Calcular impacto ambiental
      const environmentalImpact = this.calculateEnvironmentalImpact(systemSizing, enrichedData);
      
      // Montar resultado final
      const simulation = {
        success: true,
        timestamp: new Date(),
        clientData: enrichedData,
        energyProfile,
        systemSizing,
        economyCalculation,
        financialMetrics,
        projections,
        environmentalImpact,
        recommendations: this.generateRecommendations(economyCalculation, financialMetrics)
      };
      
      console.log('✅ Simulação concluída com sucesso');
      return simulation;
      
    } catch (error) {
      console.error('❌ Erro na simulação:', error);
      return {
        success: false,
        error: error.message,
        message: 'Erro interno na simulação'
      };
    }
  }

  /**
   * Validar dados de entrada
   */
  validateInputData(data) {
    const errors = [];
    const requiredFields = ['monthlyBill', 'propertyType', 'location'];
    
    // Verificar campos obrigatórios
    for (const field of requiredFields) {
      if (!data[field]) {
        errors.push(`Campo obrigatório: ${field}`);
      }
    }
    
    // Validar conta mensal
    if (data.monthlyBill && data.monthlyBill < this.rentalModel.minMonthlyBill) {
      errors.push(`Conta mensal muito baixa. Mínimo: R$ ${this.rentalModel.minMonthlyBill}`);
    }
    
    // Validar tipo de propriedade
    const validPropertyTypes = ['residencial', 'comercial', 'industrial', 'rural'];
    if (data.propertyType && !validPropertyTypes.includes(data.propertyType)) {
      errors.push('Tipo de propriedade inválido');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data: {
        monthlyBill: parseFloat(data.monthlyBill) || 0,
        propertyType: data.propertyType || 'residencial',
        location: data.location || {},
        roofArea: parseFloat(data.roofArea) || null,
        roofType: data.roofType || 'ceramica',
        shadowing: data.shadowing || 'baixo',
        orientation: data.orientation || 'sul',
        inclination: parseFloat(data.inclination) || 30,
        energyCompany: data.energyCompany || 'local',
        tariffType: data.tariffType || 'convencional',
        contractPeriod: parseInt(data.contractPeriod) || this.rentalModel.defaultContractPeriod
      }
    };
  }

  /**
   * Enriquecer dados do cliente
   */
  async enrichClientData(data) {
    try {
      // Determinar região
      const region = this.determineRegion(data.location);
      
      // Obter dados climáticos se possível
      const climateData = await this.getClimateData(data.location);
      
      return {
        ...data,
        region,
        climateData,
        irradiation: this.solarData.irradiation[region] || this.solarData.irradiation.default,
        energyTariff: this.solarData.energyTariffs[region] || this.solarData.energyTariffs.default
      };
      
    } catch (error) {
      console.warn('⚠️ Erro ao enriquecer dados:', error.message);
      return {
        ...data,
        region: 'default',
        irradiation: this.solarData.irradiation.default,
        energyTariff: this.solarData.energyTariffs.default
      };
    }
  }

  /**
   * Calcular perfil energético
   */
  calculateEnergyProfile(data) {
    // Consumo mensal em kWh (estimativa baseada na conta)
    const monthlyConsumption = data.monthlyBill / data.energyTariff;
    
    // Consumo diário médio
    const dailyConsumption = monthlyConsumption / 30;
    
    // Consumo anual
    const annualConsumption = monthlyConsumption * 12;
    
    // Perfil de consumo por hora (simulado)
    const hourlyProfile = this.generateHourlyProfile(data.propertyType);
    
    // Sazonalidade (variação mensal)
    const seasonality = this.generateSeasonality(data.region);
    
    return {
      monthlyConsumption: Math.round(monthlyConsumption),
      dailyConsumption: Math.round(dailyConsumption),
      annualConsumption: Math.round(annualConsumption),
      hourlyProfile,
      seasonality,
      peakConsumption: Math.round(dailyConsumption * 1.3), // Pico 30% maior
      averagePower: Math.round(dailyConsumption / 24 * 1000) // Watts médios
    };
  }

  /**
   * Calcular dimensionamento do sistema
   */
  calculateSystemSizing(energyProfile, data) {
    // Potência necessária (kWp)
    const requiredPower = (energyProfile.dailyConsumption / data.irradiation) / 0.8; // 80% eficiência
    
    // Número de painéis (assumindo 450W por painel)
    const panelPower = 0.45; // kW
    const numberOfPanels = Math.ceil(requiredPower / panelPower);
    
    // Potência real instalada
    const installedPower = numberOfPanels * panelPower;
    
    // Área necessária (assumindo 2m² por painel)
    const requiredArea = numberOfPanels * 2;
    
    // Geração estimada
    const dailyGeneration = installedPower * data.irradiation * 0.8; // 80% eficiência
    const monthlyGeneration = dailyGeneration * 30;
    const annualGeneration = dailyGeneration * 365;
    
    // Verificar viabilidade da área
    const areaViability = !data.roofArea || requiredArea <= data.roofArea;
    
    return {
      requiredPower: Math.round(requiredPower * 100) / 100,
      installedPower: Math.round(installedPower * 100) / 100,
      numberOfPanels,
      requiredArea,
      areaViability,
      dailyGeneration: Math.round(dailyGeneration),
      monthlyGeneration: Math.round(monthlyGeneration),
      annualGeneration: Math.round(annualGeneration),
      generationRatio: Math.round((monthlyGeneration / energyProfile.monthlyConsumption) * 100) / 100
    };
  }

  /**
   * Calcular economia com modelo de aluguel
   */
  calculateRentalEconomy(energyProfile, systemSizing, data) {
    // Economia mensal em kWh (limitada pela geração)
    const monthlySavingsKwh = Math.min(
      energyProfile.monthlyConsumption,
      systemSizing.monthlyGeneration
    );
    
    // Economia mensal em reais
    const monthlySavingsReais = monthlySavingsKwh * data.energyTariff;
    
    // Percentual de economia
    const savingsPercentage = (monthlySavingsReais / data.monthlyBill) * 100;
    
    // Valor da economia que fica com o cliente (modelo Energiaa)
    const clientSavingsPercentage = Math.min(
      Math.max(this.rentalModel.guaranteedSavings, savingsPercentage / 100 * 0.7),
      this.rentalModel.maxSavings
    );
    
    const clientMonthlySavings = data.monthlyBill * clientSavingsPercentage;
    
    // Valor que fica com a Energiaa
    const energiaaSavings = monthlySavingsReais - clientMonthlySavings;
    
    // Nova conta mensal do cliente
    const newMonthlyBill = data.monthlyBill - clientMonthlySavings;
    
    return {
      monthlySavingsKwh: Math.round(monthlySavingsKwh),
      monthlySavingsReais: Math.round(monthlySavingsReais * 100) / 100,
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
      clientSavingsPercentage: Math.round(clientSavingsPercentage * 100 * 100) / 100,
      clientMonthlySavings: Math.round(clientMonthlySavings * 100) / 100,
      energiaaSavings: Math.round(energiaaSavings * 100) / 100,
      newMonthlyBill: Math.round(newMonthlyBill * 100) / 100,
      isViable: clientSavingsPercentage >= this.rentalModel.guaranteedSavings
    };
  }

  /**
   * Calcular métricas financeiras
   */
  calculateFinancialMetrics(economyCalculation, data) {
    const contractPeriod = data.contractPeriod;
    
    // Economia total no período do contrato
    const totalSavings = economyCalculation.clientMonthlySavings * contractPeriod;
    
    // Economia anual
    const annualSavings = economyCalculation.clientMonthlySavings * 12;
    
    // Valor presente líquido (VPL) - assumindo taxa de desconto de 8% a.a.
    const discountRate = 0.08 / 12; // Taxa mensal
    let npv = 0;
    for (let month = 1; month <= contractPeriod; month++) {
      npv += economyCalculation.clientMonthlySavings / Math.pow(1 + discountRate, month);
    }
    
    // Taxa interna de retorno (TIR) - simplificada
    const irr = (totalSavings / (data.monthlyBill * contractPeriod)) * 100;
    
    // Payback (em meses) - tempo para recuperar o investimento zero (modelo aluguel)
    const payback = 0; // Imediato no modelo de aluguel
    
    return {
      totalSavings: Math.round(totalSavings * 100) / 100,
      annualSavings: Math.round(annualSavings * 100) / 100,
      npv: Math.round(npv * 100) / 100,
      irr: Math.round(irr * 100) / 100,
      payback,
      contractPeriod
    };
  }

  /**
   * Gerar projeções
   */
  generateProjections(economyCalculation, financialMetrics, data) {
    const projections = [];
    const inflationRate = 0.05; // 5% a.a.
    const energyInflation = 0.08; // 8% a.a. para energia
    
    for (let year = 1; year <= Math.ceil(data.contractPeriod / 12); year++) {
      const yearlyEnergyInflation = Math.pow(1 + energyInflation, year - 1);
      const yearlyInflation = Math.pow(1 + inflationRate, year - 1);
      
      projections.push({
        year,
        monthlySavings: Math.round(economyCalculation.clientMonthlySavings * yearlyEnergyInflation * 100) / 100,
        annualSavings: Math.round(economyCalculation.clientMonthlySavings * 12 * yearlyEnergyInflation * 100) / 100,
        accumulatedSavings: Math.round(financialMetrics.annualSavings * year * yearlyInflation * 100) / 100,
        newMonthlyBill: Math.round((data.monthlyBill - economyCalculation.clientMonthlySavings) * yearlyEnergyInflation * 100) / 100
      });
    }
    
    return projections;
  }

  /**
   * Calcular impacto ambiental
   */
  calculateEnvironmentalImpact(systemSizing, data) {
    // CO2 evitado (kg/ano) - 0.5 kg CO2 por kWh
    const co2Avoided = systemSizing.annualGeneration * 0.5;
    
    // Árvores equivalentes (1 árvore absorve ~22 kg CO2/ano)
    const treesEquivalent = Math.round(co2Avoided / 22);
    
    // Carros tirados de circulação (1 carro emite ~2.3 toneladas CO2/ano)
    const carsEquivalent = Math.round((co2Avoided / 1000) / 2.3 * 100) / 100;
    
    // Litros de gasolina economizados (1L gasolina = 2.3 kg CO2)
    const gasolineEquivalent = Math.round(co2Avoided / 2.3);
    
    return {
      co2Avoided: Math.round(co2Avoided),
      treesEquivalent,
      carsEquivalent,
      gasolineEquivalent,
      sustainabilityScore: Math.min(100, Math.round((co2Avoided / 1000) * 10)) // Score de 0-100
    };
  }

  /**
   * Gerar recomendações
   */
  generateRecommendations(economyCalculation, financialMetrics) {
    const recommendations = [];
    
    if (economyCalculation.isViable) {
      recommendations.push({
        type: 'success',
        title: 'Projeto Viável',
        message: `Economia garantida de ${economyCalculation.clientSavingsPercentage}% na conta de energia`,
        priority: 'high'
      });
      
      if (economyCalculation.clientSavingsPercentage > 25) {
        recommendations.push({
          type: 'info',
          title: 'Excelente Economia',
          message: 'Sua propriedade tem potencial para economia acima da média',
          priority: 'medium'
        });
      }
      
      recommendations.push({
        type: 'action',
        title: 'Próximo Passo',
        message: 'Agende uma visita técnica para confirmar a viabilidade',
        priority: 'high'
      });
      
    } else {
      recommendations.push({
        type: 'warning',
        title: 'Economia Limitada',
        message: 'O potencial de economia está abaixo do mínimo garantido',
        priority: 'high'
      });
      
      recommendations.push({
        type: 'suggestion',
        title: 'Alternativas',
        message: 'Considere otimizar o consumo ou aguardar melhores condições',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  /**
   * Métodos auxiliares
   */
  determineRegion(location) {
    if (!location.state) return 'default';
    
    const regionMap = {
      'AC': 'norte', 'AP': 'norte', 'AM': 'norte', 'PA': 'norte', 'RO': 'norte', 'RR': 'norte', 'TO': 'norte',
      'AL': 'nordeste', 'BA': 'nordeste', 'CE': 'nordeste', 'MA': 'nordeste', 'PB': 'nordeste', 'PE': 'nordeste', 'PI': 'nordeste', 'RN': 'nordeste', 'SE': 'nordeste',
      'GO': 'centro-oeste', 'MT': 'centro-oeste', 'MS': 'centro-oeste', 'DF': 'centro-oeste',
      'ES': 'sudeste', 'MG': 'sudeste', 'RJ': 'sudeste', 'SP': 'sudeste',
      'PR': 'sul', 'RS': 'sul', 'SC': 'sul'
    };
    
    return regionMap[location.state.toUpperCase()] || 'default';
  }

  async getClimateData(location) {
    try {
      // Implementar integração com API de clima se necessário
      return {
        temperature: 25,
        humidity: 60,
        cloudiness: 30
      };
    } catch (error) {
      return null;
    }
  }

  generateHourlyProfile(propertyType) {
    const profiles = {
      'residencial': [0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.0, 0.6, 0.4, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5, 0.8, 1.2, 1.5, 1.8, 1.5, 1.0, 0.7, 0.5],
      'comercial': [0.1, 0.1, 0.1, 0.1, 0.2, 0.5, 1.0, 1.5, 2.0, 2.2, 2.0, 1.8, 1.5, 1.8, 2.0, 2.2, 2.0, 1.5, 1.0, 0.5, 0.3, 0.2, 0.1, 0.1],
      'industrial': [1.8, 1.8, 1.8, 1.8, 1.8, 2.0, 2.2, 2.5, 2.5, 2.5, 2.5, 2.5, 2.0, 2.5, 2.5, 2.5, 2.5, 2.2, 2.0, 1.8, 1.8, 1.8, 1.8, 1.8],
      'rural': [0.5, 0.3, 0.3, 0.3, 0.5, 1.0, 1.5, 1.8, 1.5, 1.2, 1.0, 1.0, 1.2, 1.0, 1.0, 1.2, 1.5, 1.8, 1.5, 1.0, 0.8, 0.6, 0.5, 0.5]
    };
    
    return profiles[propertyType] || profiles['residencial'];
  }

  generateSeasonality(region) {
    const seasonalities = {
      'norte': [1.1, 1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.9, 0.9, 1.0, 1.1, 1.2],
      'nordeste': [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      'centro-oeste': [1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.2],
      'sudeste': [1.1, 1.0, 0.9, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.1, 1.1, 1.1],
      'sul': [1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.2]
    };
    
    return seasonalities[region] || seasonalities['sudeste'];
  }

  /**
   * Simulação rápida para chatbot
   */
  async quickSimulation(monthlyBill, propertyType = 'residencial', location = {}) {
    try {
      const quickData = {
        monthlyBill: parseFloat(monthlyBill),
        propertyType,
        location
      };
      
      const simulation = await this.simulateEconomy(quickData);
      
      if (simulation.success) {
        return {
          success: true,
          monthlySavings: simulation.economyCalculation.clientMonthlySavings,
          savingsPercentage: simulation.economyCalculation.clientSavingsPercentage,
          newMonthlyBill: simulation.economyCalculation.newMonthlyBill,
          annualSavings: simulation.financialMetrics.annualSavings,
          isViable: simulation.economyCalculation.isViable
        };
      }
      
      return simulation;
      
    } catch (error) {
      console.error('❌ Erro na simulação rápida:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Salvar simulação no cliente
   */
  async saveSimulationToClient(clientId, simulationData) {
    try {
      const client = await ClientModel.findById(clientId);
      if (!client) {
        throw new Error('Cliente não encontrado');
      }
      
      client.simulation = {
        monthlyBill: simulationData.clientData.monthlyBill,
        monthlySavings: simulationData.economyCalculation.clientMonthlySavings,
        savingsPercentage: simulationData.economyCalculation.clientSavingsPercentage,
        annualSavings: simulationData.financialMetrics.annualSavings,
        systemPower: simulationData.systemSizing.installedPower,
        investmentValue: 0, // Modelo de aluguel
        paybackPeriod: 0,   // Imediato
        isViable: simulationData.economyCalculation.isViable,
        simulatedAt: new Date(),
        fullSimulation: simulationData
      };
      
      await client.save();
      
      console.log(`✅ Simulação salva para cliente ${clientId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao salvar simulação:', error);
      return false;
    }
  }
}

module.exports = SimulationService;