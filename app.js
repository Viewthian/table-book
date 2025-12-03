

//---------------------------------------------------------------------//
const express = require('express')
const router = require('./routes/myRouter')
const path = require('path')
const cookieParser = require('cookie-parser')
const flash = require("connect-flash");
const session = require('express-session')
const app = express()
const PORT = process.env.PORT || 3000;



app.set('views', path.join(__dirname,'views'))      //บอก app.js ให้ไป render content ที่ folder views
app.set('view engine', 'ejs')     //ใช้ ejs เป็น template ในการแทรก content ใน html
// app.use(express.urlencoded({extended:false}))     //ใช้กับ post method เพื่อ encode ข้อมูลเพื่อส่งต่อไปยัง router
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser())
app.use(session({secret:"myession",resave:false,saveUninitialized:false}))    //มากำหนด middleware ให้ session โดยส่ง poperty ไปด้วย
app.use(flash());
app.use(router)             //ใช้ router มาช่วยในเรื่องการจัดการ dynamic file&content

app.use(express.static(path.join(__dirname, 'public')))    //ไป render ที่ static file

// Use it (this means all routes inside myRouter.js will work)
app.use('/', router);

app.use((req, res) => {
  res.status(404).render('404'); // renders 404.ejs
});

const baseUrl = process.env.APP_URL;

module.exports = app;

app.listen(PORT,()=>{
    console.log(`Server is running on port: ${PORT}`)
})