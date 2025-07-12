const express = require('express');
const { getAllLeads, getLead, getMessages } = require('./database');
const fs = require('fs').promises;
const path = require('path');
const { AIConversationAnalyzer } = require('./ai-conversation-analyzer');

const router = express.Router();

// API de Estatísticas
router.get('/api/stats', async (req, res) => {
    try {
        const leads = await getAllLeads();
        
        const stats = {
            totalLeads: leads.length,
            leadsByStage: {},
            leadsByInterest: {},
            leadsBySource: {},
            conversionRate: 0,
            recentActivity: leads.slice(0, 5).map(lead => ({
                name: lead.name || 'N/A',
                whatsapp: lead.whatsapp_number,
                stage: lead.stage,
                lastInteraction: lead.last_interaction_timestamp
            }))
        };
        
        // Estatísticas por estágio
        leads.forEach(lead => {
            const stage = `Estágio ${lead.stage}`;
            stats.leadsByStage[stage] = (stats.leadsByStage[stage] || 0) + 1;
        });
        
        // Estatísticas por interesse
        leads.forEach(lead => {
            const interest = lead.interest_level || 'Não definido';
            stats.leadsByInterest[interest] = (stats.leadsByInterest[interest] || 0) + 1;
        });
        
        // Estatísticas por fonte
        leads.forEach(lead => {
            const source = lead.source || 'Orgânico';
            stats.leadsBySource[source] = (stats.leadsBySource[source] || 0) + 1;
        });
        
        // Taxa de conversão (leads no estágio 5+ / total)
        const convertedLeads = leads.filter(lead => lead.stage >= 5).length;
        stats.conversionRate = leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(1) : 0;
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API de Filtros
router.get('/api/leads/filter', async (req, res) => {
    try {
        let leads = await getAllLeads();
        
        // Aplicar filtros
        const { stage, interest, period, source } = req.query;
        
        if (stage && stage !== 'all') {
            leads = leads.filter(lead => lead.stage == stage);
        }
        
        if (interest && interest !== 'all') {
            leads = leads.filter(lead => lead.interest_level === interest);
        }
        
        if (source && source !== 'all') {
            leads = leads.filter(lead => (lead.source || 'Orgânico') === source);
        }
        
        if (period && period !== 'all') {
            const now = new Date();
            const periodDays = {
                '7': 7,
                '30': 30,
                '90': 90
            };
            
            if (periodDays[period]) {
                const cutoffDate = new Date(now.getTime() - (periodDays[period] * 24 * 60 * 60 * 1000));
                leads = leads.filter(lead => {
                    const lastInteraction = new Date(lead.last_interaction_timestamp);
                    return lastInteraction >= cutoffDate;
                });
            }
        }
        
        // Ordenar por última interação (mais recente primeiro)
        leads.sort((a, b) => new Date(b.last_interaction_timestamp) - new Date(a.last_interaction_timestamp));
        
        res.json(leads);
    } catch (error) {
        console.error('Error filtering leads:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Dashboard Principal
router.get('/', async (req, res) => {
    try {
        const leads = await getAllLeads();
        const systemPrompt = await fs.readFile('./prompt.js', 'utf-8');

        const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRM Dashboard Avançado - Energia A</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --primary-color: #2c5aa0;
            --secondary-color: #f8f9fa;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
            --info-color: #17a2b8;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .dashboard-container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            margin: 20px;
            padding: 30px;
        }
        
        .stats-card {
            background: linear-gradient(135deg, var(--primary-color), #3d6bb3);
            color: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(44, 90, 160, 0.3);
            transition: transform 0.3s ease;
        }
        
        .stats-card:hover {
            transform: translateY(-5px);
        }
        
        .chart-container {
            background: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        .lead-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 3px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border-left: 4px solid var(--primary-color);
        }
        
        .lead-card:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 25px rgba(0,0,0,0.15);
        }
        
        .filter-section {
            background: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        .stage-badge {
            font-size: 0.8rem;
            padding: 5px 10px;
        }
        
        .interest-high { background-color: var(--success-color) !important; }
        .interest-medium { background-color: var(--warning-color) !important; }
        .interest-low { background-color: var(--danger-color) !important; }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        
        .spinner-border {
            color: var(--primary-color);
        }
        
        .prompt-section {
            background: white;
            border-radius: 15px;
            padding: 25px;
            margin-top: 20px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        .prompt-textarea {
            min-height: 200px;
            border-radius: 10px;
            border: 2px solid #e9ecef;
            transition: border-color 0.3s ease;
        }
        
        .prompt-textarea:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 0.2rem rgba(44, 90, 160, 0.25);
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="display-4 fw-bold text-primary">
                <i class="fas fa-chart-line me-3"></i>
                CRM Dashboard Avançado
            </h1>
            <div class="d-flex gap-2">
                <a href="/dashboard/simulator" class="btn btn-outline-primary">
                    <i class="fas fa-flask me-2"></i>Simulador
                </a>
                <a href="/dashboard/ai-analysis" class="btn btn-outline-success">
                    <i class="fas fa-brain me-2"></i>Análise IA
                </a>
            </div>
        </div>
        
        <!-- Cards de Estatísticas -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="stats-card">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h3 id="total-leads" class="mb-0">0</h3>
                            <p class="mb-0">Total de Leads</p>
                        </div>
                        <i class="fas fa-users fa-2x opacity-75"></i>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" style="background: linear-gradient(135deg, var(--success-color), #34ce57);">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h3 id="active-leads" class="mb-0">0</h3>
                            <p class="mb-0">Leads Ativos</p>
                        </div>
                        <i class="fas fa-user-check fa-2x opacity-75"></i>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" style="background: linear-gradient(135deg, var(--warning-color), #ffcd39);">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h3 id="conversion-rate" class="mb-0">0%</h3>
                            <p class="mb-0">Taxa de Conversão</p>
                        </div>
                        <i class="fas fa-chart-line fa-2x opacity-75"></i>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" style="background: linear-gradient(135deg, var(--info-color), #20c997);">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h3 id="today-interactions" class="mb-0">0</h3>
                            <p class="mb-0">Interações Hoje</p>
                        </div>
                        <i class="fas fa-comments fa-2x opacity-75"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Gráficos -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="chart-container">
                    <h4 class="text-primary mb-3">
                        <i class="fas fa-chart-pie me-2"></i>Distribuição por Estágio
                    </h4>
                    <canvas id="stageChart" width="400" height="200"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-container">
                    <h4 class="text-primary mb-3">
                        <i class="fas fa-heart me-2"></i>Nível de Interesse
                    </h4>
                    <canvas id="interestChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Filtros -->
        <div class="filter-section">
            <h4 class="text-primary mb-3">
                <i class="fas fa-filter me-2"></i>Filtros
            </h4>
            <div class="row">
                <div class="col-md-3">
                    <select id="stage-filter" class="form-select">
                        <option value="all">Todos os Estágios</option>
                        <option value="1">Estágio 1</option>
                        <option value="2">Estágio 2</option>
                        <option value="3">Estágio 3</option>
                        <option value="4">Estágio 4</option>
                        <option value="5">Estágio 5</option>
                        <option value="6">Estágio 6</option>
                        <option value="7">Estágio 7</option>
                        <option value="8">Estágio 8</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select id="interest-filter" class="form-select">
                        <option value="all">Todos os Interesses</option>
                        <option value="Alto">Alto</option>
                        <option value="Médio">Médio</option>
                        <option value="Baixo">Baixo</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select id="period-filter" class="form-select">
                        <option value="all">Todos os Períodos</option>
                        <option value="7">Últimos 7 dias</option>
                        <option value="30">Últimos 30 dias</option>
                        <option value="90">Últimos 90 dias</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select id="source-filter" class="form-select">
                        <option value="all">Todas as Fontes</option>
                        <option value="Orgânico">Orgânico</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Instagram">Instagram</option>
                        <option value="Google">Google</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Loading -->
        <div id="loading" class="loading">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
            <p class="mt-2">Carregando dados...</p>
        </div>
        
        <!-- Lista de Leads -->
        <div class="chart-container">
            <h4 class="text-primary mb-3">
                <i class="fas fa-list me-2"></i>Lista de Leads
                <span id="leads-count" class="badge bg-primary ms-2">0</span>
            </h4>
            <div id="leads-list">
                <!-- Leads serão carregados aqui via JavaScript -->
            </div>
        </div>
        
        <!-- Seção do Prompt -->
        <div class="prompt-section">
            <h4 class="text-primary mb-3">
                <i class="fas fa-code me-2"></i>Configuração do Prompt do Sistema
            </h4>
            <form action="/dashboard/prompt" method="POST">
                <div class="mb-3">
                    <label for="prompt" class="form-label">Prompt Atual:</label>
                    <textarea class="form-control prompt-textarea" id="prompt" name="prompt" required>${systemPrompt}</textarea>
                </div>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save me-2"></i>Salvar Prompt
                </button>
            </form>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        let stageChart, interestChart;
        
        // Função para carregar estatísticas
        async function loadStats() {
            try {
                const response = await fetch('/dashboard/api/stats');
                const stats = await response.json();
                
                // Atualizar cards
                document.getElementById('total-leads').textContent = stats.totalLeads;
                // Calcular leads ativos (estágios 1-6)
                const activeLeads = Object.keys(stats.leadsByStage)
                    .filter(stage => {
                        const stageNum = parseInt(stage.replace('Estágio ', ''));
                        return stageNum >= 1 && stageNum <= 6;
                    })
                    .reduce((sum, stage) => sum + (stats.leadsByStage[stage] || 0), 0);
                document.getElementById('active-leads').textContent = activeLeads;
                document.getElementById('conversion-rate').textContent = stats.conversionRate + '%';
                
                // Atualizar gráficos
                updateCharts(stats);
                
            } catch (error) {
                console.error('Erro ao carregar estatísticas:', error);
            }
        }
        
        // Função para atualizar gráficos
        function updateCharts(stats) {
            // Gráfico de estágios
            const stageCtx = document.getElementById('stageChart').getContext('2d');
            if (stageChart) stageChart.destroy();
            
            stageChart = new Chart(stageCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(stats.leadsByStage),
                    datasets: [{
                        data: Object.values(stats.leadsByStage),
                        backgroundColor: [
                            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
            
            // Gráfico de interesse
            const interestCtx = document.getElementById('interestChart').getContext('2d');
            if (interestChart) interestChart.destroy();
            
            interestChart = new Chart(interestCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.leadsByInterest),
                    datasets: [{
                        label: 'Leads por Interesse',
                        data: Object.values(stats.leadsByInterest),
                        backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Função para carregar leads
        async function loadLeads() {
            try {
                document.getElementById('loading').style.display = 'block';
                
                const stage = document.getElementById('stage-filter').value;
                const interest = document.getElementById('interest-filter').value;
                const period = document.getElementById('period-filter').value;
                const source = document.getElementById('source-filter').value;
                
                const params = new URLSearchParams({
                    stage, interest, period, source
                });
                
                const response = await fetch('/dashboard/api/leads/filter?' + params);
                const leads = await response.json();
                
                displayLeads(leads);
                document.getElementById('leads-count').textContent = leads.length;
                
            } catch (error) {
                console.error('Erro ao carregar leads:', error);
            } finally {
                document.getElementById('loading').style.display = 'none';
            }
        }
        
        // Função para exibir leads
        function displayLeads(leads) {
            const container = document.getElementById('leads-list');
            
            if (leads.length === 0) {
                container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-inbox me-2"></i>Nenhum lead encontrado</div>';
                return;
            }
            
            container.innerHTML = leads.map(lead => `
                <div class="lead-card">{
                    <div class="d-flex justify-content-between align-items-start">;

                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="mb-2">
                                    <a href="/dashboard/lead/${lead.whatsapp_number}" class="text-decoration-none">
                                        <i class="fas fa-user me-2"></i>
                                        ${lead.name || 'Nome não informado'}
                                    </a>
                                </h5>
                                <p class="mb-1">
                                    <i class="fab fa-whatsapp text-success me-2"></i>
                                    ${lead.whatsapp_number}
                                </p>
                                ${lead.email ? `<p class="mb-1"><i class="fas fa-envelope me-2"></i>${lead.email}</p>` : ''}
                            </div>
                            <div class="text-end">
                                <span class="badge bg-primary stage-badge mb-2">Estágio ${lead.stage}</span><br>
                                <span class="badge ${getInterestClass(lead.interest_level)}">${lead.interest_level || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="fas fa-clock me-1"></i>
                            Última interação: ${new Date(lead.last_interaction_timestamp).toLocaleString('pt-BR')}
                        </small>
                    </div>
                </div>
            `).join('');
        }
        
        // Função para obter classe CSS do interesse
        function getInterestClass(interest) {
            switch(interest) {
                case 'Alto': return 'interest-high';
                case 'Médio': return 'interest-medium';
                case 'Baixo': return 'interest-low';
                default: return 'bg-secondary';
            }
        }
        
        // Função para aplicar filtros
        function applyFilters() {
            loadLeads();
        }
        
        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {
            loadStats();
            loadLeads();
            
            // Filtros
            document.getElementById('stage-filter').addEventListener('change', applyFilters);
            document.getElementById('interest-filter').addEventListener('change', applyFilters);
            document.getElementById('period-filter').addEventListener('change', applyFilters);
            document.getElementById('source-filter').addEventListener('change', applyFilters);
        });
    </script>
</body>
</html>
        
        res.send(htmlContent);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Rota para detalhes do lead
router.get('/lead/:whatsapp', async (req, res) => {
    try {
        const whatsappNumber = req.params.whatsapp;
        const lead = await getLead(whatsappNumber);
        const messages = await getMessages(whatsappNumber);

        if (!lead) {
            return res.status(404).send('Lead não encontrado');
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Detalhes do Lead - ${lead.name || lead.whatsapp_number}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                <style>
                    body {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    
                    .container {
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 20px;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                        backdrop-filter: blur(10px);
                        margin: 20px auto;
                        padding: 30px;
                    }
                    
                    .chat-history {
                        background: #f8f9fa;
                        border-radius: 15px;
                        padding: 20px;
                        max-height: 600px;
                        overflow-y: auto;
                    }
                    
                    .message {
                        margin-bottom: 15px;
                        padding: 15px;
                        border-radius: 15px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    
                    .user {
                        background: linear-gradient(135deg, #e3f2fd, #bbdefb);
                        margin-left: 20px;
                    }
                    
                    .agent {
                        background: linear-gradient(135deg, #f3e5f5, #e1bee7);
                        margin-right: 20px;
                    }
                    
                    .timestamp {
                        font-size: 0.8rem;
                        color: #6c757d;
                        margin-top: 8px;
                    }
                    
                    .lead-info {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        margin-bottom: 30px;
                        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                    }
                </style>
            </head>
            <body>
                <div class="container mt-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h1 class="display-5 fw-bold text-primary">
                            <a href="/dashboard" class="text-decoration-none">
                                <i class="fas fa-arrow-left me-3"></i>
                            </a>
                            Detalhes do Lead
                        </h1>
                    </div>
                    
                    <div class="lead-info">
                        <div class="row">
                            <div class="col-md-6">
                                <h3 class="text-primary">
                                    <i class="fas fa-user me-2"></i>
                                    ${lead.name || 'Nome não informado'}
                                </h3>
                                <p class="mb-2">
                                    <strong><i class="fab fa-whatsapp text-success me-2"></i>WhatsApp:</strong>
                                    <a href="https://wa.me/${lead.whatsapp_number}" target="_blank" class="text-decoration-none">
                                        ${lead.whatsapp_number}
                                    </a>
                                </p>
                                ${lead.cpf ? '<p class="mb-2"><strong><i class="fas fa-id-card me-2"></i>CPF:</strong> ' + lead.cpf + '</p>' : ''}
                                ${lead.email ? '<p class="mb-2"><strong><i class="fas fa-envelope me-2"></i>Email:</strong> ' + lead.email + '</p>' : ''}
                            </div>
                            <div class="col-md-6">
                                <p class="mb-2">
                                    <strong><i class="fas fa-chart-line me-2"></i>Estágio:</strong>
                                    <span class="badge bg-primary">${lead.stage}</span>
                                </p>
                                <p class="mb-2">
                                    <strong><i class="fas fa-heart me-2"></i>Interesse:</strong>
                                    <span class="badge bg-success">${lead.interest_level || 'N/A'}</span>
                                </p>
                                <p class="mb-2">
                                    <strong><i class="fas fa-source me-2"></i>Fonte:</strong>
                                    <span class="badge bg-secondary">${lead.source || 'Orgânico'}</span>
                                </p>
                                ${lead.summary ? '<p class="mb-2"><strong><i class="fas fa-notes-medical me-2"></i>Resumo:</strong> ' + lead.summary + '</p>' : ''}
                            </div>
                        </div>
                    </div>
                    
                    <h4 class="mb-3">
                        <i class="fas fa-comments me-2"></i>Histórico da Conversa
                        <span class="badge bg-primary ms-2">${messages.length} mensagens</span>
                    </h4>
                    
                    <div class="chat-history">
                        ${messages.length > 0 ? messages.map(msg => `
                            <div class="message ${msg.sender}">
                                <div class="d-flex justify-content-between align-items-start">
                                    <strong class="text-primary">
                                        <i class="fas ${msg.sender === 'user' ? 'fa-user' : 'fa-robot'} me-2"></i>
                                        ${msg.sender === 'user' ? 'Cliente' : 'Agente IA'}
                                    </strong>
                                    <small class="text-muted">${new Date(msg.timestamp).toLocaleString('pt-BR')}</small>
                                </div>
                                <div class="mt-2">${msg.message}</div>
                            </div>
                        `).join('') : '<div class="text-center text-muted py-4"><i class="fas fa-comment-slash me-2"></i>Nenhuma mensagem encontrada</div>'}
                    </div>
                </div>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading lead details:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Rota para salvar prompt
router.post('/prompt', async (req, res) => {
    try {
        const newPrompt = req.body.prompt;
        await fs.writeFile('./prompt.js', newPrompt, 'utf-8');
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error updating prompt:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Rota para página de simulação
router.get('/simulator', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard-simulator.html'));
});

// Rota para análise IA
router.get('/ai-analysis', async (req, res) => {
    try {
        // Busca últimos resultados de simulação
        const latestResults = await getLatestSimulationResults();
        
        // Executa análise IA
        const analyzer = new AIConversationAnalyzer();
        const analysis = await analyzer.analyzeSimulationResults(latestResults);
        
        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 Análise IA - Gabriel Humano 2.0</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        </head>
        <body>
            <div class="container-fluid py-4">
                <h1 class="text-center mb-4">
                    🤖 <span class="text-primary">Análise IA</span> - Gabriel Humano 2.0
                </h1>
                
                <!-- Resumo Executivo -->
                <div class="card mb-4">
                    <div class="card-header bg-primary text-white">
                        <h3><i class="fas fa-brain me-2"></i>Resumo Executivo</h3>
                    </div>
                    <div class="card-body">
                        <div id="executive-summary">${analysis.executiveSummary || 'Análise não disponível'}</div>
                    </div>
                </div>
                
                <!-- Padrões de Conversação -->
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-header bg-success text-white">
                                <h4><i class="fas fa-comments me-2"></i>Padrões de Sucesso</h4>
                            </div>
                            <div class="card-body">
                                <div id="success-patterns">
                                    ${JSON.stringify(analysis.conversationPatterns?.success || {}, null, 2)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-header bg-danger text-white">
                                <h4><i class="fas fa-exclamation-triangle me-2"></i>Gargalos Identificados</h4>
                            </div>
                            <div class="card-body">
                                <div id="bottlenecks">
                                    ${JSON.stringify(analysis.bottlenecks || {}, null, 2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Sugestões de Melhoria -->
                <div class="card mb-4">
                    <div class="card-header bg-warning text-dark">
                        <h3><i class="fas fa-lightbulb me-2"></i>Sugestões de Melhoria</h3>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4">
                                <h5 class="text-success">🚀 Imediatas</h5>
                                <div id="immediate-improvements">
                                    ${JSON.stringify(analysis.improvements?.immediate || {}, null, 2)}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <h5 class="text-warning">⚡ Táticas</h5>
                                <div id="tactical-improvements">
                                    ${JSON.stringify(analysis.improvements?.tactical || {}, null, 2)}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <h5 class="text-info">🎯 Estratégicas</h5>
                                <div id="strategic-improvements">
                                    ${JSON.stringify(analysis.improvements?.strategic || {}, null, 2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Otimizações de Prompt -->
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <h3><i class="fas fa-code me-2"></i>Otimizações de Prompt</h3>
                    </div>
                    <div class="card-body">
                        <pre><code id="prompt-optimizations">${analysis.promptOptimizations || 'Nenhuma otimização disponível'}</code></pre>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `);
    } catch (error) {
        res.status(500).send('Erro na análise IA: ' + error.message);
    }
});

// API para executar simulação
router.post('/api/simulate', async (req, res) => {

    try {
        const { MassiveSimulator } = require('./massive-simulator');
        const { PatternAnalyzer } = require('./pattern-analyzer');
        const { PromptOptimizer } = require('./prompt-optimizer');
        
        const simulator = new MassiveSimulator();
        const analyzer = new PatternAnalyzer();
        const optimizer = new PromptOptimizer();
        
        // Executar simulação
        const results = await simulator.runFullSimulation(req.body);
        
        // Analisar padrões
        const patterns = await analyzer.analyzeResults('simulation-results.json');
        
        // Otimizar prompts
        const optimizations = await optimizer.optimizePrompts(patterns.patterns, patterns.recommendations);
        
        res.json({
            success: true,
            results,
            patterns: patterns.patterns,
            recommendations: patterns.recommendations,
            optimizations
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Função auxiliar para buscar últimos resultados de simulação
async function getLatestSimulationResults() {
    try {
        const files = await fs.readdir('.');
        const simulationFiles = files.filter(file => file.startsWith('simulation-results-'));
        
        if (simulationFiles.length === 0) {
            return { conversations: [], summary: 'Nenhuma simulação encontrada' };
        }
        
        // Pegar o arquivo mais recente
        const latestFile = simulationFiles.sort().pop();
        const content = await fs.readFile(latestFile, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Erro ao buscar resultados de simulação:', error);
        return { conversations: [], summary: 'Erro ao carregar simulações' };
    }
}

module.exports = router;