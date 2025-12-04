const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const isAdmin = require("../middleware/adminAuth");

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
const { v4: uuidv4 } = require("uuid");
router.post("/new", isAdmin, async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const { name, description, price, imageUrl } = req.body;
  await db.collection("products").insertOne({
    productId: uuidv4(),
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
router.post("/edit/:id", isAdmin, async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const { name, description, price, imageUrl } = req.body;
  const product = await db.collection("products").findOne({ _id: new ObjectId(req.params.id) });
  await db.collection("products").updateOne(
    { _id: new ObjectId(req.params.id) },
    {
      $set: {
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        updatedAt: new Date(),
        productId: product.productId || undefined
      },
    }
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