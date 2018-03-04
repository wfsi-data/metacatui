MetacatUI.customMapModelOptions = {
    tileHue: "231"
}

MetacatUI.customAppConfig = function() {
    // Gmaps key: AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs
    
    // Check that slaask didn"t fail before getting its dependency, Pusher
    // if(window._slaask){
    //     //Override _slaask.createScriptTag to use requireJS to load injected module "Pusher"
    //     window._slaask.createScriptTag = function (url) {
    //         var t = {};
    //         require([url], function(Pusher) { 
    //             t.onload(); 
    //             });
    //         return t;
    //     };
    // }
    if(MetacatUI.appModel.get("baseUrl").indexOf("arcticdata.io") > -1 && MetacatUI.appModel.get("baseUrl").indexOf("test") == -1){
        MetacatUI.appModel.set("nodeId", "urn:node:ARCTIC");
        MetacatUI.appModel.set("googleAnalyticsKey", "UA-75482301-1");
    }
}
// var customInitApp = function(){
//     var slaaskScript = document.createElement("script");
//     slaaskScript.setAttribute("type", "text/javascript");
//     slaaskScript.setAttribute("src",  "https://cdn.slaask.com/chat.js");
//     document.getElementsByTagName("body")[0].appendChild(slaaskScript);
//
//     //Give the slaask script 3 seconds to load or move on without it!
//     var slaaskTimeout = window.setTimeout(function(){
//         initApp();
//
//         //Don"t check again
//         window.clearTimeout(slaaskTimeout);
//     }, 3000);
// }