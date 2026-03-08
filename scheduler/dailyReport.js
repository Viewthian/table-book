const cron = require("node-cron");

const StereoReservation = require("../models/stereo-reservation.js");
const CoollyReservation = require("../models/coolly-reservation.js");
const ViewVillageReservation = require("../models/view-village-reservation.js");
const ViewbarReservation = require("../models/viewbar-reservation.js");

const {
  generateStereoExcel,
  generateCoollyExcel,
  generateViewbarExcel,
  generateTheviewExcel
} = require("../utils/exportExcel");

const sendEmailWithAttachment = require("../utils/sendEmailResend");

console.log("📅 Scheduler loaded");

cron.schedule(
  "17 17 * * *",
  async () => {
    try {
      console.log("⏰ Running daily report...");

      const today = new Date();

      const start = new Date(today);
      start.setHours(0, 0, 0, 0);

      const end = new Date(today);
      end.setHours(23, 59, 59, 999);

      const todayStr = today.toISOString().slice(0, 10);

      console.log(`📆 Report date: ${todayStr}`);

      const attachments = [];

      // ---------- FETCH BOOKINGS ----------

      const stereoBookings = await StereoReservation.find({
        bookingDateTime: { $gte: start, $lte: end }
      });

      const coollyBookings = await CoollyReservation.find({
        bookingDateTime: { $gte: start, $lte: end }
      });

      const viewbarBookings = await ViewbarReservation.find({
        bookingDateTime: { $gte: start, $lte: end }
      });

      const theviewBookings = await ViewVillageReservation.find({
        bookingDateTime: { $gte: start, $lte: end }
      });

      // ---------- GENERATE FILES ----------

      if (stereoBookings?.length) {
        const buffer = Buffer.from(generateStereoExcel(stereoBookings));

        attachments.push({
          filename: `stereo-bookings-${todayStr}.xlsx`,
          content: buffer
        });

        console.log(`📊 Stereo bookings: ${stereoBookings.length}`);
      }

      if (coollyBookings?.length) {
        const buffer = Buffer.from(generateCoollyExcel(coollyBookings));

        attachments.push({
          filename: `coolly-bookings-${todayStr}.xlsx`,
          content: buffer
        });

        console.log(`📊 Coolly bookings: ${coollyBookings.length}`);
      }

      if (viewbarBookings?.length) {
        const buffer = Buffer.from(generateViewbarExcel(viewbarBookings));

        attachments.push({
          filename: `viewbar-bookings-${todayStr}.xlsx`,
          content: buffer
        });

        console.log(`📊 Viewbar bookings: ${viewbarBookings.length}`);
      }

      if (theviewBookings?.length) {
        const buffer = Buffer.from(generateTheviewExcel(theviewBookings));

        attachments.push({
          filename: `theview-bookings-${todayStr}.xlsx`,
          content: buffer
        });

        console.log(`📊 TheView bookings: ${theviewBookings.length}`);
      }

      // ---------- NO BOOKINGS ----------

      if (!attachments.length) {
        console.log("📭 No bookings today. Email skipped.");
        return;
      }

      console.log(`📦 Sending ${attachments.length} attachment(s)...`);

      // ---------- SEND EMAIL ----------

      console.log(
        attachments.map(a => ({
            name: a.filename,
            size: a.content.length
        }))
        );

    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "exists" : "missing");

      await sendEmailWithAttachment(todayStr, attachments);

      console.log("✅ Daily report email sent");

    } catch (err) {
      console.error("❌ Daily report error:", err);
    }
  },
  {
    timezone: "Asia/Bangkok"
  }
);