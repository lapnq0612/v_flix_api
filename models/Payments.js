const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PaymentsSchema = new Schema({
  paymentId: {
    type: String,
    require: true
  },
  customerId: {
    type: String,
    required: true,
  },
  idFilm: {
    type: String,
    required: true
  },
  paymentStatus: {
    // type: 'pending' | 'expired' | 'actived',
    type: String,
    required: true,
    default: 'pending'
  },
  paymentMethod: {
    // type: 'transfer' | 'stripe',
    type: String,
    required: true,
    default: 'stripe'
  },
  price: {
    type: Number,
    require: true,
  },
  date: {
    type: Date,
    default: Date.now,
  }
})

module.exports = Payment = mongoose.model('Payments', PaymentsSchema)