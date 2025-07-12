const logger = require('../utils/logger');
const { checkInstanceStatus } = require('../utils');
const { getLead } = require('../database');

class HealthMonitor {
    static async checkHealth() {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: await this.checkDatabase(),
                evolutionApi: await this.checkEvolutionAPI(),
                memory: this.checkMemory(),
                uptime: Math.floor(process.uptime())
            }
        };
        
        const unhealthyServices = Object.entries(health.services)
            .filter(([_, status]) => typeof status === 'object' ? status.status !== 'healthy' : status !== 'healthy');
            
        if (unhealthyServices.length > 0) {
            health.status = 'degraded';
        }
        
        return health;
    }
    
    static async checkDatabase() {
        try {
            await getLead('test');
            return { status: 'healthy', responseTime: Date.now() };
        } catch (error) {
            logger.error('Database health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    }
    
    static async checkEvolutionAPI() {
        try {
            const status = await checkInstanceStatus();
            return {
                status: status.connected ? 'healthy' : 'unhealthy',
                connected: status.connected,
                instanceStatus: status.status
            };
        } catch (error) {
            logger.error('Evolution API health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    }
    
    static checkMemory() {
        const usage = process.memoryUsage();
        const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
        const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const usagePercent = Math.round((usedMB / totalMB) * 100);
        
        return {
            status: usagePercent > 90 ? 'warning' : 'healthy',
            totalMB,
            usedMB,
            usagePercent
        };
    }
}

module.exports = HealthMonitor;