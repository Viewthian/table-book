const bookTable = require('../models/table-booking.js')  

// function checkTimeConflict({ reservationDateTime, tableNo }) {
//   const inputTime = new Date(reservationDateTime);
//   const from = new Date(inputTime.getTime() - 3 * 60 * 60 * 1000);
//   const to = new Date(inputTime.getTime() + 3 * 60 * 60 * 1000);

//   const conflict = bookTable.findOne({
//     tableNo,
//     reservationDateTime: { $gte: from, $lte: to }
//   });

//   return conflict; // returns true if conflict exists

// }

async function checkTimeConflict({ reservationDateTime, tableNo, excludeId = null }) {
    const date = new Date(reservationDateTime);

    // Extract only the date part (clear time)
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const query = {
        tableNo,
        reservationDateTime: { $gte: startOfDay, $lte: endOfDay } // same day only
    };

    if (excludeId) {
        query._id = { $ne: excludeId }; // exclude current record when editing
    }

    return await bookTable.findOne(query);
}

function formatBangkok(date) {
  return new Date(date).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


module.exports = checkTimeConflict, formatBangkok;