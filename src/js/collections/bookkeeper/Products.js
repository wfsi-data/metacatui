"use strict";

define(["jquery", "underscore", "backbone", "models/bookkeeper/Product"],
  function($, _, Backbone, Product) {

  /**
   * @class Products
   * @classdesc
   */
  var Products = Backbone.Collection.extend(
    /** @lends Products.prototype */ {

    /**
    * The class/model that is contained in this collection.
    * @type {Backbone.Model}
    */
    model: Product,

    /**
    * Constructs a URL string for fetching this collection and returns it
    * @param {Object} [options]
    * @returns {string} The URL string
    */
    url: function(options){

      //Get the Bookkeeper Products endpoint
      var url = MetacatUI.appModel.get("bookkeeperProductsUrl");

      return url;

    },

    /**
    * Fetches a list of Products from the DataONE Bookkeeper service, parses them, and
    * stores them on this collection.
    * @param {Object} [options]
    */
    fetch: function(options){

      var fetchOptions = {
        url: this.url(options)
      }

      fetchOptions = Object.assign(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

      //Call Backbone.Collection.fetch to retrieve the info
      return Backbone.Collection.prototype.fetch.call(this, fetchOptions);

    },

    /**
    * Parses the fetch() of this collection. Bookkeeper returns JSON already, so there
    * isn't much parsing to do.
    * @returns {JSON} The collection data in JSON form
    */
    parse: function(response){

      return response.products;
    }

  });

  return Products;
});
