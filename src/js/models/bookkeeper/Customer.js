/* global define */
define(["jquery",
        "underscore",
        "backbone"],
  function($, _, Backbone, Quotas) {
    /**
     * @classdesc A Customer Model represents a single instance of a Customer object from the
     * DataONE Bookkeeper data model.
     * Customer represent a person or group
     *
     * @class Customer
     * @name Customer
     * @constructor
    */
    var Customer = Backbone.Model.extend(
      /** @lends Customer.prototype */ {

      /**
      * The name of this type of model
      * @type {string}
      */
      type: "Customer",

      /**
      * Default attributes for Customer models
      * @name Customer#defaults
      * @type {Object}
      * @property {string} id  The unique identifier of this Customer, from Bookkeeper
      * @property {string} object The name of this type of Bookkeeper object, which will always be "customer"
      * @property {string} subject The DataONE subject/username of this Customer
      * @property {number} balance The monetary balance for this Customer's account
      * @property {object} address The mailing address
      * @property {number} created The date timestamp when this Customer was created
      * @property {boolean} delinquent If true, this Customer's account is deliquent in payments
      * @property {string} email The email address
      * @property {object} invoiceSettings
      * @property {object} metadata Additional metadata about this Customer
      * @property {string} givenName The first name of this person
      * @property {string} surName The last name of this person
      * @property {string} name The full name of this person
      * @property {User} userModel A reference to a User model that represents the same person as this Customer,
      * @property {string} erroMessage A user-facing error message that explains why the most recent save() or fetch() failed
      */
      defaults: function(){
        return {
          id: null,
          object: "customer",
          subject: "",
          balance: 0,
          address: {},
          created: null,
          delinquent: false,
          discount: {},
          email: "",
          invoiceSettings: {},
          metadata: {},
          givenName: "",
          surName: "",
          name: "",
          userModel: null
        }
      },

      /**
      * Constructs and returns the URL string that is used to fetch and save a Customer
      */
      url: function(){

        if( typeof this.get("id") == "string" && this.get("id").length > 0 ){
          return MetacatUI.appModel.get("bookkeeperCustomersUrl") + "/" + this.get("id");
        }
        else if(this.get("subject")){
          return MetacatUI.appModel.get("bookkeeperCustomersUrl") + "?subject=" + encodeURIComponent(this.get("subject"));
        }
        else{
          return MetacatUI.appModel.get("bookkeeperCustomersUrl");
        }

      },

      /**
      * Parses and returns the raw json returned from fetch()
      * @param {JSON} customersJSON - The raw JSON returned from Customer.fetch()
      * @returns {JSON} The model data in JSON form
      */
      parse: function(customersJSON){

        var parsedJSON = {};

        if( customersJSON && Array.isArray(customersJSON.customers) ){
          if( customersJSON.customers.length == 1 ){
            parsedJSON = customersJSON.customers[0];
          }
          else{
            return parsedJSON;
          }
        }

        //Store a reference to this Customer in the UserModel
        if( MetacatUI.appUserModel.get("username") == parsedJSON.subject ){
          parsedJSON.userModel = MetacatUI.appUserModel;
          MetacatUI.appUserModel.set("dataoneCustomer", this);
        }

        return parsedJSON;
      },

      /**
      * Fetches the Customer from the DataONE Bookkeeper service
      */
      fetch: function(){

        try{
          var fetchOptions = {
            error: function(customer, xhr){
              if( xhr.status == 404 ){
                customer.trigger("notFound");
              }
            }
          }

          fetchOptions = Object.assign(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

          //Call Backbone.Model.fetch to retrieve the info
          return Backbone.Model.prototype.fetch.call(this, fetchOptions);
        }
        catch(e){
          console.error("Error while fetching the Customer: ", e);
          Backbone.Model.prototype.fetch.call(this);
        }
      },

      /**
      * Saves this Customer to the DataONE Bookkeeper service
      */
      save: function(){

        try{

          //If the Customer is new, POST a new Customer object
          if( this.isNew() ){

            //The data for this Customer in JSON form
            var customerData = {
                "object": "customer",
                "givenName": this.get("givenName"),
                "surName": this.get("surName"),
                "email": this.get("email"),
                "subject": this.get("subject")
            }

            var saveOptions = {
              dataType: "json",
              error: function(customer, response){
                if( response.status = 500 && response.responseText.indexOf("A customer exists with the given email") > -1 ){
                  customer.set("errorMessage", "There is already a " + MetacatUI.appModel.get("dataonePlusName") +
                               " account with that email. Either sign up with a " +
                               "different email or login to your other account to access your existing " + MetacatUI.appModel.get("dataonePlusGeneralName") + ".");
                  customer.trigger("error");
                }
                else{
                  MetacatUI.appModel.logError("Failed to save the Customer model: " + response.responseText, true);
                  customer.trigger("error");
                }
              }
            }

            saveOptions = _.extend(saveOptions, MetacatUI.appUserModel.createAjaxSettings());

            return Backbone.Model.prototype.save.call(this, customerData, saveOptions);
          }

        }
        catch(e){
          console.error("Could not save the Customer: ", e);
          MetacatUI.appModel.logError("JS runtime error while trying to save the Customer model: " + e.message, true);
          this.trigger("error");
        }

      },

      /**
      * Gets common attributes from the given User model and sets it on this model
      * @param {User} user - The User model to copy attributes from
      */
      copyFromUser: function(user){

        try{
          if( typeof user == "undefined" ){
            return;
          }

          this.set({
            subject: user.get("username"),
            givenName: user.get("firstName"),
            surName: user.get("lastName"),
            email: user.get("email")
          });
        }
        catch(e){
          console.error("Could not copy from user: ", e);
        }
      }

  });

  return Customer;
});
