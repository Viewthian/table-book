const { Parser } = require("json2csv");

function generateCSV(bookings) {
  const fields = [
    "ชื่อลูกค้า",
    "เบอร์โทร",
    "เลขโต๊ะ",
    "จำนวน",
    "วันที่จอง",
    "รายละเอียด",
    "สถานะการจอง",
    "มัดจำโต๊ะ",
    "ผู้จอง",
    "จองเมื่อ"
  ];

  
  const parser = new Parser({ fields });
  return parser.parse(bookings);
}

module.exports = generateCSV;