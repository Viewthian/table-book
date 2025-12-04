// Manage routing
require('dotenv').config();
const express = require('express')
const router = express.Router()
const bcrypt = require("bcrypt");
// const path = require('path')    //ใช้เพื่ออ้างอิงตำแหน่งไฟล์

//เรียกใช้งาน model
const bookTable = require('../models/table-booking.js')  
const memberTable = require('../models/members.js')  
const { error } = require('console')
const checkTimeConflict  = require('../utils/check-availability');
const requireAdmin = require('../utils/basic-auth');
const { format } = require("date-fns");
const { th } = require("date-fns/locale");
const { render } = require('ejs');

const BASIC_AUTH_USER = process.env.admin;
const BASIC_AUTH_PASS = process.env.adminPassword;

//Load Login Page
router.get('/login', (req, res) => {
  res.render('login');
})

//login new version (get username/password from DB)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await memberTable.findOne({ username });

    if (!user) {
      return res.render("login", { error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.render("login", { error: "Invalid username or password" });
    }

    // Store session
    req.session.login = true;
    req.session.userId = user._id;
    req.session.username = user.username;

    // ✔ Correct admin flag
    req.session.isAdmin = (user.username === "admin");

    // ✔ Redirect correctly
    if (req.session.isAdmin) {
      return res.redirect("/booking-list");
    }

    return res.redirect("/booking-list");
  } catch (err) {
    console.error(err);
    return res.render("login", { error: "Something went wrong." });
  }
});

// Go to index page, no idea to provide any contents yet
router.get('/', (req, res) => {
    if (req.session.login) {
        res.render('index', {
        errors: {},
        username: req.session.username,
        isAdmin: req.session.isAdmin,
        isLogin: req.session.login
      });
    } else {
        res.render('login');
    }
});


// Display Reservation Page (show only upcoming reservations)
router.get("/booking-list", async (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }

  try {
    const filter = req.query.filter || "incoming"; // default incoming
    const sortParam = req.query.sort || "incoming";
    const limit = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Fresh "now" timestamp (moment in time). Do NOT mutate this object later.
    const now = new Date();

    const query = {};

    if (filter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      query.reservationDateTime = { $gte: start, $lte: end };

    } else if (filter === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      query.reservationDateTime = { $gte: firstDay, $lte: lastDay };

    } else if (filter === "thisYear") {
      // ⭐ NEW: Whole year
      const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      query.reservationDateTime = { $gte: yearStart, $lte: yearEnd };

    } else if (filter === "incoming") {
      // Only future bookings
      query.reservationDateTime = { $gte: new Date() };

    } else {
      // Default fallback = incoming
      query.reservationDateTime = { $gte: new Date() };
    }


    // Sorting logic
    let sortQuery = { reservationDateTime: 1 }; // default: soonest first
    if (sortParam === "oldest") sortQuery = { reservationDateTime: 1 };
    if (sortParam === "newest") sortQuery = { createdAt: -1 };
    if (sortParam === "incoming") sortQuery = { reservationDateTime: 1 };

    // Fetch only future bookings according to the query
    const [bookings, totalCount] = await Promise.all([
      bookTable.find(query).sort(sortQuery).skip(skip).limit(limit).lean(),
      bookTable.countDocuments(query)
    ]);

    // (optional) debug - remove in production
    // console.log("Filter query:", query);
    // console.log("Now:", new Date());

    return res.render("booking-list", {
      bookings,
      filter,
      sort: sortParam,
      limit,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });

  } catch (err) {
    console.error("Error in /booking-list:", err);
    return res.status(500).send("Error loading booking list");
  }
});




// Display Overview All Booking Data Over A Year
router.get("/dashboard", async (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

    /* --------------------------------------
      TODAY STATS (precise start/end)
    -------------------------------------- */
    const startOfToday = new Date(year, month, now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(year, month, now.getDate(), 23, 59, 59, 999);

    const todayTotalBookings = await bookTable.countDocuments({
      status: { $in: ["booked", "checkin"] },
      reservationDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayCheckin = await bookTable.countDocuments({
      status: "checkin",
      reservationDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    /* --------------------------------------
      MONTHLY BOOKINGS FOR CARDS (this calendar month)
      -> include only booked & checkin statuses for the monthly total
    -------------------------------------- */
    const startOfCurrentMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfCurrentMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const monthlyBookings = await bookTable.countDocuments({
      status: { $in: ["booked", "checkin"] },
      reservationDateTime: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
    });

    /* --------------------------------------
      TOTAL BOOKINGS (this year)
      -> use the full year range for the current year
    -------------------------------------- */
    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const totalBookingsThisYear = await bookTable.countDocuments({
      reservationDateTime: { $gte: startOfYear, $lte: endOfYear }
    });

    /* --------------------------------------
      STACKED BAR CHART: BOOKED VS CHECKIN (per month)
      -> run counts in parallel for speed and accuracy
    -------------------------------------- */
    const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const bookedPromises = [];
    const checkinPromises = [];

    for (let i = 0; i < 12; i++) {
      const startOfMonth = new Date(year, i, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, i + 1, 0, 23, 59, 59, 999);

      // pushed as promises to execute in parallel
      bookedPromises.push(
        bookTable.countDocuments({
          status: { $in: ["booked", "checkin"] },
          reservationDateTime: { $gte: startOfMonth, $lte: endOfMonth }
        })
      );

      checkinPromises.push(
        bookTable.countDocuments({
          status: "checkin",
          reservationDateTime: { $gte: startOfMonth, $lte: endOfMonth }
        })
      );
    }

    const bookedCounts = await Promise.all(bookedPromises);
    const checkinCounts = await Promise.all(checkinPromises);

    // console.log("Now:", now.toISOString());
    // console.log("StartOfCurrentMonth:", startOfCurrentMonth.toISOString());
    // console.log("EndOfCurrentMonth:", endOfCurrentMonth.toISOString());
    // console.log("monthlyBookings:", monthlyBookings);
    // console.log("totalBookingsThisYear:", totalBookingsThisYear);


    /* --------------------------------------
      SEND TO FRONTEND
    -------------------------------------- */
    res.render("dashboard", {
      todayCheckin,
      todayTotalBookings,
      monthlyBookings,
      totalBookingsThisYear,
      monthLabels,
      bookedCounts,
      checkinCounts,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Error loading dashboard");
  }
});

router.get("/book", (req, res) => {
  res.render("book", { 
    messages: req.flash(),
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    isLogin: req.session.login });
});

// Make reservation
router.post("/reserve", async (req, res) => {
  try {
    const { name, phone, email, zone, tableNo, guests, reservationDateTime, note } = req.body;

    const hasConflict = await checkTimeConflict({ reservationDateTime, tableNo });

    if (hasConflict) {
      req.flash("error", "❌ Reservation time overlaps with an existing booking!");
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
      createBy: req.session.username 
    });

    console.log(newBooking);

    await newBooking.save();
    res.redirect("/booking-list"); // back to admin page after saving
  } catch (err) {
    console.error(err);
    res.render("book", { error: "Internal server error" });
  }
});


// When customer come and check-in to get the table, staffs shall tick the checkbox
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


// Only Admin can see 'Add-Member' button on the dashboard page
router.get("/add-member", async (req, res) => {
  
    res.render("add-member", { 
    error: null, 
    success: null,
    username: req.session.username,
    isAdmin: req.session.isAdmin
   });
 
  
});

// HANDLE MEMBER CREATION
router.post("/add-member", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check for duplicate username/email
    const existing = await memberTable.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existing) {
      return res.render("add-member", { 
        error: "Username or Email already exists.",
        success: null
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new member
    await memberTable.create({
      username,
      email,
      passwordHash
    });

    return res.render("add-member", { 
      success: "Member created successfully!",
      error: null
    });

  } catch (err) {
    console.error(err);
    return res.render("add-member", { 
      error: "Something went wrong",
      success: null
    });
  }
});

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

router.get("/delete-booking/:id", async (req, res) => {
    try {
        await bookTable.findByIdAndDelete(req.params.id);
        res.redirect('/booking-list');
    } catch (err) {
        console.error("Error deleting booking:", err);
        res.status(500).send("Something went wrong");
    }
});

router.post("/create-admin", async (req, res) => {
  // Check for Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="User Visible Realm"');
    return res.status(401).send('Authentication required.');
  }

  // Decode base64 credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // Verify credentials
  if (username !== BASIC_AUTH_USER || password !== BASIC_AUTH_PASS) {
    return res.status(403).send('Forbidden: Invalid credentials');
  }

  // Proceed with your existing handler logic
  const { username: newUser, email, password: newPassword } = req.body;

  try {
    const existing = await memberTable.findOne({
      $or: [{ username: newUser }, { email }]
    });

    if (existing) {
      return res.render("create-admin", {
        error: "Username or Email already exists.",
        success: null
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await memberTable.create({
      username: newUser,
      email,
      passwordHash
    });

    return res.render("create-admin", {
      success: "Member created successfully!",
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.render("create-admin", {
      error: "Something went wrong",
      success: null
    });
  }
});


router.get("/pm-admin", (req,res)=>{
    if(req.session.login){
        res.render('form')
    }else{
        res.render('admin')
    }
    
})



router.get('/logout',(req,res)=>{
    req.session.destroy((err)=>{
        res.redirect('/login')
    })
    
})

// ======== Manage Members ============
router.get("/members", async (req, res) => {
  try {
    const members = await memberTable.find().sort({ createdAt: -1 });

    res.render("members", {
      members,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading members");
  }
});

router.get("/delete-member/:id", async (req, res) => {
  try {
    await memberTable.findByIdAndDelete(req.params.id);
    res.redirect("/members");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting member");
  }
});

router.get("/edit-member/:id", async (req, res) => {
  try {
    const member = await memberTable.findById(req.params.id);
    res.render("edit-member", { member });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error editing member");
  }
});

router.post("/edit-member/:id", async (req, res) => {
  const { username, email } = req.body;

  try {
    await memberTable.findByIdAndUpdate(req.params.id, {
      username,
      email
    });

    res.redirect("/members");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating member");
  }
});


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




