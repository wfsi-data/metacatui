define(['jquery', 'underscore', 'backbone'], function($, _, Backbone) {
    
    /**
     * A Theme represents a customization of the application,
     * both visually and functionally.  It takes a configuration object
     * of attributes on instantiation, and is effectively a store for those
     * settings for the application to use to modify the look, feel, and 
     * behavior.
     */
    var Theme = Backbone.Model.extend({
        
        /* Default model attributes are overridden it themes/<theme>/config.json */
        defaults: function() {
            return {
                themeName: "default",
                themeTitle: "Data Catalog",
            }
        }
    }, 
    {
        /** 
         * A static method to get the theme name from the index document, 
         * with a fallback to "default"
         */
        getThemeName: function() {
            var name = document.getElementById("entrypoint").getAttribute("data-theme");
            return ((typeof name === "string" && name != "") ? name : "default");
        }
    });
    return Theme;
});