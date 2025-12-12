const express = require('express');
const router = express.Router();
const requireLogin = require('../middleware/requireLogin');
const adminAuth = require('../middleware/adminAuth');

// GET /admin/reports/sales - Sales Report Page
router.get('/sales', requireLogin, adminAuth, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const ordersCollection = db.collection("orders");

        // Get filter parameters
        const { startDate, endDate, status } = req.query;

        // Build query based on filters
        let query = {};
        let title = 'Sales Report';

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate + 'T00:00:00'),
                $lte: new Date(endDate + 'T23:59:59')
            };
            title += ` (${startDate} to ${endDate})`;
        }

        if (status && status !== 'all') {
            query.orderStatus = status;
            title += ` - ${status.replace('_', ' ').toUpperCase()}`;
        }

        // Get filtered orders
        const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();

        // Calculate summary statistics
        let totalRevenue = 0;
        let totalOrders = orders.length;
        let avgOrderValue = 0;

        if (totalOrders > 0) {
            totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
            avgOrderValue = totalRevenue / totalOrders;
        }

        // Calculate daily sales (last 30 days by default, or filtered range)
        const dailySales = {};
        const now = new Date();

        // Determine date range for daily sales
        let startRange = new Date(now);
        startRange.setDate(now.getDate() - 30); // Default 30 days
        let endRange = new Date(now);

        if (startDate && endDate) {
            startRange = new Date(startDate + 'T00:00:00');
            endRange = new Date(endDate + 'T23:59:59');
        }

        // Initialize daily sales object
        for (let d = new Date(startRange); d <= endRange; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0];
            dailySales[dateKey] = 0;
        }

        // Aggregate daily sales from orders
        orders.forEach(order => {
            if (order.createdAt && order.totalAmount) {
                const orderDate = new Date(order.createdAt);
                if (orderDate >= startRange && orderDate <= endRange) {
                    const dateKey = orderDate.toISOString().split('T')[0];
                    if (dailySales.hasOwnProperty(dateKey)) {
                        dailySales[dateKey] += Number(order.totalAmount);
                    }
                }
            }
        });

        // Convert to array for chart
        const chartLabels = Object.keys(dailySales).sort();
        const chartData = chartLabels.map(date => dailySales[date]);

        // Prepare data for view
        const reportData = {
            title,
            filters: { startDate, endDate, status },
            summary: {
                totalRevenue,
                totalOrders,
                avgOrderValue
            },
            dailySales: chartLabels.map(date => ({
                date,
                revenue: dailySales[date]
            })),
            chartLabels,
            chartData,
            orders: orders.slice(0, 10) // Show last 10 orders for reference
        };

        res.render('admin-sales-report', reportData);
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).render('500', { title: 'Server Error' });
    }
});

module.exports = router;
