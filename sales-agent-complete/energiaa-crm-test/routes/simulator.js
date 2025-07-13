/**
 * ROTAS DO SIMULADOR DE ECONOMIA SOLAR
 * Sistema de simulação de economia para Energiaa CRM
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('./auth');
const rateLimit = require('express-rate-limit');

// Models
const ClientModel = require('../models/Client');

// Services
const SimulationService = require('../services/simulationService');
const simulationService = new SimulationService();

// Rate limiting para simulações
const simulationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 simulações por IP
  message: {
    success: false,
    error: 'Muitas simulações. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route POST /api/simulator/calculate
 * @desc Calcular simulação de economia solar
 * @access Public (com rate limiting)
 */
router.post('/calculate', simulationLimiter, async (req, res) => {
  try {
    const {
      monthlyBill,
      address,
      roofType,
      roofArea,
      shadowing,
      energyProfile,
      clientId
    } = req.body;
    
    // Validar dados obrigatórios
    if (!monthlyBill || monthlyBill <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor da conta mensal é obrigatório e deve ser maior que zero'
      });
    }
    
    // Preparar dados para simulação
    const simulationData = {
      monthlyBill: parseFloat(monthlyBill),
      address: address || {},
      roofType: roofType || 'ceramica',
      roofArea: roofArea ? parseFloat(roofArea) : null,
      shadowing: shadowing || 'baixo',
      energyProfile: energyProfile || 'residencial'
    };
    
    // Executar simulação
    const result = await simulationService.calculateSimulation(simulationData);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Se clientId fornecido, salvar simulação no cliente
    if (clientId) {
      try {
        await simulationService.saveSimulationToClient(clientId, result.simulation);
      } catch (error) {
        console.warn('Erro ao salvar simulação no cliente:', error.message);
        // Não falhar a simulação por isso
      }
    }
    
    res.json({
      success: true,
      data: result.simulation,
      message: 'Simulação calculada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao calcular simulação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/simulator/quick
 * @desc Simulação rápida para chatbot
 * @access Public (com rate limiting)
 */
router.post('/quick', simulationLimiter, async (req, res) => {
  try {
    const { monthlyBill, city, state } = req.body;
    
    if (!monthlyBill || monthlyBill <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor da conta mensal é obrigatório'
      });
    }
    
    const result = await simulationService.quickSimulation({
      monthlyBill: parseFloat(monthlyBill),
      city: city || 'São Paulo',
      state: state || 'SP'
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      data: result.simulation,
      message: 'Simulação rápida calculada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro na simulação rápida:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/simulator/client/:clientId
 * @desc Obter simulação de um cliente específico
 * @access Private
 */
router.get('/client/:clientId', authenticateToken, authorize('clients:read'), async (req, res) => {
  try {
    const client = await ClientModel.findById(req.params.clientId)
      .select('simulation energyInfo address')
      .lean();
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    if (!client.simulation || Object.keys(client.simulation).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Simulação não encontrada para este cliente'
      });
    }
    
    res.json({
      success: true,
      data: {
        simulation: client.simulation,
        energyInfo: client.energyInfo,
        address: client.address
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter simulação do cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route PUT /api/simulator/client/:clientId
 * @desc Atualizar simulação de um cliente
 * @access Private
 */
router.put('/client/:clientId', authenticateToken, authorize('clients:write'), async (req, res) => {
  try {
    const client = await ClientModel.findById(req.params.clientId);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    const {
      monthlyBill,
      roofType,
      roofArea,
      shadowing,
      energyProfile
    } = req.body;
    
    // Preparar dados para nova simulação
    const simulationData = {
      monthlyBill: monthlyBill || client.energyInfo?.monthlyBill,
      address: client.address,
      roofType: roofType || client.energyInfo?.roofType,
      roofArea: roofArea || client.energyInfo?.roofArea,
      shadowing: shadowing || client.energyInfo?.shadowing,
      energyProfile: energyProfile || client.segment
    };
    
    // Executar nova simulação
    const result = await simulationService.calculateSimulation(simulationData);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Atualizar cliente com nova simulação
    await ClientModel.findByIdAndUpdate(req.params.clientId, {
      simulation: result.simulation,
      'energyInfo.monthlyBill': simulationData.monthlyBill,
      'energyInfo.roofType': simulationData.roofType,
      'energyInfo.roofArea': simulationData.roofArea,
      'energyInfo.shadowing': simulationData.shadowing,
      updatedAt: new Date()
    });
    
    res.json({
      success: true,
      data: result.simulation,
      message: 'Simulação atualizada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao atualizar simulação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/simulator/parameters
 * @desc Obter parâmetros de simulação
 * @access Public
 */
router.get('/parameters', (req, res) => {
  try {
    const parameters = {
      roofTypes: [
        { value: 'ceramica', label: 'Cerâmica', factor: 1.0 },
        { value: 'metalica', label: 'Metálica', factor: 1.1 },
        { value: 'fibrocimento', label: 'Fibrocimento', factor: 0.95 },
        { value: 'laje', label: 'Laje', factor: 1.05 }
      ],
      shadowingLevels: [
        { value: 'baixo', label: 'Baixo (0-10%)', factor: 0.95 },
        { value: 'medio', label: 'Médio (10-30%)', factor: 0.85 },
        { value: 'alto', label: 'Alto (30-50%)', factor: 0.75 },
        { value: 'muito_alto', label: 'Muito Alto (>50%)', factor: 0.6 }
      ],
      energyProfiles: [
        { value: 'residencial', label: 'Residencial', description: 'Uso doméstico padrão' },
        { value: 'comercial', label: 'Comercial', description: 'Estabelecimentos comerciais' },
        { value: 'industrial', label: 'Industrial', description: 'Indústrias e fábricas' },
        { value: 'rural', label: 'Rural', description: 'Propriedades rurais' }
      ],
      regions: [
        { value: 'norte', label: 'Norte', irradiation: 5.2 },
        { value: 'nordeste', label: 'Nordeste', irradiation: 5.8 },
        { value: 'centro_oeste', label: 'Centro-Oeste', irradiation: 5.5 },
        { value: 'sudeste', label: 'Sudeste', irradiation: 4.8 },
        { value: 'sul', label: 'Sul', irradiation: 4.5 }
      ],
      systemEfficiency: {
        panels: 0.22, // 22% eficiência dos painéis
        inverter: 0.96, // 96% eficiência do inversor
        losses: 0.85 // 15% perdas do sistema
      },
      financialParameters: {
        energiaaFee: 0.15, // 15% taxa Energiaa
        guaranteedSavings: 0.20, // 20% economia garantida
        minBill: 50, // conta mínima R$ 50
        contractPeriod: 25 // 25 anos
      }
    };
    
    res.json({
      success: true,
      data: parameters
    });
    
  } catch (error) {
    console.error('Erro ao obter parâmetros:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/simulator/compare
 * @desc Comparar múltiplas simulações
 * @access Private
 */
router.post('/compare', authenticateToken, authorize('clients:read'), async (req, res) => {
  try {
    const { scenarios } = req.body;
    
    if (!Array.isArray(scenarios) || scenarios.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer pelo menos 2 cenários para comparação'
      });
    }
    
    if (scenarios.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Máximo de 5 cenários para comparação'
      });
    }
    
    const comparisons = [];
    
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      
      if (!scenario.monthlyBill || scenario.monthlyBill <= 0) {
        return res.status(400).json({
          success: false,
          error: `Cenário ${i + 1}: Valor da conta mensal é obrigatório`
        });
      }
      
      const result = await simulationService.calculateSimulation({
        monthlyBill: parseFloat(scenario.monthlyBill),
        address: scenario.address || {},
        roofType: scenario.roofType || 'ceramica',
        roofArea: scenario.roofArea ? parseFloat(scenario.roofArea) : null,
        shadowing: scenario.shadowing || 'baixo',
        energyProfile: scenario.energyProfile || 'residencial'
      });
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: `Cenário ${i + 1}: ${result.error}`
        });
      }
      
      comparisons.push({
        scenario: i + 1,
        name: scenario.name || `Cenário ${i + 1}`,
        input: scenario,
        simulation: result.simulation
      });
    }
    
    // Análise comparativa
    const analysis = {
      bestSavings: comparisons.reduce((best, current) => 
        current.simulation.monthlyEconomy > best.simulation.monthlyEconomy ? current : best
      ),
      bestROI: comparisons.reduce((best, current) => 
        current.simulation.paybackYears < best.simulation.paybackYears ? current : best
      ),
      avgSavings: comparisons.reduce((sum, comp) => sum + comp.simulation.monthlyEconomy, 0) / comparisons.length,
      avgPayback: comparisons.reduce((sum, comp) => sum + comp.simulation.paybackYears, 0) / comparisons.length
    };
    
    res.json({
      success: true,
      data: {
        comparisons,
        analysis
      },
      message: 'Comparação realizada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro na comparação de simulações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/simulator/stats
 * @desc Obter estatísticas das simulações
 * @access Private
 */
router.get('/stats', authenticateToken, authorize('metrics:read'), async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'daily':
        dateFilter = {
          'simulation.calculatedAt': {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        };
        break;
      case 'weekly':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = {
          'simulation.calculatedAt': { $gte: weekAgo }
        };
        break;
      case 'monthly':
        dateFilter = {
          'simulation.calculatedAt': {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        };
        break;
    }
    
    const stats = await ClientModel.aggregate([
      {
        $match: {
          'simulation.monthlyEconomy': { $exists: true },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalSimulations: { $sum: 1 },
          avgMonthlyBill: { $avg: '$energyInfo.monthlyBill' },
          avgMonthlyEconomy: { $avg: '$simulation.monthlyEconomy' },
          avgSystemSize: { $avg: '$simulation.systemSize' },
          avgPayback: { $avg: '$simulation.paybackYears' },
          totalPotentialRevenue: { $sum: '$simulation.monthlyEconomy' },
          minBill: { $min: '$energyInfo.monthlyBill' },
          maxBill: { $max: '$energyInfo.monthlyBill' },
          minEconomy: { $min: '$simulation.monthlyEconomy' },
          maxEconomy: { $max: '$simulation.monthlyEconomy' }
        }
      }
    ]);
    
    // Distribuição por faixa de conta
    const billDistribution = await ClientModel.aggregate([
      {
        $match: {
          'simulation.monthlyEconomy': { $exists: true },
          ...dateFilter
        }
      },
      {
        $bucket: {
          groupBy: '$energyInfo.monthlyBill',
          boundaries: [0, 100, 200, 300, 500, 1000, 2000, 5000],
          default: '5000+',
          output: {
            count: { $sum: 1 },
            avgEconomy: { $avg: '$simulation.monthlyEconomy' },
            avgSystemSize: { $avg: '$simulation.systemSize' }
          }
        }
      }
    ]);
    
    // Simulações por região
    const regionDistribution = await ClientModel.aggregate([
      {
        $match: {
          'simulation.monthlyEconomy': { $exists: true },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$address.state',
          count: { $sum: 1 },
          avgEconomy: { $avg: '$simulation.monthlyEconomy' },
          avgBill: { $avg: '$energyInfo.monthlyBill' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        general: stats[0] || {
          totalSimulations: 0,
          avgMonthlyBill: 0,
          avgMonthlyEconomy: 0,
          avgSystemSize: 0,
          avgPayback: 0,
          totalPotentialRevenue: 0,
          minBill: 0,
          maxBill: 0,
          minEconomy: 0,
          maxEconomy: 0
        },
        billDistribution,
        regionDistribution,
        period
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas de simulação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/simulator/validate
 * @desc Validar dados de entrada para simulação
 * @access Public
 */
router.post('/validate', (req, res) => {
  try {
    const validation = simulationService.validateInput(req.body);
    
    res.json({
      success: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    });
    
  } catch (error) {
    console.error('Erro na validação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;