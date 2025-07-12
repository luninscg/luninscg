#!/bin/bash

echo "🚀 Aplicando melhorias no Sales-Agent..."

# 1. Criar backup
echo "📦 Criando backup..."
tar -czf backup-pre-improvements-$(date +%Y%m%d_%H%M%S).tar.gz .

# 2. Instalar dependências
echo "📦 Instalando dependências..."
npm install joi express-rate-limit winston

# 3. Criar diretórios necessários
echo "📁 Criando estrutura de pastas..."
mkdir -p logs utils middleware monitoring cache

# 4. Parar servidor atual
echo "⏹️ Parando servidor atual..."
pkill -f "node index.js" || true

# 5. Aguardar um momento
sleep 2

# 6. Reiniciar servidor
echo "🔄 Reiniciando servidor..."
nohup node index.js > server.log 2>&1 &

# 7. Verificar se está rodando
sleep 3
if pgrep -f "node index.js" > /dev/null; then
    echo "✅ Servidor reiniciado com sucesso!"
    echo "🌐 Dashboard: http://localhost:3001/dashboard"
    echo "❤️ Health Check: http://localhost:3001/health"
else
    echo "❌ Erro ao reiniciar servidor. Verifique os logs."
    tail -20 server.log
fi

echo "🎉 Melhorias aplicadas!"