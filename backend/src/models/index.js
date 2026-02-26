const sequelize = require('../config/database');
const Patient = require('./Patient');
const Doctor = require('./Doctor');
const Meeting = require('./Meeting');
const SystemConfig = require('./SystemConfig');
const AuditLog = require('./AuditLog');

// Associations
Patient.hasMany(Meeting, { foreignKey: 'patient_uuid', sourceKey: 'uuid', as: 'meetings' });
Doctor.hasMany(Meeting, { foreignKey: 'doctor_uuid', sourceKey: 'uuid', as: 'meetings' });
Meeting.belongsTo(Patient, { foreignKey: 'patient_uuid', targetKey: 'uuid', as: 'patient' });
Meeting.belongsTo(Doctor, { foreignKey: 'doctor_uuid', targetKey: 'uuid', as: 'doctor' });

module.exports = {
  sequelize,
  Patient,
  Doctor,
  Meeting,
  SystemConfig,
  AuditLog,
};
