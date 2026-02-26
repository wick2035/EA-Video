const router = require('express').Router();
const ctrl = require('../controllers/doctorController');
const { validate, schemas } = require('../middleware/validator');

router.get('/online', ctrl.listOnline);
router.get('/', ctrl.list);
router.get('/:uuid', ctrl.getByUuid);
router.post('/', validate(schemas.createDoctor), ctrl.create);
router.put('/:uuid', ctrl.update);
router.delete('/:uuid', ctrl.softDelete);
router.patch('/:uuid/status', ctrl.updateOnlineStatus);

module.exports = router;
