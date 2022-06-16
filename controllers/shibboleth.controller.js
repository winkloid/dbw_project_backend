const axios = require("axios");
const FormData = require("form-data");
const asyncHandler = require("express-async-handler");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

axios.defaults.withCredentials = true;
axios.defaults.validateStatus = function () {
    return true;
};

const password = process.env.WTC_PASSWORD;

const shibbolethAuth = async (req, res) => {

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

    let firstResponse = await axiosClient.get("https://www.tu-chemnitz.de/informatik/DVS/blocklist", { withCredentials: true });
    let firstResponseUrl = firstResponse.request.res.responseUrl;
    console.log(firstResponseUrl);


    let formData = FormData()
    formData.append("session", "true");
    formData.append("user_idp", "https://wtc.tu-chemnitz.de/shibboleth");
    formData.append("Select", "");

    let wayfResponse = await axiosClient({
        method: "post",
        url: firstResponseUrl,
        data: formData,
        //headers: {"Content-Type": "multipart/form-data"},
        maxRedirects: 0,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });
    console.log(wayfResponse.headers.location);

    let loginResponse = await axiosClient({
        method: "get",
        url: wayfResponse.headers.location,
        maxRedirects: 0,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });
    console.log(loginResponse.headers.location);
    console.log(loginResponse.headers["set-cookie"]);

    let samlResponse = await axiosClient({
        method: "get",
        url: loginResponse.headers.location,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    let samlResponseData = samlResponse.data;
    let htmlDocument = new JSDOM(samlResponseData);
    let redirectUrl = htmlDocument.window.document.querySelector("#redirect").href;
    console.log(samlResponse.headers["set-cookie"]);
    console.log(redirectUrl);

    const redirectQuery = new URLSearchParams(redirectUrl.split("?")[1]);
    let authState = redirectQuery.get("AuthState");
    console.log("AuthState: " + authState);

    let backendResponse = await axiosClient({
        method: "get",
        url: redirectUrl,
        withCredentials: true,
    }, { withCredentials: true }).then((response) => {
        return response;
    }).catch((error) => {
        return error.response;
    });

    let backendResponseUrl = backendResponse.request.res.responseUrl;
    console.log(backendResponse.request.res.responseUrl);

    // bereite Daten für username formular vor
    let usernameForm = new FormData();
    usernameForm.append("username", "owin");
    usernameForm.append("AuthState", authState);

    // sende username daten an die vom backend erhaltene username url
    let usernameResponse = await axiosClient({
        method: "post",
        url: backendResponseUrl,
        data: usernameForm,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    console.log(usernameResponse.request.res.responseUrl);
    let usernameResponseUrl = usernameResponse.request.res.responseUrl;

    let passwordForm = new FormData();
    passwordForm.append("password", password);
    passwordForm.append("AuthState", authState);
    let passwordResponse = await axiosClient({
        method: "post",
        url: usernameResponseUrl,
        data: passwordForm,
        withCredentials: true,
    }, { withCredentials: true }).then(function (response) {
        return response;
    });

    console.log(passwordResponse.request.res.responseUrl);
    let passwordResponseData = passwordResponse.data;
    htmlPasswordResponse = new JSDOM(passwordResponseData);
    let finalSAML = htmlPasswordResponse.window.document.querySelector('[name="SAMLResponse"]').value;
    let finalRelayState = htmlPasswordResponse.window.document.querySelector('[name="RelayState"]').value;

    let finalForm = new URLSearchParams();
    finalForm.append("SAMLResponse", finalSAML);
    finalForm.append("RelayState", finalRelayState);
    let finalResponse = await axiosClient({
        method: "post",
        url: "https://www.tu-chemnitz.de/Shibboleth.sso/SAML2/POST",
        data: finalForm,
        withCredentials: true,
    }, { withCredentials: true }).then((response) => {
        return response;
    });
   
    let blockListResponse =  await axiosClient({
        method: "get",
        url: "https://www.tu-chemnitz.de/informatik/DVS/blocklist/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        withCredentials: true,
    }, {withCredentials:true}).then((response) => {
        return response;
    });

    console.log(blockListResponse);




    /*
     let backendResponse = await axiosClient({
         method: "get",
         url: redirectUrl,
         withCredentials: true,
     }, {withCredentials: true}).then(function (response) {
         return response;
     }).catch(function (error) {
         return error.response;
     });
     console.log(backendResponse.request.res.responseUrl);
 */
    /*
     let secondResponse = await axiosClient.post(firstResponseUrl, formData, {withCredentials: true, }).catch(function(response) {
         secondResponseUrl = response.request.res.responseUrl;
         let cookies = response.headers["set-cookie"];
         console.log(secondResponseUrl);
         console.log(cookies);
         return response;
     });
      */
    return res.status(200).send("Funktioniert.");
    /*
    try  {
        const response = await axiosClient.get("https://www.tu-chemnitz.de/informatik/DVS/blocklist");
        console.log(response.request.responseURL);
        return res.status(200).send("Funktioniert.");
        
    } catch (error) {
        console.error(error);
    }
     */
};

module.exports = {
    shibbolethAuth
}