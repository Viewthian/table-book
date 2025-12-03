// Manage routing
require('dotenv').config();
const express = require('express')
const router = express.Router()
// const path = require('path')    //ใช้เพื่ออ้างอิงตำแหน่งไฟล์

//เรียกใช้งาน model
const bookTable = require('../models/table-booking.js')  
const { error } = require('console')
const checkTimeConflict  = require('../utils/check-availability');
const basicAuth = require('../utils/basic-auth');
const { format } = require("date-fns");
const { th } = require("date-fns/locale");

//upload file
// const multer  = require('multer')
// const Booking = require('../models/booking.js')

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, './public/images/products')   //ตำแหน่งเก็บไฟล์
//   },
//     filename: function (req, file, cb) {
//     // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
//     // cb(null, file.fieldname + '-' + uniqueSuffix)
//     cb(null,Date.now() + ".jpg") //ใช้ date ในการช่วยจัดเก็บซื่อไฟล์ ป้องกันการซ้ำ
//   }
// })

// const upload = multer({ 
//     storage: storage 
// })

// call function 'basicAuth' to protect website (using while under maintenance)
router.get('/', (req, res) => {
    
    res.render('index', {
    errors: {},
    formData: {}
  });
});

router.get('/admin-login', (req,res)=>{
    res.render('admin-login.ejs', {error})
})

router.post('/login', (req,res)=>{
    const username = req.body.username
    const password = req.body.password
    const timeExpire = 100000    //10วิ

    if(username == process.env.admin && password==process.env.password){
        // //สร้าง cookie
        // res.cookie('user_admin', username,{maxAge:timeExpire})    //user_admin คือชื่อของ cookie ที่จะเก็บ
        // res.cookie('password', password,{maxAge:timeExpire})    
        // res.cookie('login', true,{maxAge:timeExpire})    
        // res.redirect('/manage')

        //สร้าง session
        req.session.username = username
        req.session.password = password
        req.session.login = true
        req.session.cookie.maxAge = timeExpire
        res.redirect('admin-dashboard')
    }else{
        res.render('404')
    }
})

router.get("/book-form", (req, res) => {
  res.render("admin-book-form"); // this will be your calendar form page
});

// Admin page
router.get('/admin-dashboard', async (req, res) => {
  if (req.session.login) {
    try {
      // Get default price
      const room = await Prices.findOne({ name: 'default' }).lean();
      
      // Get all bookings
      const bookings = await Booking.find().lean();

      // Get Messages from Guests
      const contactus = await Contact.find().lean();

      // Get revenue
        const revenueData = await Booking.aggregate([
        {
            $group: {
            _id: {
                year: { $year: "$checkInDate" },
                month: { $month: "$checkInDate" }
            },
            totalRevenue: { $sum: "$amount" }
            }
        },
        {
            $sort: {
            "_id.year": 1,
            "_id.month": 1
            }
        }
        ]);

            // Transform for frontend (labels + values)
            const formatted = revenueData.map(r => ({
            year: r._id.year,
            month: r._id.month,
            totalRevenue: r.totalRevenue
        }));

        res.render('admin-dashboard', {
        defaultPrice: room ? room.defaultPrice : 0,
        priceId: room ? room._id : null,
        bookings,
        contactus,
        revenue: formatted 
        });
        } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
        }
    } else {
        res.render('admin-login');
  }
});


// Handle admin booking
router.post("/reserve", async (req, res) => {
  try {
    const { name, phone, email, zone, tableNo, guests, reservationDateTime, note, createBy } = req.body;

    const hasConflict = await checkTimeConflict({ reservationDateTime, tableNo });

    if (hasConflict) {
      req.flash("error", "Reservation time overlaps with an existing booking!");
      return res.redirect("/book");
    }
    

    const newBooking = new bookTable({
      name,
      phone,
      email,
      zone,
      tableNo,
      guests,
      reservationDateTime: new Date(reservationDateTime),
      note,
      createBy
    });

    console.log(newBooking);

    await newBooking.save();
    res.redirect("/booking-list"); // back to admin page after saving
  } catch (err) {
    console.error(err);
    res.render("book", { error: "Internal server error" });
  }
});

router.get("/book", (req, res) => {
  res.render("book", { messages: req.flash() });
});


router.get("/booking-list", async (req, res) => {
  try {
    let filter = req.query.filter || "all";
    let sort = req.query.sort || "incoming";
    let limit = Number(req.query.limit) || 10;
    let page = Number(req.query.page) || 1;

    const skip = (page - 1) * limit;

    const query = {};
    const now = new Date();

    if (filter === "today") {
      query.reservationDateTime = {
        $gte: new Date(now.setHours(0, 0, 0, 0)),
        $lte: new Date(now.setHours(23, 59, 59, 999))
      };
    }

    if (filter === "thisMonth") {
      query.reservationDateTime = {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0)
      };
    }

    if (filter === "incoming") {
      query.reservationDateTime = { $gte: new Date() }; // only future bookings
      sort = "incoming"; // override sorting for incoming
    }

    let sortQuery = { createdAt: -1 };

    if (sort === "oldest") sortQuery = { createdAt: 1 };
    if (sort === "newest") sortQuery = { createdAt: -1 };
    if (sort === "incoming") sortQuery = { reservationDateTime: 1 }; // soonest first

    const bookings = await bookTable
      .find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const totalCount = await bookTable.countDocuments(query);

    res.render("booking-list", {
      bookings,
      filter,
      sort,
      limit,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading booking list");
  }
});




router.post("/booking/checkin/:id", async (req, res) => {
  try {
    const { status } = req.body;

    await bookTable.findByIdAndUpdate(req.params.id, {
      status,
      checkin_time: new Date()
    });

    return res.json({ success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
});



router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();

    /* --------------------------------------
       TODAY STATS
    -------------------------------------- */
    const startOfToday = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);

    // Count TODAY bookings (status = booked)
    const todayTotalBookings = await bookTable.countDocuments({
      status: { $in: ["booked", "checkin"] },
      reservationDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    // Count TODAY check-ins (status = checkin)
    const todayCheckin = await bookTable.countDocuments({
      status: "checkin",
      reservationDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    /* --------------------------------------
       MONTHLY BOOKINGS FOR CARDS
    -------------------------------------- */
    const startOfCurrentMonth = new Date(year, now.getMonth(), 1);

    const monthlyBookings = await bookTable.countDocuments({
      reservationDateTime: { $gte: startOfCurrentMonth }
    });

    /* --------------------------------------
       TOTAL BOOKINGS (2025)
    -------------------------------------- */
    const totalBookings2025 = await bookTable.countDocuments({
      reservationDateTime: {
        $gte: new Date("2025-01-01"),
        $lte: new Date("2025-12-31")
      }
    });

    /* --------------------------------------
       STACKED BAR CHART: BOOKED VS CHECKIN
    -------------------------------------- */
    const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const bookedCounts = [];
    const checkinCounts = [];

    for (let i = 0; i < 12; i++) {
      const startOfMonth = new Date(year, i, 1);
      const endOfMonth = new Date(year, i + 1, 0, 23, 59, 59);

      // Count Booked
      const booked = await bookTable.countDocuments({
        status: { $in: ["booked", "checkin"] },
        reservationDateTime: { $gte: startOfMonth, $lte: endOfMonth }
      });

      // Count Check-in
      const checkin = await bookTable.countDocuments({
        status: "checkin",
        reservationDateTime: { $gte: startOfMonth, $lte: endOfMonth }
      });

      bookedCounts.push(booked);
      checkinCounts.push(checkin);

      
    }

    /* --------------------------------------
       SEND TO FRONTEND
    -------------------------------------- */
    res.render("dashboard", {
      todayCheckin,
      todayTotalBookings,
      monthlyBookings,
      totalBookings2025,
      monthLabels,
      bookedCounts,
      checkinCounts
      
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Error loading dashboard");
  }
});




// router.get("/dashboard", (req,res)=>{
//     res.render('dashboard')
// })

router.get("/menu", (req,res)=>{
    res.render('menu')
})

router.get("/about", (req,res)=>{
    res.render('about')
})

router.get("/book", (req,res)=>{
    res.render('book')
})

router.get("/contact", (req,res)=>{
    res.render('contact')
})


router.get('/members', (req,res)=>{
    res.render('members')  
})

router.post('/update-booking', async (req, res) => {
    try {
        const update_id = req.body.update_id;

        if (!update_id) {
            req.flash("error", "Missing booking ID");
            return res.redirect("/booking-list");
        }

        const { reservationDateTime, tableNo } = req.body;

        const conflict = await checkTimeConflict({
            reservationDateTime,
            tableNo,
            excludeId: update_id
        });

        if (conflict) {
            const booking = await bookTable.findById(update_id);
            return res.status(400).render("edit-booking", {
                booking,
                messages: { error: ["This table is already booked on this date."] }
            });
        } 

        const updatedData = {
            name: req.body.name,
            phone: req.body.phone,
            email: req.body.email,
            zone: req.body.zone,
            tableNo,
            guests: req.body.guests,
            reservationDateTime,
            note: req.body.note,
            createBy: req.body.createBy
        };

        await bookTable.findByIdAndUpdate(update_id, updatedData);
       
    } catch (err) {
        console.error("Error updating booking:", err);
        req.flash("error", "Something went wrong updating reservation.");
        return res.redirect(`/edit-booking/${req.body.update_id}`);
    }
});




router.get("/edit-booking/:id", async (req, res) => {
    const booking = await bookTable.findById(req.params.id);
    res.render("edit-booking", { booking, messages: {} });
});

// router.get("/edit-booking/:id", async (req, res) => {
//     const booking = await bookTable.findById(req.params.id);
//     res.render("edit-booking", {
//         booking,
//         messages: req.flash()
//     });
// });

router.get("/delete-booking/:id", async (req, res) => {
    try {
        await bookTable.findByIdAndDelete(req.params.id);
        res.redirect('/booking-list');
    } catch (err) {
        console.error("Error deleting booking:", err);
        res.status(500).send("Something went wrong");
    }
});


router.get("/pm-admin", (req,res)=>{
    if(req.session.login){
        res.render('form')
    }else{
        res.render('admin')
    }
    
})

// router.get("/booking-list", async (req, res) => {
//   let { search, filter } = req.query;
//   let query = {};

//   if (search) {
//     query.$or = [
//       { name: new RegExp(search, "i") },
//       { phone: new RegExp(search, "i") }
//     ];
//   }

//   if (filter === "today") {
//     const today = new Date();
//     const tomorrow = new Date(today);
//     tomorrow.setDate(today.getDate() + 1);

//     query.bookedDate = { $gte: today, $lt: tomorrow };
//   }

//   if (filter === "thisMonth") {
//     const now = new Date();
//     const start = new Date(now.getFullYear(), now.getMonth(), 1);
//     const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

//     query.bookedDate = { $gte: start, $lt: end };
//   }

//   let sort = {};
//   if (filter === "newest") sort.bookedDate = -1;
//   if (filter === "oldest") sort.bookedDate = 1;

//   const bookings = await bookTable.find(query).sort(sort);
//   res.render("booking-list", { bookings, search, filter });
// });



router.get('/logout',(req,res)=>{
    req.session.destroy((err)=>{
        res.redirect('/manage')
    })
    
})

// router.get("/delete/:id", (req,res)=>{
//     Product.findByIdAndDelete(req.params.id,{useFindAndModify:false}).exec(err=>{
//         if(err) console.log(err)
//         res.redirect('/manage')
//     })
// })




// router.post('/insert', (req,res)=>{     //upload.single('image')
//     console.log(req.body)
//     let data = new Product({
//         name:req.body.name,
//         price:req.body.price,
//         image:req.file.filename,     //เราได้ใช้ multer มาช่วยในการจัดการ file upload 
//         description:req.body.description
//     })
//     Product.saveProduct(data,(err)=>{
//         if(err) console.log(err)
//     })
//     res.redirect('/')      
// })




// router.get("/:id", (req,res)=>{
//     const product_id = req.params.id
//     Product.findOne({_id:product_id}).exec((err,doc)=>{
//          res.render('product',{product:doc})
//     })
// })

// router.post('/edit',(req,res)=>{
//     //รับค่า product id ที่ส่งมาจากหน้า manage
//     const edit_id = req.body.edit_id

//     //ส่งไปถาม DB ว่ามี product id อันนี้ไหม
//     Product.findOne({_id:edit_id}).exec((err,doc)=>{   //DB จะ return ออกมาเป็นรูปแบบ doc (object) ของ product นั้นๆ ไปแสดงใน form edit
//          res.render('edit',{product:doc})
//     })   
// })

// ====================================
// EXPORT CSV ROUTE
// ====================================
router.get("/export-csv", async (req, res) => {
  try {
    const bookings = await bookTable.find().sort({ reservationDateTime: 1 });

    let csv = "Name,Phone,Zone,Table,Guests,Reservation Date,Note,Status,Created At\n";

    bookings.forEach(b => {
      const reservationDate = format(new Date(b.reservationDateTime), 
        "dd MMMM yyyy HH:mm", { locale: th });

      const createdAt = format(new Date(b.createdAt), 
        "dd MMMM yyyy HH:mm", { locale: th });

      csv += `"${b.name}","${b.phone}","${b.zone}","${b.tableNo}","${b.guests}","${reservationDate}","${b.note || ""}","${b.status}","${createdAt}"\n`;
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=bookings.csv");
    res.send("\uFEFF" + csv);   // BOM for Excel Thai support

  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).send("Error exporting CSV");
  }
});





module.exports = router     //export module router ไปให้ index ใช้




