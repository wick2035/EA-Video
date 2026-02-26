const { v4: uuidv4 } = require('uuid');
const { Patient, AuditLog } = require('../models');
const { Op } = require('sequelize');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    const where = { is_active: 1 };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Patient.findAndCountAll({
      where,
      offset: parseInt(offset, 10),
      limit: parseInt(limit, 10),
      order: [['created_at', 'DESC']],
    });

    res.json({ data: rows, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) { next(err); }
};

exports.getByUuid = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ where: { uuid: req.params.uuid, is_active: 1 } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const patient = await Patient.create({ ...req.body, uuid: uuidv4() });
    await AuditLog.create({ entity_type: 'patient', entity_uuid: patient.uuid, action: 'create', actor_type: 'admin' });
    res.status(201).json(patient);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ where: { uuid: req.params.uuid } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.update(req.body);
    await AuditLog.create({ entity_type: 'patient', entity_uuid: patient.uuid, action: 'update', actor_type: 'admin' });
    res.json(patient);
  } catch (err) { next(err); }
};

exports.softDelete = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ where: { uuid: req.params.uuid } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.update({ is_active: 0 });
    await AuditLog.create({ entity_type: 'patient', entity_uuid: patient.uuid, action: 'delete', actor_type: 'admin' });
    res.json({ message: 'Patient deactivated' });
  } catch (err) { next(err); }
};
