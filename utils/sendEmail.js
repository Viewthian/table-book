const nodemailer = require("nodemailer");

async function sendEmailWithAttachment(csvData) {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: "nathakrit.p@gmail.com",
    subject: "Daily Reservation Report",
    text: "Attached is today's reservation report.",
    attachments: [
      {
        filename: "daily-bookings.csv",
        content: csvData
      }
    ]
  });

  console.log("📧 Email sent successfully");
}

module.exports = sendEmailWithAttachment;