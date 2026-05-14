require('dotenv').config();
const mongoose = require("mongoose");
mongoose.set('strictQuery', false);

//เชื่อมไปยัง mongoDB
const dbUrl = 'mongodb://localhost:27017/tableDB'

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const ReservationSchema = new mongoose.Schema({

  bookingDateTime: {
  type: Date,
  required: true,
  index: true
},
  tables: {
    type: [String],
    required: true
  },

  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  transfer: {
    type: Number,
    required: true
  },

  // ✅ image path or URL
  image: {
    type: [String], // e.g. "/uploads/slip_123.jpg"
  },
  createBy: {
    type: String
  },
  remark: String,

  status: { type: String, enum: ['booked', 'checkin', 'cancelled'], default: 'booked' },

  bookingId: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const reservationStereo = mongoose.model("reserveStereo", ReservationSchema);
module.exports = reservationStereo;
