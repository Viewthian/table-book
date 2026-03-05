// Manage routing
require('dotenv').config();
const express = require('express')
const router = express.Router()
const bcrypt = require("bcrypt");
const upload = require("../utils/upload");

//เรียกใช้งาน model
const bookTable = require('../models/table-booking.js')  
const memberTable = require('../models/members.js')  
const Reservation  = require("../models/viewbar-reservation.js");   //DB reservation the view bar
const reservationCoolly  = require("../models/coolly-reservation.js");   //DB reservation coolly chef
const reservationViewVillage  = require("../models/view-village-reservation.js");   //DB reservation the view village
const reservationStereo  = require("../models/stereo-reservation.js");   //DB reservation the stereo
const tables = require("../public/js/viewbar-floor-data.js");
const coollyTables = require("../public/js/coolly-floor-data.js");
const viewVillageTables = require("../public/js/view-village-floor-data.js");
const stereoTables = require("../public/js/stereo-floor-data.js");

const staticElements = require("../public/js/viewbar-floor-elements.js");             // floor element to store layout like stage, bar, toilet, etc 
const coollyStaticElements = require("../public/js/coolly-floor-elements.js");
const viewVillageStaticElements = require("../public/js/view-village-floor-elements.js");
const stereoStaticElements = require("../public/js/stereo-floor-elements.js");

const { error } = require('console')
const checkTimeConflict  = require('../utils/check-availability');
const requireAdmin = require('../utils/basic-auth');
const { format } = require("date-fns");
const { th } = require("date-fns/locale");
const { render } = require('ejs');

const BASIC_AUTH_USER = process.env.admin;
const BASIC_AUTH_PASS = process.env.adminPassword;

new Date().toISOString()
function getTodayDateTH() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok"
  });
}

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
      return res.redirect("/");
    }

    return res.redirect("/");
  } catch (err) {
    console.error(err);
    return res.render("login", { error: "Something went wrong." });
  }
});

// Go to index page, no idea to provide any contents yet
router.get('/', (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }

  res.render('index', {
    errors: {},
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    isLogin: req.session.login
  });
});

//------------------ START THE VIEW VILLAGE SECTION----------------------//
router.get("/view-village-book", (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }
  const today = getTodayDateTH();

  res.render("view-village-floorplan", {
    tables: viewVillageTables,
    staticElements: viewVillageStaticElements,
    today: today,
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    isLogin: req.session.login
  });
});

router.get("/view-village-availability", async (req, res) => {
  const { date } = req.query; // yyyy-mm-dd

  if (!date) return res.status(400).json({ error: "Date required" });

  const start = new Date(date + "T00:00:00");
  const end = new Date(date + "T23:59:59");

  const reservations = await reservationViewVillage.find({
    bookingDateTime: { $gte: start, $lte: end }
  });

  const reservedMap = {};

  reservations.forEach(r => {
    r.tables.forEach(tableId => {
      reservedMap[tableId] = {
        name: r.name,
        phone: r.phone,
        bookingTime: r.bookingDateTime.toTimeString().slice(0,5),
        remark: r.remark || "-"
      };
    });
  });

  res.json({ reservedMap });
});

//Reseve the view village
router.post(
  "/reserve-view-village",
  (req, res, next) => {
    req.uploadFolder = "view-village";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Make sure user is logged in
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        name,
        phone,
        bookingDateTime,
        amount,
        transfer,
        remark,
        tables
      } = req.body;

      const booking = new reservationViewVillage({
        name,
        phone,
        bookingDateTime: new Date(bookingDateTime),
        amount,
        transfer,
        remark,
        createBy: req.session.username, // ✅ FROM SESSION
        tables: JSON.parse(tables),
        image: req.file ? `/uploads/view-village/${req.file.filename}` : null
      });

      await booking.save();

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  }
);


router.get("/view-village-booking-list", async (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }

  try {
    const filter = req.query.filter || "today";
    const sortParam = req.query.sort || "oldest";
    const limit = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const now = new Date();

    const search = req.query.search || "";

    // 🔹 NEW: selected date (default = today)
    const selectedDate =
      req.query.date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let matchStage = {};

    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }


    /* =====================================================
       🔥 DATE PICKER OVERRIDES FILTER
    ===================================================== */
    if (req.query.date) {
      const start = new Date(`${selectedDate}T00:00:00`);
      const end   = new Date(`${selectedDate}T23:59:59.999`);

      matchStage.bookingDateTime = { $gte: start, $lte: end };
    }
    /* =====================================================
       🔹 EXISTING FILTERS (UNCHANGED)
    ===================================================== */
    else {
      if (filter === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisMonth") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisYear") {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(
          now.getFullYear(),
          11,
          31,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

    }

    // 🔹 FETCH
    let bookings = await reservationViewVillage.find(matchStage).lean();

    // 🔹 SORT
    if (sortParam === "newest") {
      bookings.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      bookings.sort((a, b) => a.bookingDateTime - b.bookingDateTime);
    }

    const totalCount = bookings.length;
    const paginated = bookings.slice(skip, skip + limit);

    return res.render("view-village-booking-list", {
      bookings: paginated,
      filter,
      sort: sortParam,
      limit,
      search,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      selectedDate, // 🔥 PASS TO EJS
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });

  } catch (err) {
    console.error(err);
    return res.status(500).send("Error loading booking list");
  }
});

// When customer come and check-in to get the table, staffs shall tick the checkbox
router.post("/booking/view-village-checkin/:id", async (req, res) => {
  try {
    const { status } = req.body;

    await reservationViewVillage.findByIdAndUpdate(req.params.id, {
      status,
      checkin_time: new Date()
    });

    return res.json({ success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
});


router.get("/delete-view-village-booking/:id", async (req, res) => {
    try {
        await reservationViewVillage.findByIdAndDelete(req.params.id);
        res.redirect('/view-village-booking-list');
    } catch (err) {
        console.error("Error deleting booking:", err);
        res.status(500).send("Something went wrong");
    }
});

// Display Overview All Booking Data Over A Year
router.get("/view-village-dashboard", async (req, res) => {
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

    const todayTotalBookings = await reservationViewVillage.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayCheckin = await reservationViewVillage.countDocuments({
      status: "checkin",
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    /* --------------------------------------
      MONTHLY BOOKINGS FOR CARDS (this calendar month)
      -> include only booked & checkin statuses for the monthly total
    -------------------------------------- */
    const startOfCurrentMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfCurrentMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const monthlyBookings = await reservationViewVillage.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
    });

    /* --------------------------------------
      TOTAL BOOKINGS (this year)
      -> use the full year range for the current year
    -------------------------------------- */
    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const totalBookingsThisYear = await reservationViewVillage.countDocuments({
      bookingDateTime: { $gte: startOfYear, $lte: endOfYear }
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
        reservationViewVillage.countDocuments({
          status: { $in: ["booked", "checkin"] },
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
        })
      );

      checkinPromises.push(
        reservationViewVillage.countDocuments({
          status: "checkin",
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
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
    res.render("view-village-dashboard", {
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

// ====================================
// EXPORT CSV VIEW VILLAGE
// ====================================
router.get("/view-village-export-csv", async (req, res) => {
  try {

    const { date } = req.query;

    if (!date) {
      return res.status(400).send("Date is required");
    }

    // Create start and end of selected day
    const start = new Date(date);
    start.setHours(0,0,0,0);

    const end = new Date(date);
    end.setHours(23,59,59,999);

    const bookings = await reservationViewVillage.find({
      bookingDateTime: { $gte: start, $lte: end }
    }).sort({ bookingDateTime: 1 });

    let csv = "Name,Phone,Table,Amount,Reservation Date,Note,Status,Created By,Created At\n";

    bookings.forEach(b => {

      const reservationDate = format(
        new Date(b.bookingDateTime),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      const createdAt = format(
        new Date(b.createdAt),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      csv += `"${b.name}","${b.phone}","${b.tables}","${b.amount}","${reservationDate}","${b.remark || ""}","${b.status}","${b.createBy}","${createdAt}"\n`;

    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=view-village-${date}.csv`
    );

    res.send("\uFEFF" + csv);

  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).send("Error exporting CSV");
  }
});

//EDIT RESERVATION
router.get("/edit-booking-view-village/:id", async (req, res) => {
  try {
    if (!req.session || !req.session.username) {
      return res.status(401).render("login");
    }

    const booking = await reservationViewVillage.findById(req.params.id).lean();

    if (!booking) {
      return res.status(404).send("Booking not found");
    }

    res.render("edit-booking-view-village", {
      booking,
      tables: viewVillageTables,
      staticElements: viewVillageStaticElements,
      existingTables: booking.tables, // ✅ IMPORTANT
      image: req.file ? `/uploads/view-village/${req.file.filename}` : null,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });


  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading booking");
  }
});


router.post(
  "/update-view-village/:id",
  (req, res, next) => {
    req.uploadFolder = "view-village";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Auth check
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const update_id = req.params.id; // ✅ USE PARAM, NOT BODY
      if (!update_id) {
        return res.status(400).json({ error: "Missing booking ID" });
      }

      // ✅ Parse tables safely
      let tables = [];
      if (req.body.tables) {
        try {
          tables = JSON.parse(req.body.tables);
        } catch (e) {
          return res.status(400).json({ error: "Invalid tables data" });
        }
      }

      const updatedData = {
        name: req.body.name,
        phone: req.body.phone,
        bookingDateTime: new Date(req.body.bookingDateTime),
        amount: Number(req.body.amount),
        transfer: Number(req.body.transfer),
        remark: req.body.remark,
        createBy: req.session.username,
        tables
      };

      // ✅ Only overwrite image if new one uploaded
      if (req.file) {
        updatedData.image = `/uploads/view-village/${req.file.filename}`;
      }

      const updated = await reservationViewVillage.findByIdAndUpdate(
        update_id,
        updatedData,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      res.json({ success: true, data: updated });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

//---------------- END THE VIEW VILLAGE ----------------//

//------------------ VIEW BAR --------------------------//



router.get("/viewbar-booking-list", async (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }

  try {
    const filter = req.query.filter || "today";
    const sortParam = req.query.sort || "oldest";
    const limit = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const now = new Date();

    const search = req.query.search || "";

    // 🔹 NEW: selected date (default = today)
    const selectedDate =
      req.query.date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let matchStage = {};

    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }


    /* =====================================================
       🔥 DATE PICKER OVERRIDES FILTER
    ===================================================== */
    if (req.query.date) {
      const start = new Date(`${selectedDate}T00:00:00`);
      const end   = new Date(`${selectedDate}T23:59:59.999`);

      matchStage.bookingDateTime = { $gte: start, $lte: end };
    }
    /* =====================================================
       🔹 EXISTING FILTERS (UNCHANGED)
    ===================================================== */
    else {
      if (filter === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisMonth") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisYear") {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(
          now.getFullYear(),
          11,
          31,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

    }

    // 🔹 FETCH
    let bookings = await Reservation.find(matchStage).lean();

    // 🔹 SORT
    if (sortParam === "newest") {
      bookings.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      bookings.sort((a, b) => a.bookingDateTime - b.bookingDateTime);
    }

    const totalCount = bookings.length;
    const paginated = bookings.slice(skip, skip + limit);

    return res.render("viewbar-booking-list", {
      bookings: paginated,
      filter,
      sort: sortParam,
      limit,
      search,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      selectedDate, // 🔥 PASS TO EJS
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });

  } catch (err) {
    console.error(err);
    return res.status(500).send("Error loading booking list");
  }
});

// When customer come and check-in to get the table, staffs shall tick the checkbox
router.post("/booking/view-bar-checkin/:id", async (req, res) => {
  try {
    const { status } = req.body;

    await Reservation.findByIdAndUpdate(req.params.id, {
      status,
      checkin_time: new Date()
    });

    return res.json({ success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
});

router.get("/viewbar-book", (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }
  const today = getTodayDateTH();

  res.render("viewbar-floorplan", {
    tables: tables,
    staticElements: staticElements,
    today: today,
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    isLogin: req.session.login
  });
});

router.get("/availability", async (req, res) => {
  const { date } = req.query; // yyyy-mm-dd

  if (!date) return res.status(400).json({ error: "Date required" });

  const start = new Date(date + "T00:00:00");
  const end = new Date(date + "T23:59:59");

  const reservations = await Reservation.find({
    bookingDateTime: { $gte: start, $lte: end }
  });

  const reservedMap = {};

  reservations.forEach(r => {
    r.tables.forEach(tableId => {
      reservedMap[tableId] = {
        name: r.name,
        phone: r.phone,
        bookingTime: r.bookingDateTime.toTimeString().slice(0,5),
        remark: r.remark || "-"
      };
    });
  });

  res.json({ reservedMap });
});


//Reseve the view bar
router.post(
  "/reserve",
  (req, res, next) => {
    req.uploadFolder = "viewbar";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Make sure user is logged in
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        name,
        phone,
        bookingDateTime,
        amount,
        transfer,
        remark,
        tables
      } = req.body;

      const booking = new Reservation({
        name,
        phone,
        bookingDateTime: new Date(bookingDateTime),
        amount,
        transfer,
        remark,
        createBy: req.session.username, // ✅ FROM SESSION
        tables: JSON.parse(tables),
        image: req.file ? `/uploads/viewbar/${req.file.filename}` : null
      });

      await booking.save();

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  }
);

//EDIT RESERVATION
router.get("/edit-booking-viewbar/:id", async (req, res) => {
  try {
    if (!req.session || !req.session.username) {
      return res.status(401).render("login");
    }

    const booking = await Reservation.findById(req.params.id).lean();

    if (!booking) {
      return res.status(404).send("Booking not found");
    }

    res.render("edit-booking-viewbar", {
      booking,
      tables: tables,
      staticElements: staticElements,
      existingTables: Array.isArray(booking.tables)
        ? booking.tables
        : [],
      image: req.file ? `/uploads/viewbar/${req.file.filename}` : null,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });


  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading booking");
  }
});

router.post(
  "/update-viewbar/:id",
  (req, res, next) => {
    req.uploadFolder = "viewbar";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Auth check
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const update_id = req.params.id; // ✅ USE PARAM, NOT BODY
      if (!update_id) {
        return res.status(400).json({ error: "Missing booking ID" });
      }

      // ✅ Parse tables safely
      let tables = [];
      if (req.body.tables) {
        try {
          tables = JSON.parse(req.body.tables);
        } catch (e) {
          return res.status(400).json({ error: "Invalid tables data" });
        }
      }

      const updatedData = {
        name: req.body.name,
        phone: req.body.phone,
        bookingDateTime: new Date(req.body.bookingDateTime),
        amount: Number(req.body.amount),
        transfer: Number(req.body.transfer),
        remark: req.body.remark,
        createBy: req.session.username,
        tables
      };

      // ✅ Only overwrite image if new one uploaded
      if (req.file) {
        updatedData.image = `/uploads/viewbar/${req.file.filename}`;
      }

      const updated = await Reservation.findByIdAndUpdate(
        update_id,
        updatedData,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      res.json({ success: true, data: updated });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Display Overview All Booking Data Over A Year
router.get("/viewbar-dashboard", async (req, res) => {
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

    const todayTotalBookings = await Reservation.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayCheckin = await Reservation.countDocuments({
      status: "checkin",
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    /* --------------------------------------
      MONTHLY BOOKINGS FOR CARDS (this calendar month)
      -> include only booked & checkin statuses for the monthly total
    -------------------------------------- */
    const startOfCurrentMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfCurrentMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const monthlyBookings = await Reservation.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
    });

    /* --------------------------------------
      TOTAL BOOKINGS (this year)
      -> use the full year range for the current year
    -------------------------------------- */
    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const totalBookingsThisYear = await Reservation.countDocuments({
      bookingDateTime: { $gte: startOfYear, $lte: endOfYear }
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
        Reservation.countDocuments({
          status: { $in: ["booked", "checkin"] },
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
        })
      );

      checkinPromises.push(
        Reservation.countDocuments({
          status: "checkin",
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
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
    res.render("viewbar-dashboard", {
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

// ====================================
// EXPORT CSV VIEW BAR
// ====================================
router.get("/viewbar-export-csv", async (req, res) => {
  try {

    const { date } = req.query;

    if (!date) {
      return res.status(400).send("Date is required");
    }

    // Create start and end of selected day
    const start = new Date(date);
    start.setHours(0,0,0,0);

    const end = new Date(date);
    end.setHours(23,59,59,999);

    const bookings = await Reservation.find({
      bookingDateTime: { $gte: start, $lte: end }
    }).sort({ bookingDateTime: 1 });

    let csv = "Name,Phone,Table,Amount,Reservation Date,Note,Status,Created By,Created At\n";

    bookings.forEach(b => {

      const reservationDate = format(
        new Date(b.bookingDateTime),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      const createdAt = format(
        new Date(b.createdAt),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      csv += `"${b.name}","${b.phone}","${b.tables}","${b.amount}","${reservationDate}","${b.remark || ""}","${b.status}","${b.createBy}","${createdAt}"\n`;

    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=view-bar-${date}.csv`
    );

    res.send("\uFEFF" + csv);

  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).send("Error exporting CSV");
  }
});

//----------------------- END VIEW BAR ----------------------------------//

//------------------ STEREO BAR SECTOIN ----------------------//
router.get("/stereo-book", (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }
  const today = getTodayDateTH();

  res.render("stereo-floorplan", {
    tables: stereoTables,
    staticElements: stereoStaticElements,
    today: today,
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    isLogin: req.session.login
  });
});

router.get("/stereo-availability", async (req, res) => {
  const { date } = req.query; // yyyy-mm-dd

  if (!date) return res.status(400).json({ error: "Date required" });

  const start = new Date(date + "T00:00:00");
  const end = new Date(date + "T23:59:59");

  const reservations = await reservationStereo.find({
    bookingDateTime: { $gte: start, $lte: end }
  });

  const reservedMap = {};

  reservations.forEach(r => {
    r.tables.forEach(tableId => {
      reservedMap[tableId] = {
        name: r.name,
        phone: r.phone,
        bookingTime: r.bookingDateTime.toTimeString().slice(0,5),
        remark: r.remark || "-"
      };
    });
  });

  res.json({ reservedMap });
});

//Reseve stereo
router.post(
  "/reserve-stereo",
  (req, res, next) => {
    req.uploadFolder = "stereobar";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Make sure user is logged in
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        name,
        phone,
        bookingDateTime,
        amount,
        transfer,
        remark,
        tables
      } = req.body;

      const booking = new reservationStereo({
        name,
        phone,
        bookingDateTime: new Date(bookingDateTime),
        amount,
        transfer,
        remark,
        createBy: req.session.username, // ✅ FROM SESSION
        tables: JSON.parse(tables),
        image: req.file ? `/uploads/stereobar/${req.file.filename}` : null
      });

      await booking.save();

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  }
);


router.get("/stereo-booking-list", async (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }

  try {
    const filter = req.query.filter || "today";
    const sortParam = req.query.sort || "oldest";
    const limit = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const now = new Date();

    const search = req.query.search || "";

    // 🔹 NEW: selected date (default = today)
    const selectedDate =
      req.query.date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let matchStage = {};

    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }


    /* =====================================================
       🔥 DATE PICKER OVERRIDES FILTER
    ===================================================== */
    if (req.query.date) {
      const start = new Date(`${selectedDate}T00:00:00`);
      const end   = new Date(`${selectedDate}T23:59:59.999`);

      matchStage.bookingDateTime = { $gte: start, $lte: end };
    }
    /* =====================================================
       🔹 EXISTING FILTERS (UNCHANGED)
    ===================================================== */
    else {
      if (filter === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisMonth") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisYear") {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(
          now.getFullYear(),
          11,
          31,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

    }

    // 🔹 FETCH
    let bookings = await reservationStereo.find(matchStage).lean();

    // 🔹 SORT
    if (sortParam === "newest") {
      bookings.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      bookings.sort((a, b) => a.bookingDateTime - b.bookingDateTime);
    }

    const totalCount = bookings.length;
    const paginated = bookings.slice(skip, skip + limit);

    return res.render("stereo-booking-list", {
      bookings: paginated,
      filter,
      sort: sortParam,
      limit,
      search,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      selectedDate, // 🔥 PASS TO EJS
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });

  } catch (err) {
    console.error(err);
    return res.status(500).send("Error loading booking list");
  }
});

// When customer come and check-in to get the table, staffs shall tick the checkbox
router.post("/booking/stereo-checkin/:id", async (req, res) => {
  try {
    const { status } = req.body;

    await reservationStereo.findByIdAndUpdate(req.params.id, {
      status,
      checkin_time: new Date()
    });

    return res.json({ success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
});

router.get("/delete-stereo-booking/:id", async (req, res) => {
    try {
        await reservationStereo.findByIdAndDelete(req.params.id);
        res.redirect('/stereo-booking-list');
    } catch (err) {
        console.error("Error deleting booking:", err);
        res.status(500).send("Something went wrong");
    }
});

// Display Overview All Booking Data Over A Year
router.get("/stereo-dashboard", async (req, res) => {
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

    const todayTotalBookings = await reservationStereo.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayCheckin = await reservationStereo.countDocuments({
      status: "checkin",
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    /* --------------------------------------
      MONTHLY BOOKINGS FOR CARDS (this calendar month)
      -> include only booked & checkin statuses for the monthly total
    -------------------------------------- */
    const startOfCurrentMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfCurrentMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const monthlyBookings = await reservationStereo.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
    });

    /* --------------------------------------
      TOTAL BOOKINGS (this year)
      -> use the full year range for the current year
    -------------------------------------- */
    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const totalBookingsThisYear = await reservationStereo.countDocuments({
      bookingDateTime: { $gte: startOfYear, $lte: endOfYear }
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
        reservationStereo.countDocuments({
          status: { $in: ["booked", "checkin"] },
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
        })
      );

      checkinPromises.push(
        reservationStereo.countDocuments({
          status: "checkin",
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
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
    res.render("stereo-dashboard", {
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

// ====================================
// EXPORT CSV STEREO BAR
// ====================================
router.get("/stereo-export-csv", async (req, res) => {
  try {

    const { date } = req.query;

    if (!date) {
      return res.status(400).send("Date is required");
    }

    // Create start and end of selected day
    const start = new Date(date);
    start.setHours(0,0,0,0);

    const end = new Date(date);
    end.setHours(23,59,59,999);

    const bookings = await reservationStereo.find({
      bookingDateTime: { $gte: start, $lte: end }
    }).sort({ bookingDateTime: 1 });

    let csv = "Name,Phone,Table,Amount,Reservation Date,Note,Status,Created By,Created At\n";

    bookings.forEach(b => {

      const reservationDate = format(
        new Date(b.bookingDateTime),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      const createdAt = format(
        new Date(b.createdAt),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      csv += `"${b.name}","${b.phone}","${b.tables}","${b.amount}","${reservationDate}","${b.remark || ""}","${b.status}","${b.createBy}","${createdAt}"\n`;

    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=stereo-bar-${date}.csv`
    );

    res.send("\uFEFF" + csv);

  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).send("Error exporting CSV");
  }
});

//EDIT RESERVATION
router.get("/edit-booking-stereobar/:id", async (req, res) => {
  try {
    if (!req.session || !req.session.username) {
      return res.status(401).render("login");
    }

    const booking = await reservationStereo.findById(req.params.id).lean();

    if (!booking) {
      return res.status(404).send("Booking not found");
    }

    res.render("edit-booking-stereobar", {
      booking,
      tables: stereoTables,
      staticElements: stereoStaticElements,
      existingTables: Array.isArray(booking.tables)
        ? booking.tables
        : [],
      image: req.file ? `/uploads/stereobar/${req.file.filename}` : null,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });


  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading booking");
  }
});

router.post(
  "/update-stereobar/:id",
  (req, res, next) => {
    req.uploadFolder = "stereobar";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Auth check
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const update_id = req.params.id; // ✅ USE PARAM, NOT BODY
      if (!update_id) {
        return res.status(400).json({ error: "Missing booking ID" });
      }

      // ✅ Parse tables safely
      let tables = [];
      if (req.body.tables) {
        try {
          tables = JSON.parse(req.body.tables);
        } catch (e) {
          return res.status(400).json({ error: "Invalid tables data" });
        }
      }

      const updatedData = {
        name: req.body.name,
        phone: req.body.phone,
        bookingDateTime: new Date(req.body.bookingDateTime),
        amount: Number(req.body.amount),
        transfer: Number(req.body.transfer),
        remark: req.body.remark,
        createBy: req.session.username,
        tables
      };

      // ✅ Only overwrite image if new one uploaded
      if (req.file) {
        updatedData.image = `/uploads/stereobar/${req.file.filename}`;
      }

      const updated = await reservationStereo.findByIdAndUpdate(
        update_id,
        updatedData,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      res.json({ success: true, data: updated });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

//---------------------- END STEREO BAR ----------------------------//

//------------------ COOLLY CHEF SECTION------------------------//
router.get("/coolly-book", (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }
  const today = getTodayDateTH();

  res.render("coolly-chef-floorplan", {
    tables: coollyTables,
    staticElements: coollyStaticElements,
    today: today,
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    isLogin: req.session.login
  });
});

router.get("/coolly-availability", async (req, res) => {
  const { date } = req.query; // yyyy-mm-dd

  if (!date) return res.status(400).json({ error: "Date required" });

  const start = new Date(date + "T00:00:00");
  const end = new Date(date + "T23:59:59");

  const reservations = await reservationCoolly.find({
    bookingDateTime: { $gte: start, $lte: end }
  });

  const reservedMap = {};

  reservations.forEach(r => {
    r.tables.forEach(tableId => {
      reservedMap[tableId] = {
        name: r.name,
        phone: r.phone,
        bookingTime: r.bookingDateTime.toTimeString().slice(0,5),
        remark: r.remark || "-"
      };
    });
  });

  res.json({ reservedMap });
});

//Reseve coolly
router.post(
  "/reserve-coolly",
  (req, res, next) => {
    req.uploadFolder = "coolly";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Make sure user is logged in
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        name,
        phone,
        bookingDateTime,
        amount,
        transfer,
        remark,
        tables
      } = req.body;

      const booking = new reservationCoolly({
        name,
        phone,
        bookingDateTime: new Date(bookingDateTime),
        amount,
        transfer,
        remark,
        createBy: req.session.username, // ✅ FROM SESSION
        tables: JSON.parse(tables),
        image: req.file ? `/uploads/coolly/${req.file.filename}` : null
      });

      await booking.save();

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  }
);


router.get("/coolly-booking-list", async (req, res) => {
  if (!req.session.login) {
    return res.render("login");
  }

  try {
    const filter = req.query.filter || "today";
    const sortParam = req.query.sort || "oldest";
    const limit = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const now = new Date();

    const search = req.query.search || "";

    // 🔹 NEW: selected date (default = today)
    const selectedDate =
      req.query.date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let matchStage = {};

    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }


    /* =====================================================
       🔥 DATE PICKER OVERRIDES FILTER
    ===================================================== */
    if (req.query.date) {
      const start = new Date(`${selectedDate}T00:00:00`);
      const end   = new Date(`${selectedDate}T23:59:59.999`);

      matchStage.bookingDateTime = { $gte: start, $lte: end };
    }
    /* =====================================================
       🔹 EXISTING FILTERS (UNCHANGED)
    ===================================================== */
    else {
      if (filter === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisMonth") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

      if (filter === "thisYear") {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(
          now.getFullYear(),
          11,
          31,
          23,
          59,
          59,
          999
        );

        matchStage.bookingDateTime = { $gte: start, $lte: end };
      }

    }

    // 🔹 FETCH
    let bookings = await reservationCoolly.find(matchStage).lean();

    // 🔹 SORT
    if (sortParam === "newest") {
      bookings.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      bookings.sort((a, b) => a.bookingDateTime - b.bookingDateTime);
    }

    const totalCount = bookings.length;
    const paginated = bookings.slice(skip, skip + limit);

    return res.render("coolly-booking-list", {
      bookings: paginated,
      filter,
      sort: sortParam,
      limit,
      search,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      selectedDate, // 🔥 PASS TO EJS
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });

  } catch (err) {
    console.error(err);
    return res.status(500).send("Error loading booking list");
  }
});

// When customer come and check-in to get the table, staffs shall tick the checkbox
router.post("/booking/coolly-checkin/:id", async (req, res) => {
  try {
    const { status } = req.body;

    await reservationCoolly.findByIdAndUpdate(req.params.id, {
      status,
      checkin_time: new Date()
    });

    return res.json({ success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
});

router.get("/delete-coolly-booking/:id", async (req, res) => {
    try {
        await reservationCoolly.findByIdAndDelete(req.params.id);
        res.redirect('/coolly-booking-list');
    } catch (err) {
        console.error("Error deleting booking:", err);
        res.status(500).send("Something went wrong");
    }
});

// Display Overview All Booking Data Over A Year
router.get("/coolly-dashboard", async (req, res) => {
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

    const todayTotalBookings = await reservationCoolly.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayCheckin = await reservationCoolly.countDocuments({
      status: "checkin",
      bookingDateTime: { $gte: startOfToday, $lte: endOfToday }
    });

    /* --------------------------------------
      MONTHLY BOOKINGS FOR CARDS (this calendar month)
      -> include only booked & checkin statuses for the monthly total
    -------------------------------------- */
    const startOfCurrentMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfCurrentMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const monthlyBookings = await reservationCoolly.countDocuments({
      status: { $in: ["booked", "checkin"] },
      bookingDateTime: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
    });

    /* --------------------------------------
      TOTAL BOOKINGS (this year)
      -> use the full year range for the current year
    -------------------------------------- */
    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const totalBookingsThisYear = await reservationCoolly.countDocuments({
      bookingDateTime: { $gte: startOfYear, $lte: endOfYear }
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
        reservationCoolly.countDocuments({
          status: { $in: ["booked", "checkin"] },
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
        })
      );

      checkinPromises.push(
        reservationCoolly.countDocuments({
          status: "checkin",
          bookingDateTime: { $gte: startOfMonth, $lte: endOfMonth }
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
    res.render("coolly-dashboard", {
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

// ====================================
// EXPORT CSV COOLLY CHEF
// ====================================
router.get("/coolly-export-csv", async (req, res) => {
  try {

    const { date } = req.query;

    if (!date) {
      return res.status(400).send("Date is required");
    }

    // Create start and end of selected day
    const start = new Date(date);
    start.setHours(0,0,0,0);

    const end = new Date(date);
    end.setHours(23,59,59,999);

    const bookings = await reservationCoolly.find({
      bookingDateTime: { $gte: start, $lte: end }
    }).sort({ bookingDateTime: 1 });

    let csv = "Name,Phone,Table,Amount,Reservation Date,Note,Status,Created By,Created At\n";

    bookings.forEach(b => {

      const reservationDate = format(
        new Date(b.bookingDateTime),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      const createdAt = format(
        new Date(b.createdAt),
        "dd MMMM yyyy HH:mm",
        { locale: th }
      );

      csv += `"${b.name}","${b.phone}","${b.tables}","${b.amount}","${reservationDate}","${b.remark || ""}","${b.status}","${b.createBy}","${createdAt}"\n`;

    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=coolly-chef-${date}.csv`
    );

    res.send("\uFEFF" + csv);

  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).send("Error exporting CSV");
  }
});

//EDIT RESERVATION
router.get("/edit-booking-coolly/:id", async (req, res) => {
  try {
    if (!req.session || !req.session.username) {
      return res.status(401).render("login");
    }

    const booking = await reservationCoolly.findById(req.params.id).lean();

    if (!booking) {
      return res.status(404).send("Booking not found");
    }

    res.render("edit-booking-coolly", {
      booking,
      tables: coollyTables,
      staticElements: coollyStaticElements,
      existingTables: Array.isArray(booking.tables)
        ? booking.tables
        : [],
      image: req.file ? `/uploads/coolly/${req.file.filename}` : null,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });


  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading booking");
  }
});

router.post(
  "/update-coolly/:id",
  (req, res, next) => {
    req.uploadFolder = "coolly";
    next();
  },
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔐 Auth check
      if (!req.session || !req.session.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const update_id = req.params.id; // ✅ USE PARAM, NOT BODY
      if (!update_id) {
        return res.status(400).json({ error: "Missing booking ID" });
      }

      // ✅ Parse tables safely
      let tables = [];
      if (req.body.tables) {
        try {
          tables = JSON.parse(req.body.tables);
        } catch (e) {
          return res.status(400).json({ error: "Invalid tables data" });
        }
      }

      const updatedData = {
        name: req.body.name,
        phone: req.body.phone,
        bookingDateTime: new Date(req.body.bookingDateTime),
        amount: Number(req.body.amount),
        transfer: Number(req.body.transfer),
        remark: req.body.remark,
        createBy: req.session.username,
        tables
      };

      // ✅ Only overwrite image if new one uploaded
      if (req.file) {
        updatedData.image = `/uploads/coolly/${req.file.filename}`;
      }

      const updated = await reservationCoolly.findByIdAndUpdate(
        update_id,
        updatedData,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      res.json({ success: true, data: updated });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

//----------------------------------- END COOLLY CHEF SECTION --------------------------//

// Only Admin can see 'Add-Member' button on the dashboard page
router.get("/add-member", async (req, res) => {
  if (req.session.login) {
    res.render("add-member", { 
    error: null, 
    success: null,
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    isLogin: req.session.login
   });
  } else {
    res.render('login');
  }
  
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
      error: null,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });

  } catch (err) {
    console.error(err);
    return res.render("add-member", { 
      error: "Something went wrong",
      success: null,
      username: req.session.username,
      isAdmin: req.session.isAdmin,
      isLogin: req.session.login
    });
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













module.exports = router     //export module router ไปให้ index ใช้




