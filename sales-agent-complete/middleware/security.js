// 6. Implementar middleware de segurança
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: 'Muitas tentativas, tente novamente em 15 minutos'
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // máximo 5 requests para rotas sensíveis
  message: 'Limite excedido para esta operação'
});

module.exports = { apiLimiter, strictLimiter, helmet };