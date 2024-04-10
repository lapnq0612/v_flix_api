const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const AccountFilmSchema = new Schema({
  film: {
    type: String,
    required: true,
  },
  account: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  userActive: {
    type: String,
    default: null,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  updatedDate: {
    type: Date,
    default: null,
  }
});

module.exports = AccountFilm = mongoose.model('AccountFilm', AccountFilmSchema);
