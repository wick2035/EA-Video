const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemConfig = sequelize.define('SystemConfig', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  config_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  config_value: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(50),
    defaultValue: 'general',
  },
}, {
  tableName: 'system_configs',
});

module.exports = SystemConfig;
