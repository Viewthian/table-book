const nodemailer = require("nodemailer");

async function sendEmailWithAttachment(date, attachments) {

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
    subject: `Daily Reservation Report - ${date}`,
    text: `Reservation report for ${date}.`,
    attachments: attachments
  });

}


module.exports = sendEmailWithAttachment;