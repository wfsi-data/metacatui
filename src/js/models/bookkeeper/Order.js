/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "uuid",
        "collections/bookkeeper/Quotas"],
  function($, _, Backbone, uuid, Quotas) {
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
      * @property {number} amount The order amount (in the smallest unit of the currency)
      * @property {number} amountReturned The order amount returned (in pence of the currency)
      * @property {number} canceledAt  The timestamp of the date that this Order was canceled
      * @property {object} charge The order payment charge details
      * @property {string} collectionMethod  The method of payment collection for this Order, which is a string from a controlled vocabulary from Bookkeeper
      * @property {number} created  The timestamp of the date that this Order was created
      * @property {string} currency The order currency id
      * @property {number} customer  The identifier of the Customer that is associated with this Order
      * @property {number} endDate The order services' end timestamp (from the unix epoch in seconds)
      * @property {object[]} items The order item list of products
      * @property {Object} metadata  Arbitrary metadata about this Order. These values should be parsed and set on this model (TODO)
      * @property {string} name The name for this Order, chosen by the user, to distinguish it from other Orders
      * @property {number} productId  The identifier of a Product in this Order
      * @property {number} quantity  The number of Orders
      * @property {number} startDate  The timestamp of the date that this Order was started
      * @property {string} status  The status of this Order, which is taken from a controlled vocabulary set on this model (statusOptions)
      * @property {string[]} statusOptions  The controlled vocabulary from which the `status` value can be from
      * @property {object} statusNames A literal object that maps the status type to a human-readable name
      * @property {object} statusTransitions The order status transitions (history of status/timestamp key/value pairs)
      * @property {string} subject The subject identifier of the order, likely a DataONE group
      * @property {number} trialEnd  The timestamp of the date that this free trial Order ends
      * @property {number} trialStart  The timestamp of the date that this free trial Order starts
      * @property {string} seriesId An identifier used to track renewals across multiple discrete orders
      * @property {Quotas} quotas A Quotas collection that is associated with this Order
      * @property {number} updated The order update date (seconds since the epoch)
      * @property {UserGroup} orderGroup The group of users who manage and use this Order
      * @property {string} errorMessage An error message set during the last save() error
      */
      defaults: function(){
        return {
          id: null,
          object: "order",
          amount: 0,
          amountReturned: 0,
          canceledAt: null,
          charge: null,
          collectionMethod: "send_invoice",
          created: null,
          currency: "USD",
          customer: null,
          endDate: null,
          items: [],
          metadata: {},
          name: "",
          productId: null,
          quantity: 0,
          startDate: null,
          status: null,
          statusOptions: ["trialing", "active", "created", "past_due", "refunded", "unpaid"],
          statusNames: {
            "trialing": "Preview Mode",
            "active": "Active",
            "created": "Created",
            "past_due": "Past due",
            "refunded": "Refunded",
            "unpaid": "Unpaid"},
          statusTransitions: {},
          trialEnd: null,
          trialStart: null,
          quotas: null
        }
      },

      saveAttrs: ["object", "amount", "customer", "items", "status", "name", "subject", "seriesId"],

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
      * Saves this Order to Bookkeeper
      */
      save: function(){
        try{

          //Create a seriesId for the Order
          if( this.isNew() ){
            this.set("seriesId", "urn:uuid:" + uuid.v4());
          }

          //Create an error callback
          var saveOptions = {
            dataType: "json",
            error: function(order, response){

              MetacatUI.appModel.logError("Failed to save the Order model: " + response.responseText + " | " + MetacatUI.appUserModel.get("username") +
                                          " | v." + MetacatUI.metacatUIVersion, true);
              order.set("errorMessage", response.responseText);
              order.trigger("error");
            }
          }

          // If model defines serverAttrs, replace attrs with trimmed version
          saveOptions.attrs = _.pick(this.toJSON(), this.saveAttrs);

          saveOptions = _.extend(saveOptions, MetacatUI.appUserModel.createAjaxSettings());

          return Backbone.Model.prototype.save.call(this, saveOptions.attrs, saveOptions);
        }
        catch(e){
          MetacatUI.appModel.logError("Caught exception when saving the Order model: " + e.message + " | " + MetacatUI.appUserModel.get("username") +
                                      " | v." + MetacatUI.metacatUIVersion, true);
        }
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
      },

      /**
      * Creates and sets OrderItem objects on this Order model that represent the given Product
      * @param {Product} product
      */
      addProduct: function(product){

        if( !product ){
          return;
        }

        //Create an OrderItem for this Product.
        var item = {
          object: "orderitem",
          amount: product.get("amount"),
          quantity: 1,
          type: "sku",
          description: product.get("statementDescriptor"),
          currency: product.get("currency"),
          parent: product.get("id")
        }

        //Update the items array with the new item
        var currentItems = this.get("items");
        currentItems.push(item);
        this.set("items", currentItems);
      },

      /**
      * Creates a UserGroup of people that will use and manage this Order.
      * Saves it to the DataONE identity service.
      */
      createOrderGroup: function(){

        var order = this;

        require(["collections/UserGroup"], function(UserGroup){

          try{
            //Create a group for the Order
            var orderGroup = new UserGroup([MetacatUI.appUserModel], {
              groupId: "membership-" + (Math.floor(Math.random() * (99999999 - 999999) + 999999)),
              name: order.get("name"),
              pending: true
            });

            //Save a reference to the UserGroup on this model
            order.set("orderGroup", orderGroup);

            //Set the subject of the Order as the group subject
            order.set("subject", orderGroup.get("groupId"));
          }
          catch(e){
            console.error("Caught exception while creating the Order UserGroup: ", e);
            MetacatUI.appModel.logError("Caught exception while creating the Order UserGroup: " + e.message + " | " + MetacatUI.appUserModel.get("username") +
                                        " | v." + MetacatUI.metacatUIVersion, true);
            this.trigger("error", e.message);

          }
        });

      },

      pay: function(){

        try{

          if( this.isNew() ){
            console.warn("Cannot pay Order that hasn't been saved yet");
            return;
          }

          var thisOrder = this;

          $.ajax( Object.assign({
            type: "POST",
            url: MetacatUI.appModel.get("bookkeeperOrdersUrl") + "/" + this.get("id") + "/pay",
            success: function(data, textStatus, xhr){
              thisOrder.trigger("paySuccess");
            },
            error: function(xhr, textStatus, error){
              thisOrder.trigger("error");
            }
          }, MetacatUI.appUserModel.createAjaxSettings() ));

        }
        catch(e){
          console.error("Caught exception while paying an Order: ", e);
        }

      }

  });

  return Order;
});
