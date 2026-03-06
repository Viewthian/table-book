const cron = require("node-cron");
const reservationStereo = require("../models/stereo-reservation.js");
const generateCSV = require("../utils/exportCSV");
const sendEmailWithAttachment = require("../utils/sendEmail");

cron.schedule("50 13 * * *", async () => {
  try {

    console.log("⏰ Running daily report...");

    const today = new Date();
    const start = new Date(today.setHours(0,0,0,0));
    const end = new Date(today.setHours(23,59,59,999));

    const bookings = await reservationStereo.find({
      bookingDateTime: { $gte: start, $lte: end }
    });

    const csv = generateCSV(bookings);

    await sendEmailWithAttachment(csv);

  } catch (err) {
    console.error("Daily report error:", err);
  }

});