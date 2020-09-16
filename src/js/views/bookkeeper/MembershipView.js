define(["jquery",
    "underscore",
    "backbone",
    "models/bookkeeper/Membership",
    "views/portals/PortalUsagesView"],
    function($, _, Backbone, Membership, PortalUsagesView){

    /**
    * @class MembershipView
    * @classdesc A view of a single DataONE Services Membership that the logged-in User
    * has access to.
    * @extends Backbone.View
    * @
    */
    var MembershipView = Backbone.View.extend(
      /** @lends MembershipView.prototype */ {

      className: "membership-view",

      tagName: "div",

      template: _.template('<div class="my-portals-container"></div>'),

      /**
      * The Membership model that is displayed in this view
      * @type {Membership}
      */
      membership: null,

      /**
      * A jQuery selector for the element that the PortalUsagesView should be inserted into
      * @type {string}
      */
      portalListContainer: ".my-portals-container",

      render: function(){

        try{
          // If there is no Membership model associated with this view, there is nothing to render.
          if( !this.membership ){
            return;
          }

          //Insert the template into this view
          this.$el.html( this.template() );

          //Get the portals from this Membership
          var portalQuotas = this.membership.getQuotas("portal");
          if( portalQuotas.length ){
            //Create a PortalUsagesView
            var portalListView = new PortalUsagesView();

            //Render the Portal list view and insert it in the page
            portalListView.render();
            this.$(this.portalListContainer).html(portalListView.el);
          }

        }
        catch(e){
          console.error("Could not render the MembershipView: ", e);
        }

      }

    });

    return MembershipView;

});
