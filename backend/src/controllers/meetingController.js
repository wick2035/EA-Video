const { Meeting } = require('../models');
const meetingService = require('../services/meetingService');
const { Op } = require('sequelize');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, doctor_uuid, patient_uuid } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (doctor_uuid) where.doctor_uuid = doctor_uuid;
    if (patient_uuid) where.patient_uuid = patient_uuid;

    const { rows, count } = await Meeting.findAndCountAll({
      where,
      include: [
        { association: 'patient', attributes: ['uuid', 'name', 'phone'] },
        { association: 'doctor', attributes: ['uuid', 'name', 'specialty', 'is_online'] },
      ],
      offset: parseInt(offset, 10),
      limit: parseInt(limit, 10),
      order: [['created_at', 'DESC']],
    });

    res.json({ data: rows, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) { next(err); }
};

exports.getByUuid = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      where: { uuid: req.params.uuid },
      include: [
        { association: 'patient', attributes: ['uuid', 'name', 'phone', 'email'] },
        { association: 'doctor', attributes: ['uuid', 'name', 'specialty', 'department', 'is_online'] },
      ],
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    res.json(meeting);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const result = await meetingService.createMeeting({
      patientUuid: req.body.patient_uuid,
      doctorUuid: req.body.doctor_uuid,
      scenario: req.body.scenario,
      maxDuration: req.body.max_duration,
      scheduledAt: req.body.scheduled_at,
      isEncrypted: req.body.is_encrypted,
      notes: req.body.notes,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('already has')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
};

exports.start = async (req, res, next) => {
  try {
    const meeting = await meetingService.startMeeting(req.params.uuid);
    res.json(meeting);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('Cannot start')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
};

exports.end = async (req, res, next) => {
  try {
    const reason = req.body.reason || 'normal';
    const meeting = await meetingService.endMeeting(req.params.uuid, reason);
    res.json(meeting);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const meeting = await meetingService.cancelMeeting(req.params.uuid);
    res.json(meeting);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('Cannot cancel')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
};

exports.getJoinInfo = async (req, res, next) => {
  try {
    const { uuid, role } = req.params;
    if (!['doctor', 'patient'].includes(role)) {
      return res.status(400).json({ error: 'Role must be doctor or patient' });
    }
    const joinInfo = await meetingService.getJoinInfo(uuid, role);
    res.json(joinInfo);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('not joinable')) {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
};

exports.listActive = async (req, res, next) => {
  try {
    const meetings = await Meeting.findAll({
      where: { status: 'in_progress' },
      include: [
        { association: 'patient', attributes: ['uuid', 'name'] },
        { association: 'doctor', attributes: ['uuid', 'name', 'specialty'] },
      ],
      order: [['actual_start_at', 'ASC']],
    });
    res.json(meetings);
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = await meetingService.getStats();
    res.json(stats);
  } catch (err) { next(err); }
};
