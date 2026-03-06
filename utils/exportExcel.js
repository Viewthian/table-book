const XLSX = require("xlsx");

function generateStereoExcel(bookings) {

  const data = bookings.map(b => ({
    ชื่อลูกค้า: b.name,
    เบอร์โทร: b.phone,
    เลขโต๊ะ: Array.isArray(b.tables) ? b.tables.join(", ") : b.tables,
    จำนวน: b.amount,
    วันที่จอง: b.bookingDateTime,
    รายละเอียด: b.remark || "",
    สถานะการจอง: b.status,
    มัดจำโต๊ะ: b.transfer,
    ผู้จอง: b.createBy,
    จองเมื่อ: b.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Reservations");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });
}


function generateCoollyExcel(bookings) {

  const data = bookings.map(b => ({
    ชื่อลูกค้า: b.name,
    เบอร์โทร: b.phone,
    เลขโต๊ะ: Array.isArray(b.tables) ? b.tables.join(", ") : b.tables,
    จำนวน: b.amount,
    วันที่จอง: b.bookingDateTime,
    รายละเอียด: b.remark || "",
    สถานะการจอง: b.status,
    มัดจำโต๊ะ: b.transfer,
    ผู้จอง: b.createBy,
    จองเมื่อ: b.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Reservations");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });
}

function generateViewbarExcel(bookings) {

  const data = bookings.map(b => ({
    ชื่อลูกค้า: b.name,
    เบอร์โทร: b.phone,
    เลขโต๊ะ: Array.isArray(b.tables) ? b.tables.join(", ") : b.tables,
    จำนวน: b.amount,
    วันที่จอง: b.bookingDateTime,
    รายละเอียด: b.remark || "",
    สถานะการจอง: b.status,
    มัดจำโต๊ะ: b.transfer,
    ผู้จอง: b.createBy,
    จองเมื่อ: b.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Reservations");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });
}

function generateTheviewExcel(bookings) {

  const data = bookings.map(b => ({
    ชื่อลูกค้า: b.name,
    เบอร์โทร: b.phone,
    เลขโต๊ะ: Array.isArray(b.tables) ? b.tables.join(", ") : b.tables,
    จำนวน: b.amount,
    วันที่จอง: b.bookingDateTime,
    รายละเอียด: b.remark || "",
    สถานะการจอง: b.status,
    มัดจำโต๊ะ: b.transfer,
    ผู้จอง: b.createBy,
    จองเมื่อ: b.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Reservations");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });
}

module.exports = {
  generateStereoExcel,
  generateCoollyExcel,
  generateViewbarExcel,
  generateTheviewExcel
};