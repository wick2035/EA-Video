const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_uuid: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  actor_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  actor_id: {
    type: DataTypes.STRING(36),
    allowNull: true,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  updatedAt: false,
});

module.exports = AuditLog;
