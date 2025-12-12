const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const isAdmin = require("../middleware/adminAuth");
const multer = require('multer');

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/products/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1]);
  }
});
const upload = multer({ storage: storage });

// Show all products
router.get("/", isAdmin, async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const { name, category } = req.query;
  let query = {};
  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }
  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }
  const products = await db.collection("products").find(query).toArray();
  res.render("admin-products", { title: "Manage Products", products, name, category });
});

// Show add product form
router.get("/new", isAdmin, (req, res) => {
  res.render("new-product", { title: "Add Product" });
});

// Handle add product
router.post("/new", isAdmin, upload.single('image'), async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const { name, description, price } = req.body;
  let imageUrl = null;
  if (req.file) {
    imageUrl = '/public/images/products/' + req.file.filename;
  }
  await db.collection("products").insertOne({
    name,
    description,
    price: parseFloat(price),
    imageUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  res.redirect("/admin/products");
});

// Show edit form
router.get("/edit/:id", isAdmin, async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const product = await db.collection("products").findOne({ _id: new ObjectId(req.params.id) });
  if (!product) return res.send("Product not found.");
  res.render("edit-product", { title: "Edit Product", product });
});

// Handle edit
router.post("/edit/:id", isAdmin, upload.single('image'), async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const { name, description, price, category } = req.body;
  let imageUrl = req.body.imageUrl; // Keep existing if no new upload
  if (req.file) {
    imageUrl = '/public/images/products/' + req.file.filename;
  }
  await db.collection("products").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { name, description, price: parseFloat(price), category, imageUrl, updatedAt: new Date() } }
  );
  res.redirect("/admin/products");
});

// Handle delete
router.post("/delete/:id", isAdmin, async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const productId = req.params.id;

  // Find the product to get its productId
  const product = await db.collection("products").findOne({ _id: new ObjectId(productId) });
  if (!product) {
    return res.status(404).send("Product not found.");
  }

  // Check for ongoing orders containing this product
  const ordersCollection = db.collection("orders");
  const ongoingStatuses = ["to_pay", "to_ship", "to_receive"];

  // Find orders that contain this product in their items
  const ordersWithProduct = await ordersCollection.find({
    "items.productId": product.productId,
    orderStatus: { $in: ongoingStatuses }
  }).toArray();

  if (ordersWithProduct.length > 0) {
    return res.status(400).send(`Cannot delete product "${product.name}" because it has ${ordersWithProduct.length} ongoing order(s). Please wait for order completion or cancel the orders first.`);
  }

  // Safe to delete
  await db.collection("products").deleteOne({ _id: new ObjectId(productId) });
  res.redirect("/admin/products");
});

module.exports = router;
