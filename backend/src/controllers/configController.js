const { SystemConfig, AuditLog } = require('../models');

exports.list = async (req, res, next) => {
  try {
    const configs = await SystemConfig.findAll({ order: [['category', 'ASC'], ['config_key', 'ASC']] });
    res.json(configs);
  } catch (err) { next(err); }
};

exports.getByKey = async (req, res, next) => {
  try {
    const config = await SystemConfig.findOne({ where: { config_key: req.params.key } });
    if (!config) return res.status(404).json({ error: 'Config not found' });
    res.json(config);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const config = await SystemConfig.findOne({ where: { config_key: req.params.key } });
    if (!config) return res.status(404).json({ error: 'Config not found' });

    const oldValue = config.config_value;
    await config.update({ config_value: req.body.config_value });

    await AuditLog.create({
      entity_type: 'config',
      entity_uuid: null,
      action: 'update',
      actor_type: 'admin',
      details: { key: req.params.key, oldValue, newValue: req.body.config_value },
    });

    res.json(config);
  } catch (err) { next(err); }
};
