const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmailWithAttachment(date, attachments) {
  try {

    const formattedAttachments = attachments.map(a => ({
      filename: a.filename,
      content: a.content.toString("base64")
    }));

    const response = await resend.emails.send({
      from: "Reservation System <onboarding@resend.dev>",
      to: ["theview.reservation@gmail.com"],
      subject: `Daily Reservation Report - ${date}`,
      text: `Reservation report for ${date}.`,
      attachments: formattedAttachments
    });

    console.log("✅ Email sent:", response);

  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
}

module.exports = sendEmailWithAttachment;