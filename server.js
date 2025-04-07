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

// AUTH ROUTES
router.post('/signup', (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.json({ success: false, msg: 'Please include both username and password.' });
  }

  const user = new User({
    name: req.body.name,
    username: req.body.username,
    password: req.body.password
  });

  user.save(err => {
    if (err) {
      if (err.code === 11000) {
        return res.json({ success: false, message: 'User already exists.' });
      } else {
        return res.json(err);
      }
    }
    res.json({ success: true, msg: 'User created.' });
  });
});

router.post('/signin', (req, res) => {
  const { username, password } = req.body;

  User.findOne({ username }).select('name username password').exec((err, user) => {
    if (err) return res.send(err);
    if (!user) return res.status(401).json({ success: false, msg: 'User not found.' });

    user.comparePassword(password, isMatch => {
      if (isMatch) {
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.SECRET_KEY);
        res.json({ success: true, token: 'JWT ' + token });
      } else {
        res.status(401).json({ success: false, msg: 'Wrong password.' });
      }
    });
  });
});

// CONNECT TO MONGO
mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.once('open', () => {
  console.log("MongoDB connected.");

  // GET /movies
  router.get('/movies', async (req, res) => {
    try {
      const db = mongoose.connection.db;

      if (req.query.reviews === 'true') {
        const result = await db.collection('movies').aggregate([
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'movieId',
              as: 'reviews'
            }
          }
        ]).toArray();

        return res.json(result);
      } else {
        const movies = await db.collection('movies').find({}).toArray();
        return res.json(movies);
      }
    } catch (err) {
      console.error("Error in GET /movies:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /movies/:id (with optional ?reviews=true)
  router.get('/movies/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const db = mongoose.connection.db;

      if (req.query.reviews === 'true') {
        const result = await db.collection('movies').aggregate([
          {
            $match: {
              $expr: {
                $eq: ['$_id', { $toObjectId: id }]
              }
            }
          },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'movieId',
              as: 'reviews'
            }
          }
        ]).toArray();

        if (result.length === 0) {
          return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        return res.json(result[0]);
      } else {
        const movieId = new mongoose.Types.ObjectId(id);
        const movie = await db.collection('movies').findOne({ _id: movieId });

        if (!movie) {
          return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        return res.json(movie);
      }
    } catch (err) {
      console.error("Error in GET /movies/:id:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /movies
  router.post('/movies', async (req, res) => {
    try {
      const { title, year, genre, actors, imageURL } = req.body;

      if (
        !title ||
        !year ||
        !genre ||
        !Array.isArray(actors) ||
        actors.length < 1 ||
        !imageURL
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields or not enough actors (minimum 1)."
        });
      }

      const newMovie = new Movie({
        title,
        year,
        genre,
        actors,
        imageURL
      });

      const savedMovie = await newMovie.save();
      res.status(201).json({ success: true, message: "Movie added", movie: savedMovie });

    } catch (err) {
      console.error("Error in POST /movies:", err.message);
      res.status(500).json({
        success: false,
        message: "Server error while adding movie",
        error: err.message
      });
    }
  });

  // GET /reviews
  router.get('/reviews', async (req, res) => {
    try {
      const reviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
      res.json(reviews);
    } catch (err) {
      console.error("Error in GET /reviews:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /reviews
  router.post('/reviews', async (req, res) => {
    try {
      const { movieId, review, rating } = req.body;

      if (!movieId || !review || typeof rating !== 'number') {
        return res.status(400).json({ success: false, message: 'Missing movieId, review, or rating' });
      }

      const result = await mongoose.connection.db.collection('reviews').insertOne({
        movieId: new mongoose.Types.ObjectId(movieId),
        review,
        rating,
        date: new Date()
      });

      res.status(201).json({ success: true, message: 'Review added', id: result.insertedId });
    } catch (err) {
      console.error("Error in POST /reviews:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health check
  router.get('/health', (req, res) => res.send("Server is running."));

  // Start the server
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

// Mount router
app.use('/', router);

// Handle MongoDB errors
mongoose.connection.on('error', err => {
  console.error("MongoDB connection error:", err);
});




