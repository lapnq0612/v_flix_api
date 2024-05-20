const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  author: {
    type: String,
    required: true,
  },
  idFilm: {
    type: String,
    required: true
  },
  prices: {
    type: Number,
    required: true
  },
  state: {
    type: 'Success' | 'Cancel',
  },
  date: {
    type: Date,
    default: Date.now,
  }
})

module.exports = Payment = mongoose.model('Payment', PaymentSchema)