const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Doctor = sequelize.define('Doctor', {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  specialty: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  max_meeting_duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  is_online: {
    type: DataTypes.TINYINT(1),
    defaultValue: 0,
  },
  last_seen_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.TINYINT(1),
    defaultValue: 1,
  },
}, {
  tableName: 'doctors',
});

module.exports = Doctor;
