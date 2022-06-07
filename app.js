require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fileroutes = require("./routes/file.routes");

const application = express();
const port = 49749;
mongoose.connect(process.env.MONGODB_CONNECTION_STRING, {useNewUrlParser:true,useUnifiedTopology:true}, (error)=>{
    if(error?console.log(error):console.log("MongoDB Verbindung hergestellt: " + process.env.MONGODB_CONNECTION_STRING));
});


application.use(cors());
application.use(express.json());
application.use(express.urlencoded({extended: true}));
application.use("/api/files", fileroutes);

application.listen(port, () => {
    console.log("Express-Server gestartet: localhost:" + port);
});
