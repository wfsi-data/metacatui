define(["jquery",
    "underscore",
    "backbone",
    "models/bookkeeper/Order",
    "views/portals/PortalUsagesView"],
    function($, _, Backbone, Order, PortalUsagesView){

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

      template: _.template('<div class="order-view-title-container"></div>' +
                           '<div class="order-view-status-container"></div>' +
                           '<div class="order-view-portal-quota-container"></div>' +
                           '<div class="my-portals-container"></div>'),
      /**
      * An Underscore template that displays the Order title
      * @type {_.template}
      */
      titleTemplate: _.template('<h3 class="order-view-title">My <%=MetacatUI.appModel.get("dataonePlusName")%>  <%=MetacatUI.appModel.get("dataonePlusGeneralName")%>' +
                                '<span class="subtle order-view-id"></span>' +
                                '<h3>'),
      /**
      * An Underscore template that displays the Order status
      * @type {_.template}
      */
      statusTemplate: _.template('<h4 class="order-view-status"><span class="text-info status-label">Status: </span><span class="order-status"><%=statusNames[status]%></span></h4>'),
      /**
      * An Underscore template that displays the portal quota for this Order
      * @type {_.template}
      */
      portalQuotaTemplate: _.template('<h4 class="order-view-portal-quota-usage">' +
                                      '<span class="portal-usage-count-container"></span> of <span class="portal-quota-count-container"></span>' +
                                      ' ' + MetacatUI.appModel.get("portalTermPlural") + ' created.' +
                                      '<div class="progress progress-info">' +
                                      '<div class="bar"></div>' +
                                      '</div>' +
                                      '</h4>'),

      /**
      * The Order model that is displayed in this view
      * @type {Order}
      */
      order: null,

      /**
      * A jQuery selector for the element that the PortalUsagesView should be inserted into
      * @type {string}
      */
      portalListContainer: ".my-portals-container",
      /**
      * A jQuery selector for the element that the title should be inserted into
      * @type {string}
      */
      titleContainer: ".order-view-title-container",
      statusContainer: ".order-view-status-container",
      portalQuotaContainer: ".order-view-portal-quota-container",
      orderIdContainer: ".order-view-id",

      render: function(){

        try{
          // If there is no Order model associated with this view, there is nothing to render.
          if( !this.order ){
            return;
          }

          //Insert the template into this view
          this.$el.html( this.template() );

          //Get the portals from this Order
          var portalQuotas = this.order.getQuotas("portal");
          if( portalQuotas.length ){
            //Create a PortalUsagesView
            var portalUsagesView = new PortalUsagesView();
            portalUsagesView.order = this.order;

            //Render the Portal list view and insert it in the page
            portalUsagesView.render();
            this.$(this.portalListContainer).html(portalUsagesView.el);

            //Add a title for this Order View. Only display this if there is a
            // portals quota for now
            var orderJSON = this.order.toJSON();
            this.$(this.titleContainer).html(this.titleTemplate(orderJSON));
            this.$(this.orderIdContainer).text(orderJSON.id);
            this.$(this.statusContainer).html(this.statusTemplate(orderJSON));
            this.$(this.portalQuotaContainer).html(this.portalQuotaTemplate(orderJSON));

            //Get the total portal quota
            var quotaTotal = this.order.getTotalQuotaLimit("portal");

            //Get the total portal usage
            var usageTotal = this.order.getTotalUsage("portal");

            //Show the current portal usage for this order
            this.$(".portal-usage-count-container").text( usageTotal );
            this.$(".portal-quota-count-container").text( quotaTotal );

            //Remove the usage progress bar if the usage or quota is zero.
            if( usageTotal <= 0 || quotaTotal <= 0 ){
              this.$(".order-view-portal-quota-usage .progress").remove();
            }
            else{
              this.$(".order-view-portal-quota-usage .progress .bar").css("width", (usageTotal / quotaTotal) * 100 + "%");
            }
          }

        }
        catch(e){
          console.error("Could not render the OrderView: ", e);
        }

      }

    });

    return OrderView;

});
