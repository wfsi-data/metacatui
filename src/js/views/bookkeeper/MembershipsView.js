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

        //If no Memberships collection is set on this view, there is nothing to render.
        if( !this.memberships ){
          return;
        }

        try{

          //Create and render a MembershipView for each Membership
          this.memberships.each(function(membership){

            //Create and render this MembershipView
            var membershipView = new MembershipView();
            membershipView.membership = membership;
            this.$el.append( membershipView.el );
            membershipView.render();

          }, this);

        }
        catch(e){
          console.error("Couldn't render the DataONE Memberships: ", e);

          //TODO: Improve this error display
          this.$el.html("There was an issue displaying your DataONE Membership.");
        }

      }

    });

    return MembershipsView;

});
