define(["jquery",
    "underscore",
    "backbone",
    "models/bookkeeper/Order",
    "views/portals/PortalUsagesView",
    "text!templates/bookkeeper/order.html"],
    function($, _, Backbone, Order, PortalUsagesView, Template){

    /**
    * @class OrderView
    * @classdesc A view of a single DataONE Services Order that the logged-in User
    * has access to.
    * @extends Backbone.View
    * @
    */
    var OrderView = Backbone.View.extend(
      /** @lends OrderView.prototype */ {

      className: "order-view",

      tagName: "div",

      template: _.template(Template),

      /**
      * The Order model that is displayed in this view
      * @type {Order}
      */
      order: null,

      /**
      * A jQuery selector for the element that the PortalUsagesView should be inserted into
      * @type {string}
      */
      portalListContainer: ".order-view-portal-usages-container",
      /**
      * A jQuery selector for the element that contains the navigation for this view
      * @type {string}
      */
      navigationContainer: ".order-view-nav",

      render: function(){

        try{
          // If there is no Order model associated with this view, there is nothing to render.
          if( !this.order ){
            return;
          }

          //Convert the Order model attributes to JSON
          var templateJSON = this.order.toJSON();
          templateJSON.expiry = "";
          templateJSON.daysLeft = "";

          //Insert the template into this view
          this.$el.html( this.template(templateJSON) );

          //Get the portals from this Order
          var portalQuotas = this.order.getQuotas("portal");
          if( portalQuotas.length ){
            //Create a PortalUsagesView
            var portalUsagesView = new PortalUsagesView();
            portalUsagesView.order = this.order;

            //Render the Portal list view and insert it in the page
            this.$(this.portalListContainer).html(portalUsagesView.el);
            portalUsagesView.render();

            //Get the total portal quota
            var portalQuotaTotal = this.order.getTotalQuotaLimit("portal");

            //Get the total portal usage
            var portalUsageTotal = this.order.getTotalUsage("portal");

            //Remove the usage progress bar if the usage or quota is zero.
            if( portalUsageTotal <= 0 || portalQuotaTotal <= 0 ){
              this.$(".order-view-portal-quota-usage .progress").remove();
            }
            else{
              this.$(".order-view-portal-quota-usage .progress .bar").css("width", (portalUsageTotal / portalQuotaTotal) * 100 + "%");
            }
          }

          //Render the People

        }
        catch(e){
          console.error("Could not render the OrderView: ", e);
        }

      }

    });

    return OrderView;

});
