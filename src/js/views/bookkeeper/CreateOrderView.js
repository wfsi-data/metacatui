define(["jquery",
    "underscore",
    "backbone",
    "models/bookkeeper/Customer",
    "models/bookkeeper/Membership",
    "text!templates/bookkeeper/createOrder.html"],
    function($, _, Backbone, Customer, Membership, Template){

    /**
    * @class CreateOrderView
    * @classdesc A form that allows the user to create a DataONE Plus Order
    * @extends Backbone.View
    * @
    */
    var CreateOrderView = Backbone.View.extend(
      /** @lends CreateOrderView.prototype */ {

      className: "create-order-view",

      tagName: "div",

      template: _.template(Template),

      /**
      * The Customer model for this person
      * @type {Customer}
      */
      customer: null,

      /**
      * The Order model that is being created
      * @type {Order}
      */
      order: null,

      events: {
        "click .save" : "saveCustomer",
        "keydown input" : "removeValidation"
      },

      render: function(){

        this.customer = new Customer();
        this.customer.copyFromUser(MetacatUI.appUserModel);

        //Show a Customer form
        this.$el.html(this.template(this.customer.toJSON()));

        //When the Customer fails to save, show an error
        this.listenTo(this.customer, "error", this.showCustomerSaveError);

        //When the Customer is successfully saved, create an Order
        this.listenTo(this.customer, "sync",  this.createOrder);
      },

      /**
      * Takes the input from the form and saves the Customer model
      */
      saveCustomer: function(){

        try{
          var firstName = this.$("#inputFirstName").val(),
              lastName  = this.$("#inputLastName").val(),
              email     = this.$("#inputEmail").val(),
              isError   = false;

          if( !firstName || typeof firstName != "string" ){
            this.$("#inputFirstName").parents(".control-group").first().addClass("error")
                .find(".help-inline").text("Please provide your first name.");
            isError = true;
          }
          if( !lastName || typeof lastName != "string" ){
            this.$("#inputLastName").parents(".control-group").first().addClass("error")
                .find(".help-inline").text("Please provide your last name.");
            isError = true;
          }
          if( !email || typeof email != "string" ){
            this.$("#inputEmail").parents(".control-group").first().addClass("error")
                .find(".help-inline").text("Please provide your email.");
            isError = true;
          }

          //If there was a validation error, exit this function
          if( isError ){
            return;
          }

          //Update the Customer with the values from the form
          this.customer.set({
            givenName: firstName,
            surName: lastName,
            email: email
          });

          //When the Customer has been successfully saved, create an Order model
          this.listenToOnce(this.customer, "sync", this.createOrder);

          //Save the Customer model to the server
          this.customer.save();
        }
        catch(e){
          console.error("Error while trying to save the create customer form: ", e);
        }
      },

      /**
      * Creates an Order model and saves it to Bookkeeper
      */
      createOrder: function(){

        //If the Customer was not successfully saved to the server and given an ID
        if( !this.customer || this.customer.isNew() ){
          //Then show an error message and exit
          this.showCustomerSaveError();
          return;
        }

        //Create an Order model
        this.order = new Membership({
          customerId: this.customer.get("id"),
          status: "trialing"
        });

        //When the Order is successfully saved, show the Order view
        this.listenToOnce(this.order, "sync", this.confirmOrder);
        //If the Order fails to save, show the error message
        this.listenToOnce(this.order, "error", this.showOrderSaveError);

        //Save the order to Bookkeeper
        this.order.save();

      },

      confirmOrder: function(){

        try{

          //Only proceed if the Order was successfully created
          if( !this.order || this.order.isNew() ){
            this.showOrderSaveError();
            return;
          }

          //TODO: Create and render an OrderView

        }
        catch(e){
          console.error("Failed to save while confirming an Order: ", e);
        }

      },

      /**
      * Removes the validation error messaging from the form
      * @param {Event} [e] - An Event that triggered this callback function
      */
      removeValidation: function(e){
        try{
          //Remove the error messaging from the given form element
          if(e){
            $(e.target).parents(".control-group").first().removeClass("error")
              .find(".help-inline").text("");
          }
          //Remove the error messaging everywhere in the view
          else{
            this.$(".error").removeClass("error");
            this.$(".help-inline").text("");
          }
        }
        catch(error){
          console.warn("Couldn't remove the validation: ", error);
        }
      },

      /**
      * When a Customer fails to save, this function is called to display an error message to the user
      */
      showCustomerSaveError: function(){
        try{

          MetacatUI.appView.showAlert({
            message: this.customer.get("errorMessage") || "Something went wrong while creating a " + MetacatUI.appModel.get("dataonePlusGeneralName") + ".",
            classes: "error alert-error",
            container: this.el,
            replaceContents: false,
            remove: true,
            includeEmail: true
          });

          //Remove the listener to the sync event for the Customer
          this.stopListening(this.customer, "sync", this.createOrder);

        }
        catch(e){
          console.error("Failed to save while creating a customer: ", e);
        }
      },

      /**
      * When an Order fails to save, this function is called to display an error message to the user
      */
      showOrderSaveError: function(){
        try{

          MetacatUI.appView.showAlert({
            message: this.order.get("errorMessage") || "Something went wrong while creating a " + MetacatUI.appModel.get("dataonePlusGeneralName") + ".",
            classes: "error alert-error",
            container: this.el,
            replaceContents: false,
            remove: true,
            includeEmail: true
          });

          //Remove the listener to the sync event for the Order
          this.stopListening(this.order, "sync", this.confirmOrder);

        }
        catch(e){
          console.error("Failed to save while creating an Order: ", e);
        }
      }

    });

    return CreateOrderView;
});
