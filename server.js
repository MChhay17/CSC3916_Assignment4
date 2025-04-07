/*
CSC3916 HW4
File: server.js
Description: Web API scaffolding for Movie API
*/

const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authController = require('./auth');
const authJwtController = require('./auth_jwt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./Users');
const Movie = require('./Movies');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

// MongoDB connection
mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Router setup
const router = express.Router();

// Signup route
router.post('/signup', function (req, res) {
  if (!req.body.username || !req.body.password) {
    return res.json({ success: false, msg: 'Please include both username and password to signup.' });
  }

  const user = new User({
    name: req.body.name,
    username: req.body.username,
    password: req.body.password
  });

  user.save(function (err) {
    if (err) {
      if (err.code === 11000) {
        return res.json({ success: false, message: 'A user with that username already exists.' });
      } else {
        return res.json(err);
      }
    }
    res.json({ success: true, msg: 'Successfully created new user.' });
  });
});

// Signin route
router.post('/signin', function (req, res) {
  const userNew = new User({
    username: req.body.username,
    password: req.body.password
  });

  User.findOne({ username: userNew.username })
    .select('name username password')
    .exec(function (err, user) {
      if (err) res.send(err);
      if (!user) return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' });

      user.comparePassword(userNew.password, function (isMatch) {
        if (isMatch) {
          const userToken = { id: user.id, username: user.username };
          const token = jwt.sign(userToken, process.env.SECRET_KEY);
          res.json({ success: true, token: 'JWT ' + token });
        } else {
          res.status(401).send({ success: false, msg: 'Authentication failed. Wrong password.' });
        }
      });
    });
});

// ✅ GET /reviews — using raw collection access
router.get('/reviews', async (req, res) => {
  try {
    const db = mongoose.connection.db;

    if (!db) {
      return res.status(500).json({ success: false, message: "MongoDB not ready" });
    }

    const reviews = await db.collection('reviews').find({}).toArray();
    res.json(reviews);
  } catch (err) {
    console.error("❌ Error in GET /reviews:", err);
    res.status(500).json({
      success: false,
      message: "Server error when fetching reviews",
      error: err.message
    });
  }
});

// Mount the router
app.use('/', router);

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

module.exports = app;



