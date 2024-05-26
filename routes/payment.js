const express = require('express');
const Payment = require('../models/Payments');
const Film = require("../models/Film");
const Router = express.Router();
const { v4: uuidv4 } = require('uuid');

const stripe = require("stripe")(process.env.STRIPE_SECRET);
const endpointSecret = "whsec_08a286229f322353ef7446d65ef2a1987b20be1fc8616296fd4229699b4ce477";

// @route POST post
// @desc Create A New Post
// @access Public
Router.post('/create-checkout-session', async (req, res) => {
  const { amount, customerId, filmId, nameFilm } = req.body;
  const paymentID = uuidv4()
  const customer = await stripe.customers.create({
    metadata: {
      user_id: customerId,
      id_payment: paymentID,
      id_film: filmId,
    }
  })

  try {
    const paymentIntent = await stripe.checkout.sessions.create({
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: 'VND',
            product_data: {
              name: nameFilm
            },
            unit_amount: amount
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      success_url: 'http://localhost:3000/payment-success',
      cancel_url: 'http://localhost:3000/payment-success'
    });

    const newPayment = new Payment({
      customerId: customerId,
      idFilm: filmId,
      paymentId: paymentID,
      price: amount,
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
      
      const filmUpdate = await Film.findById(customer.metadata.id_film);
      filmUpdate.remainingAccountNumber = Number(filmUpdate.remainingAccountNumber) - 1;
      filmUpdate.save()

      res.json(update)
    })
    .catch(err => console.log(err.message))
  }
})

Router.post('/payment-bank', async (req, res) => {
  const { amount, customerId, filmId, nameFilm } = req.body;

  const newPayment = new Payment({
    customerId: customerId,
    idFilm: filmId,
    paymentId: paymentID,
    price: amount,
  })
  await newPayment.save()

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  const url = `http://localhost:3000/admin/manage/payment/${newPayment._id}`;
  var mainOptions = {
    from: "Vflix Support",
    to: email,
    subject: "Có một yêu cầu xác nhận thanh toán",
    html: `
      <div style='min-width: 100%; font-family: Helvetica,Arial,sans-serif; color: #333;'>
        <div style='width: 500px; border: 1px solid #ccc; border-radius: 8px; margin: 32px auto 0; padding: 40px'>
          <img
          style='width: 200px; display: block; margin: auto' src='https://res.cloudinary.com/nghiemduong2000/image/upload/v1618458158/VMOflix%20Project/VMOflix%20-%20base/VMOFLIX-02-02_bpjidv.png' alt="logo">
          <h2 style='font-size: 30px; line-height: 30px; margin: 50px 0  0; text-align:center'>Xin chào!</h2>
          <p style='text-align: center; margin: 20px 0 0; font-size: 14px'>Bạn nhận được email này vì chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
          <p style='text-align: center; margin-bottom: 30px; font-size: 14px'><strong>Nếu bạn không làm điều này,</strong> vui lòng bỏ qua email này và tuyệt đối không cung cấp nội dung email này cho người khác.</p>
          <p style='text-align: center; font-size: 14px'>Nhấn vào nút Đặt lại mật khẩu dưới đây để đặt mật khẩu mới</p>
          <a href=${url} target="_blank" style='text-decoration: none; display: block; text-align: center; padding: 14px 0; font-size: 20px; font-weight: bold; width: 100%; border-radius: 5px; border: none; background-color: rgb(229,9,20); color: white'>Đặt lại mật khẩu</a>
          <div style='padding: 20px 10px; background-color: #ddd; border-radius: 5px; margin-top: 40px'>
            <p style='margin: 0; text-align: center; margin-bottom: 5px; font-size: 14px'>Nút đặt lại mật khẩu không hoạt động? Bạn có thể sao chép liên kết sau và dán vào trình duyệt:</p>
            <a href=${url} target="_blank" style='text-decoration: none; color: rgb(229,9,20); display: block; text-align: center; font-size: 14px'>${url}</a>
          </div>
        </div>
      </div>
    `,
  };

  await User.findByIdAndUpdate(userExisting.id, { resetLink: token });

  transporter.sendMail(mainOptions, function (err, info) {
    if (err) {
      console.log(err);
      return res.status(400).json({
        msg: err.message,
      });
    } else {
      console.log("Message sent: " + info.response);
      return res.json({
        msg: "Email đã được gửi, vui lòng làm theo hướng dẫn",
      });
    }
  });
})


module.exports = Router;
