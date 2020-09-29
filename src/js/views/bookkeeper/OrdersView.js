define(["jquery",
    "underscore",
    "backbone",
    "collections/bookkeeper/Orders",
    "views/bookkeeper/OrderView"],
    function($, _, Backbone, Orders, OrderView){

    /**
    * @class OrdersView
    * @classdesc A view of the DataONE Services Orders that the logged-in User
    * has access to.
    * @extends Backbone.View
    * @
    */
    var OrdersView = Backbone.View.extend(
      /** @lends OrdersView.prototype */ {

      className: "orders-view",

      tagName: "div",

      /**
      * A reference to the Orders collection that is displayed in this view
      * @type {Orders}
      */
      orders: null,

      render: function(){

        try{

          //If no Orders collection is set on this view and there is no dataone Orders
          // collection set on the UserModel, then wait for it to be fetched.
          if( !this.orders && !MetacatUI.appUserModel.get("dataoneOrders") ){
            this.listenToOnce(MetacatUI.appUserModel, "change:dataoneOrders", function(dataoneOrders){
              this.orders = dataoneOrders;
              this.render();
            });
            return;
          }
          else if( this.orders.length == 0 ) {
            this.renderNoOrders();
            return;
          }

          //If the orders set on this view is not a Orders collection, then exit
          if( this.orders.type != "Orders" ){
            return;
          }

          var totalOrders = this.orders.length;

          //Create and render a OrderView for each Order
          this.orders.each(function(order){

            //Create and render this OrderView
            var orderView = new OrderView();
            orderView.order = order;
            this.$el.append( orderView.el );
            orderView.render();

            if( totalOrders > 1  && order.getTotalQuotaLimit("portal") > 0 ){
              this.$el.append("<hr/>");
            }

          }, this);

        }
        catch(e){
          console.error("Couldn't render the DataONE Orders: ", e);

          //TODO: Improve this error display
          this.$el.html("There was an issue displaying your DataONE Membership.");
        }

      },

      /**
      * If the User has no DataONE Order, then display the ability to create one.
      */
      renderNoOrders: function(){
        this.$el.html("<h2>You don't have a " + MetacatUI.appModel.get("dataonePlusName") + " " +
                      MetacatUI.appModel.get("dataonePlusGeneralName") + " yet. Start your " +
                      MetacatUI.appModel.get("dataonePlusTrialName") + ": </h2>");

        var thisView = this;

        //Create a CreateOrderView and render it
        require(["views/bookkeeper/CreateOrderView"], function(CreateOrderView){
          createOrderView = new CreateOrderView();
          thisView.$el.append(createOrderView.el);
          createOrderView.render();
        });
      }

    });

    return OrdersView;

});
