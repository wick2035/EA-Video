const router = require('express').Router();
const ctrl = require('../controllers/patientController');
const { validate, schemas } = require('../middleware/validator');

router.get('/', ctrl.list);
router.get('/:uuid', ctrl.getByUuid);
router.post('/', validate(schemas.createPatient), ctrl.create);
router.put('/:uuid', ctrl.update);
router.delete('/:uuid', ctrl.softDelete);

module.exports = router;
