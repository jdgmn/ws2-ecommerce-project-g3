// server.js
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const session = require("express-session"); // Added for user sessions
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 3000;
const verifyTurnstile = require('./utils/turnstileVerify');

const path = require("path");
app.use("/styles", express.static(path.join(__dirname, "styles")));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// serve /public as static
app.use('/public', express.static('public'));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret", // keep secret in .env
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true only if using HTTPS
      maxAge: 15 * 60 * 1000, // 15 minutes (in milliseconds)
    },
  })
);

// near the top of server.js, after session middleware
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Routes
const indexRoute = require("./routes/index");
const usersRoute = require("./routes/users");
const passwordRoute = require("./routes/password");
app.use("/", indexRoute);
app.use("/users", usersRoute);
app.use("/password", passwordRoute);

// MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
// Expose client & dbName to routes
app.locals.client = client;
app.locals.dbName = process.env.DB_NAME || "ecommerceDB";
async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed", err);
  }
}

// 404 handler
app.use((req, res, next) => {
  res.status(404).render("404", { title: "Page Not Found" });
});

// 500 handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (res.headersSent) return next(err);
  res.status(500).render("500", { title: "Server Error" });
});

main();
