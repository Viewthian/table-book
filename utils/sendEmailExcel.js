const nodemailer = require("nodemailer");

async function sendEmailWithAttachment(date, attachments) {

  const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // must be true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

  try {
    await transporter.verify();
    console.log("SMTP ready");
    } catch (err) {
    console.error("SMTP error:", err);
    }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: "nathakrit.p@gmail.com",
    subject: `Daily Reservation Report - ${date}`,
    text: `Reservation report for ${date}.`,
    attachments: attachments
  });

}


module.exports = sendEmailWithAttachment;