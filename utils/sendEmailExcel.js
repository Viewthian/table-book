const nodemailer = require("nodemailer");

async function sendEmailWithAttachment(date, attachments) {
  try {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000
    });

    // verify smtp connection
    await transporter.verify();
    console.log("✅ SMTP connection ready");

    // send email
    const info = await transporter.sendMail({
      from: `"Reservation System" <${process.env.EMAIL_USER}>`,
      to: "nathakrit.p@gmail.com",
      subject: `Daily Reservation Report - ${date}`,
      text: `Reservation report for ${date}.`,
      attachments: attachments
    });

    console.log("📧 Email sent:", info.messageId);

  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw error;
  }
}

module.exports = sendEmailWithAttachment;