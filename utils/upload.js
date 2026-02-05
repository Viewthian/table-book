const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 👇 decide folder by route or custom field
    const restaurant = req.uploadFolder; 
    // example values: "view-village", "viewbar"

    const uploadPath = path.join("public/uploads", restaurant);

    // create folder if not exists
    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `slip_${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (["image/jpeg", "image/png"].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG/PNG allowed"), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});
