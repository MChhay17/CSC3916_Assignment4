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
const Movie = require('./Movies'); // Optional, keep if you're using movies

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

// Routes
const router = express.Router();

// ✅ Signup
router.post('/signup', function (req, res) {
  if (!req.body.username || !req.body.password) {
    return res.json({ success: false, msg: 'Please

