const express = require('express');
const RealConversationAnalyzer = require('./real-conversation-analyzer');
const { getAllLeads, getMessages } = require('./database');

class ConversationDashboard {
    constructor(app) {
        this.app = app;
        this.analyzer = new RealConversationAnalyzer();
        this.setupRoutes();
    }

    setupRoutes() {
        // Dashboard principal de conversas
        this.app.get('/conversation-dashboard', async (req, res) => {
            try {
                const leads = await getAllLeads();
                
                res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Dashboard de Análise de Conversas</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
                    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                </head>
                <body>
                    <div class="container-fluid">
                        <div class="row">
                            <div class="col-12">
                                <h1 class="mt-4 mb-4">
                                    <i class="fas fa-comments"></i> Dashboard de Análise de Conversas
                                </h1>
                            </div>
                        </div>
                        
                        <!-- Métricas Principais -->
                        <div class="row mb-4">
                            <div class="col-md-3">
                                <div class="card bg-primary text-white">
                                    <div class="card-body">
                                        <h5><i class="fas fa-chart-line"></i> Total de Conversas</h5>
                                        <h2 id="totalConversas">${leads.length}</h2>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-success text-white">
                                    <div class="card-body">
                                        <h5><i class="fas fa-percentage"></i> Taxa de Conversão</h5>
                                        <h2 id="taxaConversao">Calculando...</h2>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-warning text-white">
                                    <div class="card-body">
                                        <h5><i class="fas fa-clock"></i> Tempo Médio</h5>
                                        <h2 id="tempoMedio">Calculando...</h2>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-info text-white">
                                    <div class="card-body">
                                        <h5><i class="fas fa-star"></i> Interesse Médio</h5>
                                        <h2 id="interesseMedio">Calculando...</h2>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Gráficos -->
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <div class="card">
                                    <div class="card-header">
                                        <h5><i class="fas fa-chart-pie"></i> Distribuição por Estágio</h5>
                                    </div>
                                    <div class="card-body">
                                        <canvas id="stageChart"></canvas>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card">
                                    <div class="card-header">
                                        <h5><i class="fas fa-chart-bar"></i> Personalidades Detectadas</h5>
                                    </div>
                                    <div class="card-body">
                                        <canvas id="personalityChart"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Análise Detalhada -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <div class="card">
                                    <div class="card-header">
                                        <h5><i class="fas fa-brain"></i> Análise Inteligente</h5>
                                        <button class="btn btn-primary float-end" onclick="generateAnalysis()">
                                            <i class="fas fa-sync"></i> Gerar Análise
                                        </button>
                                    </div>
                                    <div class="card-body">
                                        <div id="analysisResults">Clique em "Gerar Análise" para obter insights detalhados...</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Lista de Conversas -->
                        <div class="row">
                            <div class="col-12">
                                <div class="card">
                                    <div class="card-header">
                                        <h5><i class="fas fa-list"></i> Conversas Recentes</h5>
                                    </div>
                                    <div class="card-body">
                                        <div class="table-responsive">
                                            <table class="table table-striped">
                                                <thead>
                                                    <tr>
                                                        <th>WhatsApp</th>
                                                        <th>Nome</th>
                                                        <th>Estágio</th>
                                                        <th>Interesse</th>
                                                        <th>Última Interação</th>
                                                        <th>Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${leads.map(lead => `
                                                        <tr>
                                                            <td>${lead.whatsapp_number}</td>
                                                            <td>${lead.name || 'N/A'}</td>
                                                            <td><span class="badge bg-primary">${lead.stage}</span></td>
                                                            <td><span class="badge bg-success">${lead.interest_level || 'N/A'}</span></td>
                                                            <td>${new Date(lead.last_interaction_timestamp).toLocaleString('pt-BR')}</td>
                                                            <td>
                                                                <button class="btn btn-sm btn-info" onclick="analyzeConversation('${lead.whatsapp_number}')">
                                                                    <i class="fas fa-search"></i> Analisar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <script>
                        // Gráfico de Estágios
                        const stageData = ${JSON.stringify(leads.reduce((acc, lead) => {
                            acc[lead.stage] = (acc[lead.stage] || 0) + 1;
                            return acc;
                        }, {}))};
                        
                        new Chart(document.getElementById('stageChart'), {
                            type: 'pie',
                            data: {
                                labels: Object.keys(stageData),
                                datasets: [{
                                    data: Object.values(stageData),
                                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                                }]
                            }
                        });
                        
                        // Funções JavaScript
                        async function generateAnalysis() {
                            document.getElementById('analysisResults').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando análise...';
                            
                            try {
                                const response = await fetch('/api/generate-performance-report');
                                const data = await response.json();
                                
                                document.getElementById('analysisResults').innerHTML = 
                                    '<div class="alert alert-success">' +
                                        '<h6><i class="fas fa-check"></i> Análise Concluída</h6>' +
                                        '<pre>' + JSON.stringify(data.report, null, 2) + '</pre>' +
                                    '</div>';
                            } catch (error) {
                                document.getElementById('analysisResults').innerHTML = 
                                    '<div class="alert alert-danger">' +
                                        '<i class="fas fa-exclamation-triangle"></i> Erro: ' + error.message +
                                    '</div>';
                            }
                        }
                        
                        async function analyzeConversation(whatsapp) {
                            const response = await fetch('/api/analyze-conversation/' + whatsapp);
                            const data = await response.json();
                            
                            alert('Análise da conversa:\n\n' + JSON.stringify(data, null, 2));
                        }
                    </script>
                </body>
                </html>
                `);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API para análise individual
        this.app.get('/api/analyze-conversation/:whatsapp', async (req, res) => {
            try {
                const analysis = await this.analyzer.analyzeConversation(req.params.whatsapp);
                res.json(analysis);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API para relatório de performance
        this.app.get('/api/generate-performance-report', async (req, res) => {
            try {
                const report = await this.analyzer.generatePerformanceReport();
                res.json(report);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API para análise de tendências
        this.app.get('/api/analyze-trends/:days?', async (req, res) => {
            try {
                const days = parseInt(req.params.days) || 30;
                const trends = await this.analyzer.analyzeTrends(days);
                res.json(trends);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API para sugestões personalizadas
        this.app.get('/api/suggestions/:whatsapp', async (req, res) => {
            try {
                const suggestions = await this.analyzer.getPersonalizedSuggestions(req.params.whatsapp);
                res.json(suggestions);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}

module.exports = ConversationDashboard;