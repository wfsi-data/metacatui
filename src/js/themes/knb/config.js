MetacatUI.customAppConfig = function(){
    //Only apply these settings when we are in production
    if(!MetacatUI.appModel || (MetacatUI.appModel.get("baseUrl").indexOf("knb.ecoinformatics.org") < 0)) return;

    //Gmaps key  AIzaSyA6-jiEs5rmEqKk70bigvnwuvhdZbt4tJs
    
    MetacatUI.appModel.set("nodeId", "urn:node:KNB");
    MetacatUI.appModel.set("googleAnalyticsKey", "UA-1588494-14")
}