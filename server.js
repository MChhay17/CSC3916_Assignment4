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
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

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

// Mount router before DB connects
app.use('/', router);

// Connect to MongoDB
mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.once('open', () => {
  console.log("MongoDB is fully connected");

  // GET /reviews
  router.get('/reviews', async (req, res) => {
    try {
      const reviews = await mongoose.connection.db
        .collection('reviews')
        .find({})
        .toArray();
      res.json(reviews);
    } catch (err) {
      console.error("Error in GET /reviews:", err);
      res.status(500).json({
        success: false,
        message: "Server error when fetching reviews",
        error: err.message
      });
    }
  });

  // POST /reviews
  router.post('/reviews', async (req, res) => {
    try {
      const { movieId, review, rating } = req.body;

      if (!movieId || !review || typeof rating !== 'number') {
        return res.status(400).json({ success: false, message: "Missing required fields: movieId, review, rating" });
      }

      const result = await mongoose.connection.db.collection('reviews').insertOne({
        movieId: new mongoose.Types.ObjectId(movieId),
        review,
        rating
      });

      res.status(201).json({ success: true, message: "Review added", id: result.insertedId });
    } catch (err) {
      console.error("Error in POST /reviews:", err);
      res.status(500).json({
        success: false,
        message: "Server error when adding review",
        error: err.message
      });
    }
  });

  // GET /movies with optional ?reviews=true
  router.get('/movies', async (req, res) => {
    try {
      const db = mongoose.connection.db;

      if (req.query.reviews === 'true') {
        const moviesWithReviews = await db.collection('movies').aggregate([
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'movieId',
              as: 'reviews'
            }
          }
        ]).toArray();

        res.json(moviesWithReviews);
      } else {
        const movies = await db.collection('movies').find({}).toArray();
        res.json(movies);
      }
    } catch (err) {
      console.error("Error in GET /movies:", err);
      res.status(500).json({
        success: false,
        message: "Error fetching movies",
        error: err.message
      });
    }
  });

  // GET /movies/:id with optional ?reviews=true
  router.get('/movies/:id', async (req, res) => {
    try {
      const movieId = new mongoose.Types.ObjectId(req.params.id);
      const db = mongoose.connection.db;

      if (req.query.reviews === 'true') {
        const movieWithReviews = await db.collection('movies').aggregate([
          { $match: { _id: movieId } },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'movieId',
              as: 'reviews'
            }
          }
        ]).toArray();

        if (movieWithReviews.length === 0) {
          return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        res.json(movieWithReviews[0]);
      } else {
        const movie = await db.collection('movies').findOne({ _id: movieId });

        if (!movie) {
          return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        res.json(movie);
      }
    } catch (err) {
      console.error("Error in GET /movies/:id:", err);
      res.status(500).json({
        success: false,
        message: "Error fetching movie",
        error: err.message
      });
    }
  });

  // Start server after DB connection
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

// Handle MongoDB connection errors
mongoose.connection.on('error', err => {
  console.error("MongoDB connection error:", err);
});


