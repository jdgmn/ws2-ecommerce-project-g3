// routes/index.js
const express = require("express");
const router = express.Router();

// home route
router.get("/", (req, res) => {
  res.render("index", {
    title: "Home Page",
    message: "Hello, MongoDB is connected!",
  });
});

// products
router.get("/products", (req, res) => {
  res.render("products", { title: "Products" });
});

router.get("/about", (req, res) => {
  res.render("about", {
    title: "About Me",
    name: "Jonah De Guzman",
    description:
      "I am a web systems student building projects with Node.js, Express, and EJS.",
  });
});

// contact
router.get("/contact", (req, res) => {
  res.render("contact", { title: "Contact Us" });
});

// privacy
router.get("/privacy", (req, res) => {
  res.render("privacy", { title: "Privacy Policy" });
});

// terms
router.get("/terms", (req, res) => {
  res.render("terms", { title: "Terms & Conditions" });
});

module.exports = router;
