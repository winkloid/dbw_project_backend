const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const HashSchema = new Schema({
    sha256Hash: {type: String},
    isBlocked: {type: Boolean}
});

module.exports = mongoose.model("Hash", HashSchema, "hash");