const express = require('express');
const router = express.Router();
const requireLogin = require('../middleware/requireLogin');
const adminAuth = require('../middleware/adminAuth');

// GET /admin/reports/sales - Sales Report Page
router.get('/sales', requireLogin, adminAuth, async (req, res) => {
    try {
        res.render('admin-sales-report', { title: 'Sales Report' });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).render('500', { title: 'Server Error' });
    }
});

module.exports = router;
