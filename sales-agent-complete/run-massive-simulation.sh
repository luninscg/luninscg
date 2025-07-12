#!/bin/bash

# Script para executar simulação massiva

echo "🚀 === SIMULAÇÃO MASSIVA GABRIEL HUMANO 2.0 ==="
echo ""

# Verificar dependências
echo "🔍 Verificando dependências..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    exit 1
fi

echo "✅ Node.js encontrado"

# Executar simulação
echo "🧪 Iniciando simulação massiva..."
node -e "
const { MassiveSimulator } = require('./massive-simulator');
const simulator = new MassiveSimulator();

// Configuração padrão
const config = {
    personality: 10000,
    campaigns: 5000,
    antiRobotic: 20000,
    messaging: 15000
};

console.log('Configuração:', config);
console.log('Total de testes:', Object.values(config).reduce((a,b) => a+b, 0));
console.log('');

simulator.runFullSimulation(config)
    .then(results => {
        console.log('\n🎉 Simulação concluída com sucesso!');
        console.log('Resultados salvos em:', 'simulation-results-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Erro na simulação:', error);
        process.exit(1);
    });
"

echo "✅ Script concluído!"