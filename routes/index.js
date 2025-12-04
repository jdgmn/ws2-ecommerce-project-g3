// routes/index.js
const express = require("express");
const router = express.Router();
const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

// home route
router.get("/", async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const products = await db.collection("products").find().limit(3).toArray(); // featured products
  res.render("index", {
    title: "Delulu Delata | Home",
    message: "Hello, MongoDB is connected!",
    featuredProducts: products,
    isLoggedIn: !!req.session.user,
    req: req,
  });
});

// products
router.get("/products", async (req, res) => {
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const products = await db.collection("products").find().toArray();
  const template = req.session.user ? "products" : "products-public";
  res.render(template, { title: "Products", products, isLoggedIn: !!req.session.user, req: req });
});

router.get("/about", (req, res) => {
  res.render("about", {
    title: "About Me",
    name: "Jonah De Guzman",
    description:
      "I am a web systems student building projects with Node.js, Express, and EJS.",
    isLoggedIn: !!req.session.user,
    req: req,
  });
});

// contact
router.get("/contact", (req, res) => {
  res.render("contact", {
    title: "Contact Us",
    isLoggedIn: !!req.session.user,
    req: req,
  });
});

// privacy
router.get("/privacy", (req, res) => {
  res.render("privacy", {
    title: "Privacy Policy",
    isLoggedIn: !!req.session.user,
    req: req,
  });
});

// terms
router.get("/terms", (req, res) => {
  res.render("terms", {
    title: "Terms & Conditions",
    isLoggedIn: !!req.session.user,
    req: req,
  });
});

// buy product
router.post("/buy", async (req, res) => {
  if (!req.session.user) return res.redirect('/users/login');
  const db = req.app.locals.client.db(req.app.locals.dbName);
  const { productId, quantity } = req.body;
  const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
  if (!product) return res.send('Product not found');
  const totalAmount = product.price * parseInt(quantity || 1);
  const order = {
    orderId: uuidv4(),
    userId: req.session.user.userId,
    userEmail: req.session.user.email,
    productId,
    productName: product.name,
    quantity: parseInt(quantity || 1),
    totalAmount,
    orderStatus: 'to_pay',
    createdAt: new Date()
  };
  await db.collection('orders').insertOne(order);
  res.redirect('/user/dashboard');
});

module.exports = router;
