const router = require('express').Router();
const ctrl = require('../controllers/configController');

router.get('/', ctrl.list);
router.get('/:key', ctrl.getByKey);
router.put('/:key', ctrl.update);

module.exports = router;
