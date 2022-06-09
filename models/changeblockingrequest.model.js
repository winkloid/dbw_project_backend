const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// zur Request werden direkt Metadaten der Datei mitgespeichert, weil sonst bei jedem Abruf aller Requests sehr viele Anfragen zusaetzlich an die File-Collection gestellt werden muesssten
// auch laesst sich die Request-Funktionalitaet durch Auslagern der Requests in eigene Collection besser erweitern
const ChangeBlockingRequestSchema = new Schema({
    requestMessage: {type: String},
    blockFile: {type: Boolean},
    fileId: {type: String},
    fileName: {type: String},
    fileSize: {type: Number},
    fileMimetype: {type: String},
    uploadDate: {type: Date},
    sha256Hash: {type: String},
});

module.exports = mongoose.model("ChangeBlockingRequest", ChangeBlockingRequestSchema, "changeBlockingRequest");