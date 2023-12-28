const express = require('express');
const router = express.Router();
const LeaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware')
// const updateInterval = 60 * 1000;
// const updateInterval1 = 10000;

router.get('/leave-details', authMiddleware.verifyToken, LeaveController.getLeaveDetails);
router.get('/leave-balance', authMiddleware.verifyToken, LeaveController.getLeaveBalance);
router.get('/All-Leave-Balance', authMiddleware.verifyToken, LeaveController.getAllLeaveBalance);
router.post('/admin-action', authMiddleware.verifyToken, authMiddleware.isAdmin, LeaveController.updateLeaveAction);
router.get('/rejected-leaves', authMiddleware.verifyToken, authMiddleware.isAdmin, LeaveController.getRejectedLeaves);
router.get('/approved-leaves', authMiddleware.verifyToken, authMiddleware.isAdmin, LeaveController.getApprovedLeaves);
router.get('/pending-leaves', authMiddleware.verifyToken, authMiddleware.isAdmin, LeaveController.getPendingLeaves);
router.post('/leave-request', authMiddleware.verifyToken, LeaveController.createLeaveRequest);
router.put('/editleave-request/:LeaveID', authMiddleware.verifyToken, LeaveController.updateLeaveRequest);
router.delete('/delete-leave/:LeaveID', authMiddleware.verifyToken, LeaveController.deleteLeave);


// setInterval(LeaveController.updateLeaveValue, updateInterval);
// setInterval(LeaveController.updateLeaveBalanceYearly, updateInterval);




module.exports = router;
