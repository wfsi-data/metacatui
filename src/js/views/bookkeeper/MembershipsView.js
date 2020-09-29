define(["jquery",
    "underscore",
    "backbone",
    "collections/bookkeeper/Memberships",
    "views/bookkeeper/MembershipView"],
    function($, _, Backbone, Memberships, MembershipView){

    /**
    * @class MembershipsView
    * @classdesc A view of the DataONE Services Memberships that the logged-in User
    * has access to.
    * @extends Backbone.View
    * @
    */
    var MembershipsView = Backbone.View.extend(
      /** @lends MembershipsView.prototype */ {

      className: "memberships-view",

      tagName: "div",

      /**
      * A reference to the Memberships collection that is displayed in this view
      * @type {Memberships}
      */
      memberships: null,

      render: function(){

        try{

          //If no Memberships collection is set on this view and there is no dataone Memberships
          // collection set on the UserModel, then wait for it to be fetched.
          if( !this.memberships && !MetacatUI.appUserModel.get("dataoneMemberships") ){
            this.listenToOnce(MetacatUI.appUserModel, "change:dataoneMemberships", function(dataoneMemberships){
              this.memberships = dataoneMemberships;
              this.render();
            });
            return;
          }
          else if( this.memberships.length == 0 ) {
            this.renderNoMemberships();
            return;
          }

          //If the memberships set on this view is not a Memberships collection, then exit
          if( this.memberships.type != "Memberships" ){
            return;
          }

          var totalMemberships = this.memberships.length;

          //Create and render a MembershipView for each Membership
          this.memberships.each(function(membership){

            //Create and render this MembershipView
            var membershipView = new MembershipView();
            membershipView.membership = membership;
            this.$el.append( membershipView.el );
            membershipView.render();

            if( totalMemberships > 1  && membership.getTotalQuotaLimit("portal") > 0 ){
              this.$el.append("<hr/>");
            }

          }, this);

        }
        catch(e){
          console.error("Couldn't render the DataONE Memberships: ", e);

          //TODO: Improve this error display
          this.$el.html("There was an issue displaying your DataONE Membership.");
        }

      },

      /**
      * If the User has no DataONE Membership, then display the ability to create one.
      */
      renderNoMemberships: function(){
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

    return MembershipsView;

});
