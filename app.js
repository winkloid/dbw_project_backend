require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fileroutes = require("./routes/file.routes");
const fileUpload = require('express-fileupload');

const application = express();
const port = 49749;
mongoose.connect(process.env.MONGODB_CONNECTION_STRING, {useNewUrlParser:true,useUnifiedTopology:true}, (error)=>{
    if(error?console.log(error):console.log("MongoDB Verbindung hergestellt: " + process.env.MONGODB_CONNECTION_STRING));
});


application.use(cors());
application.use(express.json());
application.use(express.urlencoded({extended: true}));
application.use(fileUpload({
    limits: {fileSize: 10485761} // 10 MiB = 10485760 Byte - da diese Groeße noch akzeptiert werden soll, wurde hier 10485761 als limit gesetzt
}));

application.use("/api/files", fileroutes);

application.listen(port, () => {
    console.log("Express-Server gestartet: localhost:" + port);
});
