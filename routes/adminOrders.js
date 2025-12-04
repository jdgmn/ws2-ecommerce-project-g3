const express = require("express");
const router = express.Router();
const isAdmin = require("../middleware/adminAuth");
// GET /admin/orders – list all orders for admins
router.get("/orders", isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const ordersCollection = db.collection("orders");
    const usersCollection = db.collection("users");
    // Get all orders, newest first
    const orders = await ordersCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    // Extract unique userIds from orders
    const userIds = [...new Set(orders.map((order) => order.userId))];
    // Load users for those userIds
    const users = await usersCollection
      .find({ userId: { $in: userIds } })
      .toArray();
    // Attach user email to each order
    const ordersWithUser = orders.map((order) => {
      const user = users.find((u) => u.userId === order.userId);
      return {
        ...order,
        userEmail: user ? user.email : "Unknown",
      };
    });
    res.render("admin-orders", {
      title: "Admin – Orders",
      orders: ordersWithUser,
    });
  } catch (err) {
    console.error("Error loading orders:", err);

    res.status(500).send("Error loading orders.");
  }
});
// POST /admin/orders/update-status – update order status
router.post("/orders/update-status", isAdmin, async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    if (!orderId || !newStatus) {
      return res.status(400).send("Order ID and new status are required.");
    }
    const validStatuses = ["to_pay", "to_ship", "to_receive", "completed", "refund", "cancelled"];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).send("Invalid status.");
    }
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const ordersCollection = db.collection("orders");
    const result = await ordersCollection.updateOne(
      { orderId },
      { $set: { orderStatus: newStatus, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).send("Order not found.");
    }
    res.redirect("/admin/orders");
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).send("Error updating order status.");
  }
});

module.exports = router;
