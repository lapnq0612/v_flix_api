const express = require('express');
const Payment = require('../models/Payments');
const Router = express.Router();
const { v4: uuidv4 } = require('uuid');

const stripe = require("stripe")(process.env.STRIPE_SECRET);
const endpointSecret = "whsec_08a286229f322353ef7446d65ef2a1987b20be1fc8616296fd4229699b4ce477";

// @route POST post
// @desc Create A New Post
// @access Public
Router.post('/create-checkout-session', async (req, res) => {
  const { amount, customerId, customerEmail } = req.body;
  const paymentID = uuidv4()
  const customer = await stripe.customers.create({
    metadata: {
      user_id: customerId,
      id_payment: paymentID,
    }
  })

  try {
    const paymentIntent = await stripe.checkout.sessions.create({
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'A'
            },
            unit_amount: 200*100
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      success_url: 'https://forum.caeruxlab.com/d/63-tich-hop-stripe-va-nodejs',
      cancel_url: 'https://forum.caeruxlab.com/d/63-tich-hop-stripe-va-nodejs'
    });

    const newPayment = new Payment({
      customerId: customerId,
      idFilm: '65ea8f6c9eb39417a1c1696a',
      paymentId: paymentID,
    })
    await newPayment.save()
    res.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      data: paymentIntent.url
    });
  } catch (error) {
    console.error('Payment Intent creation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// http://localhost:9000/api/payment/webhook
Router.post('/webhook', async(req, res) => {
  let eventType, data;

  if (endpointSecret) {
    const payload = req.body;
    const payloadString = JSON.stringify(payload, null, 2);
    const header = stripe.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: endpointSecret,
    });

    let event;
    try {
      event = stripe.webhooks.constructEvent(payloadString, header, endpointSecret)
    } catch (error) {
      return {
        status: 400,
        message: 'Webhook signature verification failed',
        data: {}
      }
    }

    data = event.data.object;
    eventType = event.type;
  } else {
    data = req.body.data.object;
    eventType = req.body.type
  }

  if (eventType == "checkout.session.completed") {
    stripe.customers.retrieve(data.customer)
    .then(async (customer) => {
      const update = await Payment.findOneAndUpdate(
        { paymentId: customer.metadata.id_payment },
        {
          paymentStatus: 'actived'
        },
        { new: true }
      )
      res.json(update)
    })
    .catch(err => console.log(err.message))
  }
})

module.exports = Router;
