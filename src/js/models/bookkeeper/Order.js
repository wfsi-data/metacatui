/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "collections/bookkeeper/Quotas"],
  function($, _, Backbone, Quotas) {
    /**
     * @classdesc A Order Model represents a single instance of a Order object from the
     * DataONE Bookkeeper data model.
     * Orders represent a Product that has been ordered by a Customer
     * and is paid for on a recurring basis or is in a free trial period.
     * See https://github.com/DataONEorg/bookkeeper for documentation on the
     * DataONE Bookkeeper service and data model.
     *
     * @class Order
     * @name Order
     * @constructor
    */
    var Order = Backbone.Model.extend(
      /** @lends Order.prototype */ {

      /**
      * The name of this type of model
      * @type {string}
      */
      type: "Order",

      /**
      * Default attributes for Order models
      * @name Order#defaults
      * @type {Object}
      * @property {string} id  The unique identifier of this Order, from Bookkeeper
      * @property {string} object The name of this type of Bookkeeper object, which will always be "order"
      * @property {number} canceledAt  The timestamp of the date that this Order was canceled
      * @property {string} collectionMethod  The method of payment collection for this Order, which is a string from a controlled vocabulary from Bookkeeper
      * @property {number} created  The timestamp of the date that this Order was created
      * @property {number} customerId  The identifier of the Customer that is associated with this Order
      * @property {Object} metadata  Arbitrary metadata about this Order. These values should be parsed and set on this model (TODO)
      * @property {number} productId  The identifier of a Product in this Order
      * @property {number} quantity  The number of Orders
      * @property {number} startDate  The timestamp of the date that this Order was started
      * @property {string} status  The status of this Order, which is taken from a controlled vocabulary set on this model (statusOptions)
      * @property {string[]} statusOptions  The controlled vocabulary from which the `status` value can be from
      * @property {object} statusNames A literal object that maps the status type to a human-readable name
      * @property {number} trialEnd  The timestamp of the date that this free trial Order ends
      * @property {number} trialStart  The timestamp of the date that this free trial Order starts
      * @property {Quotas} quotas A Quotas collection that is associated with this Order
      */
      defaults: function(){
        return {
          id: null,
          object: "order",
          canceledAt: null,
          collectionMethod: "send_invoice",
          created: null,
          customerId: null,
          metadata: {},
          productId: null,
          quantity: 0,
          startDate: null,
          status: null,
          statusOptions: ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete_expired", "incomplete"],
          statusNames: {
            "trialing": "Preview Mode",
            "active": "Active",
            "past_due": "Past due",
            "canceled": "Canceled",
            "unpaid": "Unpaid",
            "incomplete_expired": "Expired",
            "incomplete": "Incomplete"},
          trialEnd: null,
          trialStart: null,
          quotas: null
        }
      },

      /**
      * Constructs and returns the URL string that is used to fetch and save a Order
      */
      url: function(){
        return MetacatUI.appModel.get("bookkeeperOrdersUrl");
      },

      /**
      * Parses and returns the raw json returned from fetch()
      * @param {JSON} orderJSON - The raw JSON returned from Order.fetch()
      * @returns {JSON} The model data in JSON form
      */
      parse: function(orderJSON){

        //Create a Quotas Collection for the quotas attribute, and use that collection to parse that
        // section of the JSON
        if( orderJSON.quotas && orderJSON.quotas.length ){
          var quotasCollection = new Quotas(orderJSON.quotas);
          orderJSON.quotas = quotasCollection;
        }
        else{
          orderJSON.quotas = this.defaults().quotas;
        }

        return orderJSON;
      },

      /**
      * Finds the Quotas in this Order, filters down to the type given, and returns them.
      * If no type is specified, all quotas in this Order will be returned.
      * @param {string} [type] - The Quota type to return. e.g. "portal". See {@link Quota#defaults} `quotaTypeOptions`
      * @returns {Quota[]} The filtered array of Quota models or an empty array, if none are found
      */
      getQuotas: function(type){
        var quotas = this.get("quotas");

        if( quotas && type ){
          return quotas.where({ quotaType: type });
        }
        else if( quotas && !type ){
          return quotas;
        }
        else{
          return [];
        }
      },

      /**
      * For each Quota of this type in this Order, the usage quantity is totaled and returned.
      * If no type is specified, all quotas in this Order will be totaled.
      * @param {string} [type] - The Quota type to total. e.g. "portal". See {@link Quota#defaults} `quotaTypeOptions`
      * @returns {number} The total usage of the given Quota type for this Order
      */
      getTotalUsage: function(type){
        var totalUsage = 0;

        _.each(this.getQuotas(type), function(q){
          totalUsage += q.get("totalUsage");
        });

        return totalUsage;
      },

      /**
      * For each Quota of this type in this Order, the quota softLimit is totaled and returned.
      * If no type is specified, all quotas in this Order will be totaled.
      * @param {string} [type] - The Quota type to total. e.g. "portal". See {@link Quota#defaults} `quotaTypeOptions`
      * @returns {number} The total quota softLimit of the given Quota type for this Order
      */
      getTotalQuotaLimit: function(type){
        var totalQuotaLimit = 0;

        _.each(this.getQuotas(type), function(q){
          totalQuotaLimit += q.get("softLimit");
        });

        return totalQuotaLimit;
      },

      /**
      *
      * Returns true if this Order is in a free trial period.
      * @returns {boolean}
      */
      isTrialing: function(){
        return this.get("status") == "trialing";
      }

  });

  return Order;
});
