/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "collections/bookkeeper/Quotas"],
  function($, _, Backbone, Quotas) {
    /**
     * @classdesc A Membership Model represents a single instance of a Membership object from the
     * DataONE Bookkeeper data model.
     * Memberships represent a Product that has been ordered by a Customer
     * and is paid for on a recurring basis or is in a free trial period.
     * See https://github.com/DataONEorg/bookkeeper for documentation on the
     * DataONE Bookkeeper service and data model.
     *
     * @class Membership
     * @name Membership
     * @constructor
    */
    var Membership = Backbone.Model.extend(
      /** @lends Membership.prototype */ {

      /**
      * The name of this type of model
      * @type {string}
      */
      type: "Membership",

      /**
      * Default attributes for Membership models
      * @name Membership#defaults
      * @type {Object}
      * @property {string} id  The unique identifier of this Membership, from Bookkeeper
      * @property {string} object The name of this type of Bookkeeper object, which will always be "membership"
      * @property {number} canceledAt  The timestamp of the date that this Membership was canceled
      * @property {string} collectionMethod  The method of payment collection for this Membership, which is a string from a controlled vocabulary from Bookkeeper
      * @property {number} created  The timestamp of the date that this Membership was created
      * @property {number} customerId  The identifier of the Customer that is associated with this Membership
      * @property {Object} metadata  Arbitrary metadata about this Membership. These values should be parsed and set on this model (TODO)
      * @property {number} productId  The identifier of a Product in this Membership
      * @property {number} quantity  The number of Memberships
      * @property {number} startDate  The timestamp of the date that this Membership was started
      * @property {string} status  The status of this Membership, which is taken from a controlled vocabulary set on this model (statusOptions)
      * @property {string[]} statusOptions  The controlled vocabulary from which the `status` value can be from
      * @property {number} trialEnd  The timestamp of the date that this free trial Membership ends
      * @property {number} trialStart  The timestamp of the date that this free trial Membership starts
      * @property {Quotas} quotas A Quotas collection that is associated with this Membership
      */
      defaults: function(){
        return {
          id: null,
          object: "membership",
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
          trialEnd: null,
          trialStart: null,
          quotas: null
        }
      },

      /**
      * Constructs and returns the URL string that is used to fetch and save a Membership
      */
      url: function(){
        return MetacatUI.appModel.get("bookkeeperMembershipsUrl");
      },

      /**
      * Parses and returns the raw json returned from fetch()
      * @param {JSON} membershipJSON - The raw JSON returned from Membership.fetch()
      * @returns {JSON} The model data in JSON form
      */
      parse: function(membershipJSON){

        //Create a Quotas Collection for the quotas attribute, and use that collection to parse that
        // section of the JSON
        if( membershipJSON.quotas && membershipJSON.quotas.length ){
          var quotasCollection = new Quotas(membershipJSON.quotas);
          membershipJSON.quotas = quotasCollection;
        }
        else{
          membershipJSON.quotas = this.defaults().quotas;
        }

        return membershipJSON;
      },

      /**
      * Finds the Quotas in this Membership, filters down to the type given, and returns them.
      * If no type is specified, all quotas in this Membership will be returned.
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
      *
      * Returns true if this Membership is in a free trial period.
      * @returns {boolean}
      */
      isTrialing: function(){
        return this.get("status") == "trialing";
      }

  });

  return Membership;
});
