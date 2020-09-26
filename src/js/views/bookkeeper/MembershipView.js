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

      template: _.template('<div class="membership-view-title-container"></div>' +
                           '<div class="membership-view-status-container"></div>' +
                           '<div class="membership-view-portal-quota-container"></div>' +
                           '<div class="my-portals-container"></div>'),
      /**
      * An Underscore template that displays the Membership title
      * @type {_.template}
      */
      titleTemplate: _.template('<h3 class="membership-view-title">My <%=MetacatUI.appModel.get("dataonePlusName")%> Membership ' +
                                '<span class="subtle membership-view-id"></span>' +
                                '<h3>'),
      /**
      * An Underscore template that displays the Membership status
      * @type {_.template}
      */
      statusTemplate: _.template('<h4 class="membership-view-status"><span class="text-info status-label">Status: </span><span class="membership-status"><%=statusNames[status]%></span></h4>'),
      /**
      * An Underscore template that displays the portal quota for this Membership
      * @type {_.template}
      */
      portalQuotaTemplate: _.template('<h4 class="membership-view-portal-quota-usage">' +
                                      '<span class="portal-usage-count-container"></span> of <span class="portal-quota-count-container"></span>' +
                                      ' ' + MetacatUI.appModel.get("portalTermPlural") + ' created.' +
                                      '<div class="progress progress-info">' +
                                      '<div class="bar"></div>' +
                                      '</div>' +
                                      '</h4>'),

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
      /**
      * A jQuery selector for the element that the title should be inserted into
      * @type {string}
      */
      titleContainer: ".membership-view-title-container",
      statusContainer: ".membership-view-status-container",
      portalQuotaContainer: ".membership-view-portal-quota-container",
      membershipIdContainer: ".membership-view-id",

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
            var portalUsagesView = new PortalUsagesView();
            portalUsagesView.membership = this.membership;

            //Render the Portal list view and insert it in the page
            portalUsagesView.render();
            this.$(this.portalListContainer).html(portalUsagesView.el);

            //Add a title for this Membership View. Only display this if there is a
            // portals quota for now
            var membershipJSON = this.membership.toJSON();
            this.$(this.titleContainer).html(this.titleTemplate(membershipJSON));
            this.$(this.membershipIdContainer).text(membershipJSON.id);
            this.$(this.statusContainer).html(this.statusTemplate(membershipJSON));
            this.$(this.portalQuotaContainer).html(this.portalQuotaTemplate(membershipJSON));

            //Get the total portal quota
            var quotaTotal = this.membership.getTotalQuotaLimit("portal");

            //Get the total portal usage
            var usageTotal = this.membership.getTotalUsage("portal");

            //Show the current portal usage for this membership
            this.$(".portal-usage-count-container").text( usageTotal );
            this.$(".portal-quota-count-container").text( quotaTotal );

            //Remove the usage progress bar if the usage or quota is zero.
            if( usageTotal <= 0 || quotaTotal <= 0 ){
              this.$(".membership-view-portal-quota-usage .progress").remove();
            }
            else{
              this.$(".membership-view-portal-quota-usage .progress .bar").css("width", (usageTotal / quotaTotal) * 100 + "%");
            }
          }

        }
        catch(e){
          console.error("Could not render the MembershipView: ", e);
        }

      }

    });

    return MembershipView;

});
