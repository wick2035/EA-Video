const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Meeting = sequelize.define('Meeting', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  uuid: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    unique: true,
  },
  patient_uuid: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  doctor_uuid: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  room_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'expired'),
    defaultValue: 'scheduled',
  },
  scenario: {
    type: DataTypes.STRING(50),
    defaultValue: 'general',
  },
  max_duration_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  actual_start_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  actual_end_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  end_reason: {
    type: DataTypes.ENUM('normal', 'timeout', 'doctor_left', 'patient_left', 'system', 'error'),
    allowNull: true,
  },
  is_encrypted: {
    type: DataTypes.TINYINT(1),
    defaultValue: 1,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'meetings',
});

module.exports = Meeting;
