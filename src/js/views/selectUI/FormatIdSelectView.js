define([
    "jquery",
    "underscore",
    "backbone",
    "views/selectUI/SearchableSelectView",
    "collections/ObjectFormats"
  ],
  function($, _, Backbone, SearchableSelect, ObjectFormats) {

    /**
     * @class FormatIdSelect
     * @classdesc A select interface that allows the user to search for and
     * select object format(s).
     * @extends SearchableSelect
     * @constructor
     */
    var FormatIdSelect = SearchableSelect.extend(
      /** @lends FormatIdSelectView.prototype */
      {
        /**
         * The type of View this is
         * @type {string}
         */
        type: "FormatIdSelect",
        
        /**        
         * className - Returns the class names for this view element
         *          
         * @return {string}  class names
         */         
        className: SearchableSelect.prototype.className + " format-id-select",
        
        /**       
         * Text to show in the input field before any value has been entered
         * @type {string}        
         */ 
        placeholderText: "Search for or select object formats",
        
        /**       
         * Label for the input element
         * @type {string}        
         */ 
        inputLabel: "Select one or more metadata type",
        
        /**        
         * Whether to allow users to select more than one value        
         * @type {boolean}
         */         
        allowMulti: true,
        
        /**        
         * Setting to true gives users the ability to add their own options that
         * are not listed in this.options. This can work with either single
         * or multiple search select dropdowns        
         * @type {boolean}
         */         
        allowAdditions: false,
        
        /**
         * Creates a new FormatIdSelectView
         * @param {Object} options - A literal object with options to pass to the view
         */ 
        initialize: function(options){
          try {
            // Ensure the object format IDs are cached
            if ( typeof MetacatUI.objectFormats === "undefined" ) {
                MetacatUI.objectFormats = new ObjectFormats();
                MetacatUI.objectFormats.fetch();
            }
            SearchableSelect.prototype.initialize.call(this, options);
          } catch (e) {
            console.log("Failed to initialize a Format Id Select View, error message: " + e);
          }
        },
        
        /**        
         * Render the view
         *          
         * @return {SeachableSelect}  Returns the view
         */         
        render: function(){
          
          try {
            
            var view = this;
            
            // Ensure the object format IDs are cached before rendering
            if(typeof MetacatUI.objectFormats === "undefined" || MetacatUI.objectFormats.length === 0){
                MetacatUI.objectFormats = new ObjectFormats();
                this.listenToOnce(MetacatUI.objectFormats, "sync", this.render)
                MetacatUI.objectFormats.fetch();
            }
            
            var formatIds = MetacatUI.objectFormats.toJSON();
            var options = _.chain(formatIds)
                // Since the query rules automatically include a rule for
                // formatType = "METADATA", only allow filtering datasets
                // by specific metadata type.
                // TODO - make this configurable in this view
                .where({formatType: "METADATA"})
                .map(
                    function(format){
                        return {
                            label: format.formatName,
                            value: format.formatId,
                            description: format.formatId
                        }
                    }
                )
                .value();
        
            // Set the format Ids on the view
            this.options = options;

            SearchableSelect.prototype.render.call(this);
            
          } catch (e) {
            console.log("Failed to render a Format Id Select View, error message: " + e);
          }
        },

      });
      return FormatIdSelect;
  });
