const express = require('express');
const router = express.Router();
const LeaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware')
// const updateInterval = 60 * 1000;
// const updateInterval1 = 10000;

router.get('/leave-details', authMiddleware.whiteListed, LeaveController.getLeaveDetails);
router.get('/leave-balance', authMiddleware.whiteListed, LeaveController.getLeaveBalance);
router.get('/forfeited-leave', authMiddleware.whiteListed, LeaveController.getForfeitedLeave);
router.get('/All-Leave-Balance', authMiddleware.whiteListed, LeaveController.getAllLeaveBalance);
router.post('/admin-action', authMiddleware.whiteListed, authMiddleware.isAdmin, LeaveController.updateLeaveAction);
router.get('/rejected-leaves', authMiddleware.whiteListed, authMiddleware.isAdmin, LeaveController.getRejectedLeaves);
router.get('/approved-leaves', authMiddleware.whiteListed, authMiddleware.isAdmin, LeaveController.getApprovedLeaves);
router.get('/pending-leaves', authMiddleware.whiteListed, authMiddleware.isAdmin, LeaveController.getPendingLeaves);
router.post('/leave-request', authMiddleware.whiteListed, LeaveController.createLeaveRequest);
router.put('/editleave-request/:LeaveID', authMiddleware.whiteListed, LeaveController.updateLeaveRequest);
router.delete('/delete-leave/:LeaveID', authMiddleware.whiteListed, LeaveController.deleteLeave);


// setInterval(LeaveController.updateLeaveValue, updateInterval);
// setInterval(LeaveController.updateLeaveBalanceYearly, updateInterval);


module.exports = router;
