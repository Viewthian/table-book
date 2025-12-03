require('dotenv').config();
//ใช้งาน mongoose
const mongoose = require('mongoose')
mongoose.set('strictQuery', false);

//เชื่อมไปยัง mongoDB
const dbUrl = 'mongodb://localhost:27017/tableDB'


//---------- connect DB on local ------------------//
mongoose.connect(dbUrl,{
    useNewUrlParser:true,
    useUnifiedTopology:true
}).catch(err=>console.log(err))

//---------- connect DB on server ------------------//
// mongoose.connect(process.env.MONGO_URL,{
//     useNewUrlParser:true,
//     useUnifiedTopology:true
// }).catch(err=>console.log(err))



// schema
let bookingTableSchema = mongoose.Schema({
    title: {type: String},
    name: { type: String, required: true },
    phone: { type: Number, required: true },
    email: { type: String, required: false },
    reservationDateTime: { type: Date, required: true },
    guests: { type: Number, required: true },
    zone: { type: String, required: true },
    tableNo: { type: String, required: true },
    note: { type: String, required: false },
    status: { type: String, enum: ['booked', 'checkin', 'cancelled'], default: 'booked' },
    bookingNumber: {type: String},
    createBy: {type: String},
    createdAt: { type: Date, default: Date.now }
})


//สร้าง model
let Booking = mongoose.model("books",bookingTableSchema)

//ส่งออก model
module.exports = Booking

//ออกแบบ function สำหรับบันทึกข้อมูล
module.exports.createBooking=function(model,data){      //createBooking คือชื่อ function จะทำงานใน model Booking
    model.save(data)
}