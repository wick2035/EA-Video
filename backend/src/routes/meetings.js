const router = require('express').Router();
const ctrl = require('../controllers/meetingController');
const { validate, schemas } = require('../middleware/validator');

router.get('/active', ctrl.listActive);
router.get('/stats', ctrl.getStats);
router.get('/', ctrl.list);
router.get('/:uuid', ctrl.getByUuid);
router.post('/', validate(schemas.createMeeting), ctrl.create);
router.patch('/:uuid/start', ctrl.start);
router.patch('/:uuid/end', ctrl.end);
router.patch('/:uuid/cancel', ctrl.cancel);
router.get('/:uuid/join/:role', ctrl.getJoinInfo);

module.exports = router;
