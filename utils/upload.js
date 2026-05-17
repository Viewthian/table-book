require('dotenv').config();
const multer = require("multer");
const path = require("path");
const fs = require("fs");


const cloudinary = require("cloudinary").v2;


const {
  CloudinaryStorage
} = require("multer-storage-cloudinary");

/* ---------------- CLOUDINARY CONFIG ---------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,

  api_key: process.env.CLOUDINARY_API_KEY,

  api_secret: process.env.CLOUDINARY_API_SECRET
});

// console.log("CLOUDINARY:", {
//   cloud: process.env.CLOUDINARY_CLOUD_NAME,
//   key: process.env.CLOUDINARY_API_KEY,
//   secret: process.env.CLOUDINARY_API_SECRET
//     ? "exists"
//     : "missing"
// });

/* ---------------- STORAGE ---------------- */

const storage =
  new CloudinaryStorage({

    cloudinary,

    params: async (req, file) => ({

      folder:
        `table-book/${
          req.uploadFolder || "default"
        }`,

      allowed_formats: [
        "jpg",
        "jpeg",
        "png"
      ],

      public_id:
        `slip_${Date.now()}`
    })
  });

/* ---------------- FILTER ---------------- */

const fileFilter = (req, file, cb) => {

  const allowed = [
    "image/jpeg",
    "image/png"
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPG and PNG allowed"
      ),
      false
    );
  }
};

/* ---------------- MULTER ---------------- */

const upload = multer({

  storage,

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }

});

module.exports = upload;



// #######################################################################################
// This is a function to save image in Local uploads are NOT permanent storage on Railway
// #############################################################################

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     // 👇 decide folder by route or custom field
//     const restaurant = req.uploadFolder; 
//     // example values: "view-village", "viewbar"

//     const uploadPath = path.join("public/uploads", restaurant);

//     // create folder if not exists
//     fs.mkdirSync(uploadPath, { recursive: true });

//     cb(null, uploadPath);
//   },

//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `slip_${Date.now()}${ext}`);
//   }
// });

// const fileFilter = (req, file, cb) => {
//   if (["image/jpeg", "image/png"].includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only JPG/PNG allowed"), false);
//   }
// };

// ==========================================================================