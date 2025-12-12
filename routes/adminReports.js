const express = require('express');
const router = express.Router();
const requireLogin = require('../middleware/requireLogin');
const adminAuth = require('../middleware/adminAuth');
const XLSX = require('xlsx');

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

// GET /admin/reports/sales/export/daily - Export Daily Sales XLSX
router.get('/sales/export/daily', requireLogin, adminAuth, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const ordersCollection = db.collection("orders");

        // Get filter parameters
        const { startDate, endDate, status } = req.query;

        // Build query based on filters
        let query = {};

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate + 'T00:00:00'),
                $lte: new Date(endDate + 'T23:59:59')
            };
        }

        if (status && status !== 'all') {
            query.orderStatus = status;
        }

        // Get filtered orders
        const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();

        // If no orders found, include a no-data row but still create the spreadsheet
        if (orders.length === 0) {
            const excelData = [{
                'Date': 'No data available',
                'Revenue': 0
            }];

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Sales');

            worksheet['!cols'] = [
                { width: 20 }, // Date
                { width: 12 }  // Revenue
            ];

            const filename = `daily_sales_report_${new Date().toISOString().split('T')[0]}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            return res.send(excelBuffer);
        }

        // Calculate daily sales
        const dailySales = {};
        const now = new Date();

        let startRange = new Date(now);
        startRange.setDate(now.getDate() - 30);
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

        // Prepare data for Excel
        const excelData = Object.keys(dailySales).sort().map(date => ({
            'Date': date,
            'Revenue': dailySales[date]
        }));

        // Calculate total
        const totalRevenue = excelData.reduce((sum, row) => sum + row.Revenue, 0);
        excelData.push({
            'Date': 'TOTAL',
            'Revenue': totalRevenue
        });

        // Create Excel workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Sales');

        // Set column widths
        worksheet['!cols'] = [
            { width: 12 }, // Date
            { width: 12 }  // Revenue
        ];

        // Generate filename
        const filename = `daily_sales_report_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Send as download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.send(excelBuffer);

    } catch (error) {
        console.error('Error exporting daily sales:', error);
        res.status(500).send('Error generating export');
    }
});

// GET /admin/reports/sales/export/orders - Export Detailed Orders XLSX
router.get('/sales/export/orders', requireLogin, adminAuth, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const ordersCollection = db.collection("orders");

        // Get filter parameters
        const { startDate, endDate, status } = req.query;

        // Build query based on filters
        let query = {};

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate + 'T00:00:00'),
                $lte: new Date(endDate + 'T23:59:59')
            };
        }

        if (status && status !== 'all') {
            query.orderStatus = status;
        }

        // Get filtered orders
        const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();

        // Prepare data for Excel - handle empty results
        let excelData;
        if (orders.length === 0) {
            excelData = [{
                'Order ID': 'No orders available',
                'Date/Time': '',
                'User ID/Email': '',
                'Status': '',
                'Total Amount': 0
            }];
        } else {
            excelData = orders.map(order => ({
                'Order ID': `#${order.orderId.slice(-8)}`,
                'Date/Time': order.createdAt ? new Date(order.createdAt).toLocaleString() : '',
                'User ID/Email': order.userEmail || order.userId,
                'Status': order.orderStatus,
                'Total Amount': Number(order.totalAmount || 0)
            }));
        }

        // Create Excel workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Orders');

        // Set column widths
        worksheet['!cols'] = [
            { width: 12 }, // Order ID
            { width: 20 }, // Date/Time
            { width: 25 }, // User ID/Email
            { width: 12 }, // Status
            { width: 15 }  // Total Amount
        ];

        // Generate filename
        const filename = `detailed_orders_report_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Send as download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.send(excelBuffer);

    } catch (error) {
        console.error('Error exporting orders:', error);
        res.status(500).send('Error generating export');
    }
});

// GET /admin/reports/sales/print - Print view
router.get('/sales/print', requireLogin, adminAuth, async (req, res) => {
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

        // Calculate daily sales
        const dailySales = {};
        const now = new Date();

        let startRange = new Date(now);
        startRange.setDate(now.getDate() - 30);
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

        const dailySalesArray = Object.keys(dailySales).sort().map(date => ({
            date,
            revenue: dailySales[date]
        }));

        // Build filter summary with proper default handling
        const startDisplay = startDate || 'Beginning';
        const endDisplay = endDate || 'Present';
        const statusDisplay = status && status !== 'all' ? `, Status: ${status.replace('_', ' ').toUpperCase()}` : '';

        // Prepare data for print view
        const printData = {
            title,
            filters: { startDate: startDisplay, endDate: endDisplay, status },
            summary: {
                totalRevenue,
                totalOrders,
                avgOrderValue
            },
            dailySales: dailySalesArray,
            filterSummary: `${startDisplay} to ${endDisplay}${statusDisplay}`
        };

        res.render('admin-sales-print', printData);
    } catch (error) {
        console.error('Error generating print view:', error);
        res.status(500).render('500', { title: 'Server Error' });
    }
});

module.exports = router;
