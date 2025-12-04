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
  const products = await db.collection("products").find().toArray();
  res.render("admin-products", { title: "Manage Products", products });
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
  const { name, description, price } = req.body;
  let imageUrl = req.body.imageUrl; // Keep existing if no new upload
  if (req.file) {
    imageUrl = '/public/images/products/' + req.file.filename;
  }
  await db.collection("products").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { name, description, price: parseFloat(price), imageUrl, updatedAt: new Date() } }
  );
  res.redirect("/admin/products");
});

// Handle delete
router.post("/delete/:id", isAdmin, async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  await db.collection("products").deleteOne({ _id: new ObjectId(req.params.id) });
  res.redirect("/admin/products");
});

module.exports = router;
