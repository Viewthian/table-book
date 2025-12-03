const nodemailer = require("nodemailer");
require('dotenv').config();

// configure transporter once
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.bond_email,   // replace with your email
    pass: process.env.GMAIL_APP_PASSWORD       // use Gmail App Password
  }
});

// reusable function
async function sendBookingEmail(booking) {
  const mailOptions = {
    from: `${booking.email}`,
    to: [process.env.piedmont_email, process.env.bond_email, process.env.naam_email],
    subject: `✨ New Booking: ${booking.bookingNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background: #ff5a5f; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">📢 New Booking Received!</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 16px; margin: 8px 0;"><b>👤 Guest:</b> ${booking.name}</p>
            <p style="font-size: 16px; margin: 8px 0;"><b>📅 Check-in:</b> ${new Date(booking.checkInDate).toDateString()}</p>
            <p style="font-size: 16px; margin: 8px 0;"><b>📅 Check-out:</b> ${new Date(booking.checkOutDate).toDateString()}</p>
            <p style="font-size: 16px; margin: 8px 0;"><b>💰 Total:</b> ${Number(booking.amount).toLocaleString()} THB</p>
            <p style="font-size: 16px; margin: 8px 0; color: #ff5a5f; font-weight: bold;">
              📌 Booking No: ${booking.bookingNumber}
            </p>
          </div>
          <div style="background: #fafafa; padding: 15px; text-align: center; font-size: 14px; color: #666;">
             <b>The Piedmont CNX</b>.  
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Booking email sent!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

// Function to send booking confirmation email to customer
async function sendBookingConfirmation(booking) {
  const mailOptions = {
    from: `"The Piedmont CNX" <piedmontcnx@gmail.com>`,
    to: `${booking.email}`,
    subject: `✅ Booking Confirmation - ${booking.bookingNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background: #28a745; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">🎉 Your Booking is Confirmed!</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 16px; margin: 8px 0;">Dear <b>${booking.name}</b>,</p>
            <p style="font-size: 16px; margin: 8px 0;">Thank you for booking with us. Here are your reservation details:</p>
            <p style="font-size: 16px; margin: 8px 0;"><b>📅 Check-in:</b> ${new Date(booking.checkInDate).toDateString()}</p>
            <p style="font-size: 16px; margin: 8px 0;"><b>📅 Check-out:</b> ${new Date(booking.checkOutDate).toDateString()}</p>
            <p style="font-size: 16px; margin: 8px 0;"><b>💰 Total:</b> ${Number(booking.amount).toLocaleString()} THB</p>
            <p style="font-size: 16px; margin: 8px 0; color: #28a745; font-weight: bold;">
              📌 Booking No: ${booking.bookingNumber}
            </p>
            <div style="margin: 20px 0; text-align: center;">
              
            </div>
          </div>
          <div style="background: #fafafa; padding: 15px; text-align: center; font-size: 14px; color: #666;">
            We look forward to welcoming you at <b>Piedmont Hostel</b>.
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Confirmation email sent to customer:", customerEmail);
  } catch (err) {
    console.error("❌ Error sending confirmation email:", err);
  }
}

async function incomingMessage(message) {
  const mailOptions = {
    from: `${message.email}`,
    to: [process.env.piedmont_email, process.env.bond_email],
    subject: `✅ Message from Piedmont Customer`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background: #644bf1ff; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">📌 You got new message!</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 16px; margin: 8px 0;">Dear <b>${message.name}</b>,</p>
            <p style="font-size: 16px; margin: 8px 0;">Please reply back to customer asap:</p>
            <p style="font-size: 16px; margin: 8px 0;"><b>💰 Phone:</b> ${Number(message.phone).toLocaleString()} </p>
            <p style="font-size: 16px; margin: 8px 0; color: #28a745; font-weight: bold;">
              📌 Message: ${message.message}
            </p>
            
          </div>
          <div style="background: #fafafa; padding: 15px; text-align: center; font-size: 14px; color: #666;">
            
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Confirmation email sent to customer:", customerEmail);
  } catch (err) {
    console.error("❌ Error sending confirmation email:", err);
  }
}

module.exports = { sendBookingEmail, sendBookingConfirmation, incomingMessage };
