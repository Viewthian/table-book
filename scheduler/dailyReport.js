const cron = require("node-cron");

const reservationStereo = require("../models/stereo-reservation.js");
const reservationCoolly = require("../models/coolly-reservation.js");
const reservationViewVillage = require("../models/view-village-reservation.js");
const Reservation = require("../models/viewbar-reservation.js");

const {
  generateStereoExcel,
  generateCoollyExcel,
  generateViewbarExcel,
  generateTheviewExcel
} = require("../utils/exportExcel");

// const sendEmailWithAttachment = require("../utils/sendEmail");
const sendEmailWithAttachment = require("../utils/sendEmailExcel");

console.log("📅 Scheduler loaded");

// cron.schedule(
//   "05 23 * * *",
//   async () => {
//     console.log("⏰ Running daily report...");
//   },
//   {
//     timezone: "Asia/Bangkok"
//   }
// );

cron.schedule("17 09 * * *", async () => {
  try {

    console.log("⏰ Running daily report...");

    const today = new Date();

    // Start & end of day
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);

    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    // Fetch bookings
    const stereoBookings = await reservationStereo.find({
      bookingDateTime: { $gte: start, $lte: end }
    });

    const coollyBookings = await reservationCoolly.find({
      bookingDateTime: { $gte: start, $lte: end }
    });

    const viewbarBookings = await Reservation.find({
      bookingDateTime: { $gte: start, $lte: end }
    });

    const theviewBookings = await reservationViewVillage.find({
      bookingDateTime: { $gte: start, $lte: end }
    });

    const attachments = [];

    const todayStr = today.toISOString().slice(0, 10);

    // Stereo
    if (stereoBookings && stereoBookings.length > 0) {
      const excelBuffer = generateStereoExcel(stereoBookings);

      attachments.push({
        filename: `stereo-bookings-${todayStr}.xlsx`,
        content: excelBuffer
      });

      console.log(`📊 Stereo bookings: ${stereoBookings.length}`);
    }

    // Coolly
    if (coollyBookings && coollyBookings.length > 0) {
      const excelBuffer = generateCoollyExcel(coollyBookings);

      attachments.push({
        filename: `coolly-bookings-${todayStr}.xlsx`,
        content: excelBuffer
      });

      console.log(`📊 Coolly bookings: ${coollyBookings.length}`);
    }

    // Viewbar
    if (viewbarBookings && viewbarBookings.length > 0) {
      const excelBuffer = generateViewbarExcel(viewbarBookings);

      attachments.push({
        filename: `viewbar-bookings-${todayStr}.xlsx`,
        content: excelBuffer
      });

      console.log(`📊 Viewbar bookings: ${viewbarBookings.length}`);
    }

    // The View
    if (theviewBookings && theviewBookings.length > 0) {
      const excelBuffer = generateTheviewExcel(theviewBookings);

      attachments.push({
        filename: `theview-bookings-${todayStr}.xlsx`,
        content: excelBuffer
      });

      console.log(`📊 TheView bookings: ${theviewBookings.length}`);
    }

    // If no bookings → skip email
    if (attachments.length === 0) {
      console.log("📭 No bookings today. Email skipped.");
      return;
    }

    await sendEmailWithAttachment(todayStr, attachments);

    console.log(`📧 Report sent with ${attachments.length} file(s)`);

  } catch (err) {
    console.error("❌ Daily report error:", err);
  }
},
  {
    timezone: "Asia/Bangkok"
  });