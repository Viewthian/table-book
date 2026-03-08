const nodemailer = require("nodemailer");

async function sendEmailWithAttachment(date, attachments) {

  const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
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

  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: "nathakrit.p@gmail.com",
    subject: `Daily Reservation Report - ${date}`,
    text: `Reservation report for ${date}.`,
    attachments: attachments
  });

}


module.exports = sendEmailWithAttachment;