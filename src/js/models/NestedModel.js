define(["jquery", "underscore", "backbone"], function($, _, Backbone) {
    
    /*
     * A Backbone model that triggers change events for its nested models, i.e.
     * attributes of the model with values that are also Backbone models.
     * This overrides the set() method and listens to nested model events.
     * Change events from nested models are triggered for the parent as
     * well. Otherwise, all other Backbone.Model behavior remains.  Although
     * Backbone.Model's unset() and clear() methods produce "change" events, they
     * both call set() internally so these events should be handled as well.
     */
    var NestedModel = Backbone.Model.extend({
        /*
         * Override the set() method, and test attribute values for
         * nested model values, emitting "change" events when found.
         */
        set: function(key, val, options) {
            var attrs;
            var silent;
            var prefix = "change";
            var suffix;
            
            // Handle both key/value pair and object-style attributes.
            if (key == null) return this;
            
            if (typeof key === "object") {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }
            options || (options = {});
            silent = options.silent;
            
            // Test if each attribute value is a Backbone.Model
            _.each(attrs, function(val, attr) {
                var name = attr;
                var model = val;
                var event;
                var copiedArgs;
                if ( model instanceof Backbone.Model ) {
                    // Listen to all events for Backbone.Models
                    this.listenTo(model, "all", function(childEvent, arguments) {
                        // Determine if this is a change event
                        if ( childEvent.indexOf(prefix) === 0 ) {
                            // Get the remainder of the event text for property changes
                            if ( childEvent.length > prefix.length ) {
                                suffix = childEvent.substring(prefix.length + 1);
                                if ( suffix.indexOf(":") === 0 ) {
                                    suffix = suffix.substring(suffix.indexOf(":") + 1).trim();
                                }
                                
                                // Make a new event, labeled by the child name, and 
                                // add the suffix if is defined
                                event = prefix + ":" + name + (suffix ? ":" + suffix : "");
                                
                                // Now trigger the event for this parent object if not silenced
                                if ( !silent ) {
                                    this.trigger.apply(this, [event].concat(arguments));
                                }
                            }
                        }
                    });
                }
            }, this);
            
            // Now call the super() Backbone.Model.set()
            Backbone.Model.prototype.set.call(this, key, val, options);
        }
    });
    return NestedModel;
});