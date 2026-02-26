const { v4: uuidv4 } = require('uuid');
const { Doctor, AuditLog } = require('../models');
const { Op } = require('sequelize');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, specialty } = req.query;
    const offset = (page - 1) * limit;
    const where = { is_active: 1 };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (specialty) where.specialty = specialty;

    const { rows, count } = await Doctor.findAndCountAll({
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
    const doctor = await Doctor.findOne({ where: { uuid: req.params.uuid, is_active: 1 } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const doctor = await Doctor.create({ ...req.body, uuid: uuidv4() });
    await AuditLog.create({ entity_type: 'doctor', entity_uuid: doctor.uuid, action: 'create', actor_type: 'admin' });
    res.status(201).json(doctor);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ where: { uuid: req.params.uuid } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    await doctor.update(req.body);
    await AuditLog.create({ entity_type: 'doctor', entity_uuid: doctor.uuid, action: 'update', actor_type: 'admin' });
    res.json(doctor);
  } catch (err) { next(err); }
};

exports.softDelete = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ where: { uuid: req.params.uuid } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    await doctor.update({ is_active: 0 });
    await AuditLog.create({ entity_type: 'doctor', entity_uuid: doctor.uuid, action: 'delete', actor_type: 'admin' });
    res.json({ message: 'Doctor deactivated' });
  } catch (err) { next(err); }
};

exports.listOnline = async (req, res, next) => {
  try {
    const doctors = await Doctor.findAll({ where: { is_online: 1, is_active: 1 } });
    res.json(doctors);
  } catch (err) { next(err); }
};

exports.updateOnlineStatus = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ where: { uuid: req.params.uuid } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    const newStatus = doctor.is_online ? 0 : 1;
    await doctor.update({ is_online: newStatus, last_seen_at: new Date() });

    // Broadcast status change
    if (req.app.get('io')) {
      req.app.get('io').to('dashboard').emit('doctor:status-changed', {
        doctorUuid: doctor.uuid,
        isOnline: newStatus === 1,
      });
    }

    res.json(doctor);
  } catch (err) { next(err); }
};
