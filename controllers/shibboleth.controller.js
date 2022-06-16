const axios = require("axios");
const FormData = require("form-data");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

axios.defaults.withCredentials = true;
axios.defaults.validateStatus = function () {
    return true;
};

const password = process.env.WTC_PASSWORD;
const entryUrl = "https://www.tu-chemnitz.de/informatik/DVS/lehre/DBW/";

async function shibbolethAuth() {

    try {
    // NOTWENDIG, damit Axios die Cookies zwischenspeichert, die er erhält und bei nachfolgenden Requests wieder einbindet!
    const jar = new CookieJar();
    const axiosClient = wrapper(axios.create({ jar }));

    // interceptors zum Ansehen gesendeter Requests und empfangener Responses
    /*
    axiosClient.interceptors.request.use((axiosClientRequest) => {
        console.log(axiosClientRequest);
        return axiosClientRequest;
    });

    axiosClient.interceptors.response.use((axiosClientResponse) => {
        console.log(axiosClientResponse);
        return axiosClientResponse;
    })
    */

    // verbinden mit Einstiegs-URL, die in "entryUrl" festgelegt ist
    console.log("+++ Authenticating with TUC Shibboleth +++");
    console.log("+ Connecting to entryUrl...");
    let firstResponse = await axiosClient.get(entryUrl, { withCredentials: true });
    let firstResponseUrl = firstResponse.request.res.responseUrl;

    // Vorbereiten der Formulardaten, die an die URL gesendet werden müssen, von der die Antwort nach der GET-Anfrage an die Einstiegs-URL kam, um den Authentifizierungsvorgang in Gang zu setzen
    let formData = FormData()
    formData.append("session", "true");
    formData.append("user_idp", "https://wtc.tu-chemnitz.de/shibboleth");
    formData.append("Select", "");

    // vorbereitete formulardaten via POST an erhaltene URL senden
    // URL, an die Daten gesendet werden hat folgende Form: https://wtc.tu-chemnitz.de/shibboleth/WAYF?entityID=...
    console.log("+ Connecting to WAYF URL...");
    let wayfResponse = await axiosClient({
        method: "post",
        url: firstResponseUrl,
        data: formData,
        maxRedirects: 0,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    // Weiterleitung von URL vorher erhalten zu einer URL der Form https://www.tu-chemnitz.de/Shibboleth.sso/Login?SAMLDS=1&target=...
    console.log("+ Connecting to Login-URL...");
    let loginResponse = await axiosClient({
        method: "get",
        url: wayfResponse.headers.location,
        maxRedirects: 0,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    // Erneute Weiterleitung zu URL der Form https://wtc.tu-chemnitz.de/krb/saml2/idp/SSOService.php?SAMLRequest=...
    console.log("+ Connecting to SAML SSOService-URL...");
    let samlResponse = await axiosClient({
        method: "get",
        url: loginResponse.headers.location,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    // Diese URL sendet letztendlich HTML-Daten, aus denen die nächste URL extrahiert werden muss - diese nächste URL hat die Form https://wtc.tu-chemnitz.de/krb/module.php/negotiate/backend.php?AuthState=...
    let samlResponseData = samlResponse.data;
    let htmlDocument = new JSDOM(samlResponseData);
    // die nächste URL ist im HTML-Element  mit der ID "redirect" zu finden
    let redirectUrl = htmlDocument.window.document.querySelector("#redirect").href;

    // außerdem enthält diese URL einen Parameter "AuthState", der für spätere Anfragen gebraucht wird und daher hier aus der URL extrahiert wird
    const redirectQuery = new URLSearchParams(redirectUrl.split("?")[1]);
    let authState = redirectQuery.get("AuthState");

    // GET-Anfrage an die extrahierte URL
    console.log("+ Connecting to Backend-URL...");
    let backendResponse = await axiosClient({
        method: "get",
        url: redirectUrl,
        withCredentials: true,
    }, { withCredentials: true }).then((response) => {
        return response;
    }).catch((error) => {
        return error.response;
    });

    // als Antwort der vorherigen GET-Anfrage erhält man eine URL der Form https://wtc.tu-chemnitz.de/krb/module.php/TUC/username.php?AuthState=...
    // diese URL führt zum ersten Teil des eigentlichen Anmeldeformulars, in dem Benutzername eingegeben wird
    let backendResponseUrl = backendResponse.request.res.responseUrl;

    // bereite Daten für username formular vor - hier wird auch der extrahierte AuthState-Parameter benötigt
    let usernameForm = new FormData();
    usernameForm.append("username", "owin");
    usernameForm.append("AuthState", authState);

    // sende username daten via POST an die vom backend erhaltene username url
    console.log("+ Connecting to Username-Form...")
    let usernameResponse = await axiosClient({
        method: "post",
        url: backendResponseUrl,
        data: usernameForm,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    // als Antwort auf die POST-Request erhält man eine Weiterleitung zur URL der Passworteingabe - dem zweiten Teil des Anmeldeformulars
    // diese URL hat die Form https://wtc.tu-chemnitz.de/krb/module.php/core/loginuserpass.php?AuthState=...
    let usernameResponseUrl = usernameResponse.request.res.responseUrl;

    // bereite Daten für Passworteingabeformular vor
    let passwordForm = new FormData();
    passwordForm.append("password", password);
    passwordForm.append("AuthState", authState);

    // Senden der vorbereiteten Paswort-Formulardaten via POST an die erhaltene Passwort-URL
    console.log("+ Connecting to Password-Form...");
    let passwordResponse = await axiosClient({
        method: "post",
        url: usernameResponseUrl,
        data: passwordForm,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    // als Antwort erhält man HTML-Daten, die wichtige Informationen für den nächsten Schritt enthalten - diese müssen wieder aus den HTML-Daten heraus extrahiert werden
    let passwordResponseData = passwordResponse.data;
    htmlPasswordResponse = new JSDOM(passwordResponseData);
    // die Informationen befinden sich in HTML-Elementen mit den Namen "SAMLResponse" und "RelayState"
    let finalSAML = htmlPasswordResponse.window.document.querySelector('[name="SAMLResponse"]').value;
    let finalRelayState = htmlPasswordResponse.window.document.querySelector('[name="RelayState"]').value;

    // die extrahierten Informationen müssen mit der nächsten POST-Request gesendet werden
    // hierbei nimmt der Server keine Daten an, die mit FormData() erzeugt wurden, stattdessen musste ich hier URL-Search-Params verwenden, um Daten im Format x-www-form-urlencoded zu senden
    let finalForm = new URLSearchParams();
    finalForm.append("SAMLResponse", finalSAML);
    finalForm.append("RelayState", finalRelayState);
    console.log("+ Sending final Authentication Request...")
    let finalResponse = await axiosClient({
        method: "post",
        url: "https://www.tu-chemnitz.de/Shibboleth.sso/SAML2/POST",
        data: finalForm,
        withCredentials: true,
    }, { withCredentials: true }).then((response) => {
        return response;
    });

    console.log("+++ Authenticated +++");
    // übergebe AxiosClient, der alle Cookies enthält, um weitere Anfragen authentifiziert abwickeln zu können
    return axiosClient;
} catch (error) {
    if(axios.isAxiosError(error)) {
        console.log("ERROR WHEN CONNECTING. Please check your connection.");
        return null;
    } else {
        console.log("Error when authenticating with WTC - please check e.g. your credentials, the entry url, etc.");
        return null;
    }
}
};

module.exports = {
    shibbolethAuth
}