require("dotenv").config();
const dns = require("dns");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Fix for querySrv ECONNREFUSED: force Node to use public DNS resolvers
// instead of the OS/ISP-assigned ones, which sometimes block or fail
// SRV record lookups that mongodb+srv:// connection strings depend on.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});