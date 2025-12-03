//ใช้งาน mongoose
const mongoose = require('mongoose')
mongoose.set('strictQuery', false);

//เชื่อมไปยัง mongoDB
const dbUrl = 'mongodb://localhost:27017/tableDB'

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// mongoose.connect(dbUrl,{
//     useNewUrlParser:true
//     // useUnifiedTopology:true
// }).catch(err=>console.log(err))


//ออกแบบ schema
let memberSchema  = mongoose.Schema({
     username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    fullname: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
    });



//สร้าง model
let Member = mongoose.model("members",memberSchema)

//ส่งออก model
module.exports = mongoose.model("Member", memberSchema);

//ออกแบบ function สำหรับบันทึกข้อมูล
module.exports.createMember=function(model,data){
    model.save(data)
}