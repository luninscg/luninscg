// 7. Sistema de validação robusto
const Joi = require('joi');

const leadSchema = Joi.object({
  whatsapp_number: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
  name: Joi.string().min(2).max(100).required(),
  cpf: Joi.string().pattern(/^[0-9]{11}$/).required(),
  email: Joi.string().email().optional(),
  consumo_medio: Joi.number().positive().required()
});

function validateLead(data) {
  return leadSchema.validate(data);
}

module.exports = { validateLead };