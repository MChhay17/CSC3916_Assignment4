const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define actor subdocument schema
const ActorSchema = new Schema({
  actorName: { type: String, required: true },
  characterName: { type: String, required: true }
}, { _id: false }); // prevent _id field on each actor object

// Movie schema
const MovieSchema = new Schema({
  title: { type: String, required: true },
  year: { type: String, required: true },
  genre: {
    type: String,
    required: true,
    enum: [
      'Action', 'Adventure', 'Comedy', 'Drama',
      'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western'
    ]
  },
  actors: {
    type: [ActorSchema],
    required: true,
    validate: {
      validator: function (val) {
        return val.length >= 3;
      },
      message: 'A movie must have at least 3 actors.'
    }
  },
  imageURL: { type: String, required: true }
});

// Export the Movie model
module.exports = mongoose.model('Movie', MovieSchema);
