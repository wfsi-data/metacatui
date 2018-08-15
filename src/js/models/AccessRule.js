define(["jquery", "underscore", "models/NestedModel"],
	function($, _, NestedModel) {
	"use strict";
	
	// Access Rule Model 
	// ------------------
	var AccessRule = NestedModel.extend({
		
		defaults: {
			subject: null,
			read: null,
			write: null,
			changePermission: null
		},
		
		initialize: function(){
			
		},
		
		parse: function(){
			
		},
		
		serialize: function(){
			
		}
		
	});
	
	return AccessRule;
	
});