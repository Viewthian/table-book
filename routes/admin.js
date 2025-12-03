const express = require('express');
const router = express.Router();

// Mock storage (replace with DB later)
let pricePerNight = 2500;
let bookings = [
  { id: 1, name: 'John Doe', checkin: '2025-08-14', checkout: '2025-08-16', nights: 2, totalPrice: 5000, paid: true },
  { id: 2, name: 'Jane Smith', checkin: '2025-08-20', checkout: '2025-08-22', nights: 2, totalPrice: 5000, paid: false }
];

// Middleware for basic auth
function auth(req, res, next) {
  const auth = { login: "admin", password: "pppm111" } // 👈 change credentials

  const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')

  if (login && password && login === auth.login && password === auth.password) {
    return next()
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin Area"')
  res.status(401).send('Authentication required.')
} 

// Admin page
router.get('/pm-admin', auth, (req, res) => {
  res.render('admin', { pricePerNight, bookings })
});

// Update price
router.post('/price', auth, (req, res) => {
  pricePerNight = parseInt(req.body.price, 10);
  res.redirect('/pm-admin');
});

// Add booking
router.post('/booking', auth, (req, res) => {
  const { name, checkin, checkout, nights, totalPrice, paid } = req.body;
  const id = bookings.length ? bookings[bookings.length - 1].id + 1 : 1;
  bookings.push({ id, name, checkin, checkout, nights, totalPrice, paid: paid === 'on' });
  res.redirect('/pm-admin');
});

// Edit booking
router.post('/booking/:id/edit', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const booking = bookings.find(b => b.id === id);
  if (booking) {
    booking.name = req.body.name;
    booking.checkin = req.body.checkin;
    booking.checkout = req.body.checkout;
    booking.nights = req.body.nights;
    booking.totalPrice = req.body.totalPrice;
    booking.paid = req.body.paid === 'on';
  }
  res.redirect('/pm-admin');
});

// Delete booking
router.post('/booking/:id/delete', auth, (req, res) => {
  bookings = bookings.filter(b => b.id !== parseInt(req.params.id));
  res.redirect('/pm-admin');
});

module.exports = router;
