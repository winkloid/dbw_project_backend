const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FileSchema = new Schema ({
    fileBinary: {type: Buffer},
    fileName: {type: String},
    fileSize: {type: Number},
    fileMimetype: {type: String},
    uploadDate: {type: Date},
    latestDownloadDate: {type: Date},
    sha256Hash: {type: String},
});

module.exports = mongoose.model("File", FileSchema, "file");