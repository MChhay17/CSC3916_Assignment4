/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */


let envPath = __dirname + "/.env"
require('dotenv').config({path:envPath});
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Review = require('./Reviews');
var Movie = require('./Movies');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')
    // getting a movie
    .get(authJwtController.isAuthenticated, function (req, res) {
        if (req.query.reviews === "true") {
            Movie.aggregate()
                .match({title: req.query.title})
                .lookup({from: 'reviews', localField: 'title', foreignField: 'title', as: 'reviews'})
                .addFields({avgRating: {$avg: "$reviews.rating"}})
                .exec(function (err, movies) {
                    if (err) {
                        res.status(500).send(err);
                    } else if (movies.length === 0) {
                        res.status(404).json({ message: 'No reviews found for this movie.' });
                    } else {
                        res.json(movies[0]);
                    }
                })
        } else {
            Movie.findOne({title: req.query.title}, function (err, movie) {
                if (err)  throw err;
                else if (!movie) {
                    res.status(404).json({ message: 'Movie not found.' });
                } else {
                    res.json(movie);
                }
            })
        }
    })


    .post(authJwtController.isAuthenticated, function (req, res) {
    if (!req.body.title || !req.body.genre || !req.body.releaseYear || !req.body.actors) {
        res.json({success: false, msg: 'Please pass in all 4 required criteria in order to save a movie!'});
    } else {
        if (req.body.actors.length < 3) {
            res.json({ success: false, message: 'Please include at least three actors.' });
        } else {
            // Check if movie already exists
            Movie.findOne({ title: req.body.title }, function (err, existingMovie) {
                if (err) {
                    return res.send(err);
                }
                if (existingMovie) {
                    return res.json({ success: false, message: 'A movie with that title already exists.' });
                }
                // Save the movie
                var movie = new Movie();
                movie.title = req.body.title;
                movie.releaseYear = req.body.releaseYear;
                movie.genre = req.body.genre;
                movie.actors = req.body.actors;

                movie.save(function (err) {
                    if (err) {
                        return res.send(err);
                    }
                    res.json({ message: 'Movie has been successfully created.' });
                });
            });
        }
    }
})


    //Update movies
    .put(authJwtController.isAuthenticated, function(req, res) {
        if (!req.params.movieTitle) {
            res.json({success: false, msg: 'Please pass a Movie Title to update.'});
        } else {
            Movie.findOne({title: req.params.movieTitle}, function (err, movie) {
                if (err) throw err;
                else {
                    movie.releaseYear = req.body.releaseYear || movie.releaseYear;
                    movie.genre = req.body.genre || movie.genre;
                    movie.actors = req.body.actors || movie.actors;
     
                    movie.save(function (err) {
                        if (err) throw err;
     
                        res.json({success: true, msg: 'Movie has been successfully updated.'});
                    })
                }
            })
        }
     })

    //delete a movie
    .delete(authJwtController.isAuthenticated, function(req, res) {
        if (!req.body.title) {
            res.json({success: false, msg: 'Please input the an existing movie title to delete.'});
        }
        else {
            Movie.findOneAndRemove({title: req.body.title}, function (err) {
                if (err) throw err;
                res.json({success: true, msg: 'Movie has been successfully deleted.'});
            })
                //}
            //})
        }
    });

// reviews routes
router.route('/reviews')
    .post(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);
        if (!req.body.title || !req.body.author || !req.body.review || !req.body.score) {
            res.json({success: false, message: "An input should contian: title, name of the reviewer, review, and a score"});
        } else {
             Movie.findOne({ title: req.body.title }, (err, movie) => {
                if (err) {
                    return res.status(403).json({ success: false, message: "Error adding a review" });
                } else {
                    if (!movie) {
                        return res.status(403).json({ success: false, message: "movie title not found." });
                    } else {
                        var review = new Review();
                        review.title = req.body.title;
                        review.author = req.body.author;
                        review.review = req.body.review;
                        review.score = req.body.score;
                        review.save(function(err){
                            if (err) {
                                return res.json(err);
                            }
                            res.json({success: true, msg: 'Review was saved successfuly.'});
                        })
                    }
                }
            });
        }
    })
    .get(authJwtController.isAuthenticated, function (req, res) {
        Review.find({}, function(err, reviews) {
                res.json({Review: reviews});
        })
    });

app.use('/', router);
var port = process.env.PORT || 8080;
app.listen(port, function() {
    console.log("Server running on port " + port);
});
module.exports = app; // for testing only


