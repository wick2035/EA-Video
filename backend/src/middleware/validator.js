const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }
    next();
  };
}

// Validation schemas
const schemas = {
  createPatient: Joi.object({
    name: Joi.string().max(100).required(),
    phone: Joi.string().max(20).allow(null, ''),
    email: Joi.string().email().max(100).allow(null, ''),
    gender: Joi.string().valid('male', 'female', 'other').allow(null),
    date_of_birth: Joi.date().allow(null),
    id_number: Joi.string().max(50).allow(null, ''),
    notes: Joi.string().allow(null, ''),
  }),

  createDoctor: Joi.object({
    name: Joi.string().max(100).required(),
    phone: Joi.string().max(20).allow(null, ''),
    email: Joi.string().email().max(100).allow(null, ''),
    specialty: Joi.string().max(100).allow(null, ''),
    title: Joi.string().max(50).allow(null, ''),
    department: Joi.string().max(100).allow(null, ''),
    max_meeting_duration: Joi.number().integer().min(1).allow(null),
  }),

  createMeeting: Joi.object({
    patient_uuid: Joi.string().uuid().required(),
    doctor_uuid: Joi.string().uuid().required(),
    scenario: Joi.string().max(50).default('general'),
    max_duration: Joi.number().integer().min(1).allow(null),
    scheduled_at: Joi.date().allow(null),
    is_encrypted: Joi.boolean().default(true),
    notes: Joi.string().allow(null, ''),
  }),

  endMeeting: Joi.object({
    reason: Joi.string().valid('normal', 'doctor_left', 'patient_left', 'system', 'error').default('normal'),
  }),
};

module.exports = { validate, schemas };
