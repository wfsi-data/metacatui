define(["jquery",
  "underscore",
  "backbone",
  "collections/SolrResults",
  "collections/Filters",
  "collections/bookkeeper/Usages",
  "views/portals/PortalListView",
  "text!templates/portals/portalList.html"],
  function($, _, Backbone, SearchResults, Filters, Usages, PortalListView, Template){

    /**
    * @class PortalUsagesView
    * @classdesc A view that shows a list of Portal Usages
    * @extends PortalListView
    * @constructor
    */
    return PortalListView.extend(
      /** @lends PortalUsagesView.prototype */{

      /**
      * A reference to the DataONE Plus Membership that these Portals are a part of.
      * @type {Membership}
      */
      membership: null,

      /**
      * A reference to the Usages collection that is rendered in this view
      * @type {Usages}
      */
      usagesCollection: null,

      /**
      * Renders this view
      */
      render: function(){

        try{

          //If the "my portals" feature is disabled, exit now
          if(MetacatUI.appModel.get("showMyPortals") === false){
            return;
          }

          //Insert the template
          this.$el.html(this.template());

          if( !this.usagesCollection ){
            if( this.membership ){
              var portalQuotas = this.membership.getQuotas("portal");
              if( portalQuotas.length ){
                this.usagesCollection = portalQuotas[0].get("usages");
                if( this.usagesCollection.length == 0 ){
                  this.showEmptyList();
                  this.renderCreateButton();
                  return;
                }
              }
              //If there is no Usages collection or Membership model, there is nothing to render
              else{
                return;
              }
            }
            //If there is no Usages collection or Membership model, there is nothing to render
            else{
              return;
            }
          }

          //When the SearchResults are retrieved, merge them with the Usages collection
          this.listenToOnce(this.searchResults, "sync", function(){
            this.mergeSearchResults();

            //Update the view with info about the corresponding Usage model
            this.showUsageInfo();
          });

          if( this.usagesCollection.fetching == true ){
            //When the collection has been fetched, render the Usage list
            this.listenToOnce(this.usagesCollection, "sync", this.getSearchResultsForUsages);

            //Listen to the collection for errors
            this.listenToOnce(this.usagesCollection, "error", this.showError);
          }
          else{
            this.getSearchResultsForUsages(this.usagesCollection);
          }

        }
        catch(e){
          console.error("Failed to render the PortalUsagesView: ", e);
        }

      },

      /**
      * Using the Usages collection, this function creates Filters that search for
      * the portal objects for those Usages
      * @param {Usages} usages The Usages collection to get search results for
      */
      getSearchResultsForUsages: function(usages){


        try{

          if( !usages ){
            var usages = this.usagesCollection;
          }

          //Reject any Usages that are on nodes not enabled in the MetacatUI config
          // as an alternateRepository
          var altRepoIds = _.pluck(MetacatUI.appModel.get("alternateRepositories"), "identifier");
          var filteredUsages = usages.reject(function(usage){
            return !_.contains(altRepoIds, usage.get("nodeId"));
          });

          if( filteredUsages.length == 0 || !filteredUsages ){
            //If there are no portal usages, trigger the SearchResults as synced, since we won't be sending a search at all.
            this.searchResults.trigger("sync");
          }
          else{
            //Group the Usages by Member Node ID
            var usagesByNode = _.groupBy( filteredUsages, function(usage){ return usage.get("nodeId") });

            _.mapObject(usagesByNode, function(filteredUsages, nodeId){
              //Set the number of portals to the number of usages found
              this.numPortals = filteredUsages.length;

              //Get a list of the portal identifiers in this member node
              var portalIds = [];
              _.each(filteredUsages, function(u){ portalIds.push(u.get("instanceId")) });

              //If there are no given filters, create a Filter for the seriesId of each portal Usage
              if( !this.filters && portalIds.length ){
                this.filters = new Filters();

                this.filters.mustMatchIds = true;
                this.filters.add({
                  fields: ["seriesId"],
                  values: portalIds,
                  operator: "OR",
                  matchSubstring: false,
                  exclude: false
                });

                //Only get Portals that the user is an owner of
                //this.filters.addWritePermissionFilter();
              }
              //If the filters set on this view is an array of JSON, add it to a Filters collection
              else if( this.filters.length && !Filters.prototype.isPrototypeOf(this.filters) ){
                //Create search filters for finding the portals
                var filters = new Filters();

                filters.add( this.filters );

                this.filters = filters;
              }
              else{
                this.filters = new Filters();
              }

              this.getSearchResults({ nodeId: nodeId });
            }, this);
          }

        }
        catch(e){
          this.showError();
          console.error("Failed to create search results for the portal list: ", e);
        }

      },

      /**
      * Merges the SearchResults collection with the Usages collection
      */
      mergeSearchResults: function(searchResults){

        if(typeof searchResults == "undefined"){
          var searchResults = this.searchResults;
        }

        this.usagesCollection.mergeCollections(searchResults);

        //If in DataONE Plus Preview mode, total the portal count from Solr and use that as the portal totalUsage
        if( MetacatUI.appModel.get("dataonePlusPreviewMode") ){

          var memberships = MetacatUI.appUserModel.get("dataoneMemberships"),
              membership;

          if( memberships && memberships.length ){
            //TODO: Render a PortalListView for each membership. For now, default to the first
            membership = memberships.models[0];
            var portalQuotas = membership.getQuotas("portal");

            if( portalQuotas.length ){
              portalQuotas[0].set("totalUsage", this.usagesCollection.length);
            }
          }
        }
      },

      /**
      * Shows the Usage info for each Portal in this view
      */
      showUsageInfo: function(){

        var missingPortalObjects = 0;

        this.usagesCollection.each(function(usage){

          //Find the list item HTML element for this Usage
          var listItem = this.$("[data-seriesId='" + usage.get("instanceId") + "']");

          //If a list item is found, update it
          if( listItem.length ){

            //Disable the Edit button if the Usage status is "inactive"
            if( usage.get("status") == "inactive" ){
              listItem.find(".edit.btn")
                      .attr("disabled", "disabled")
                      .popover({
                        trigger: "hover focus click",
                        placement: "top",
                        delay: {
                          show: 800
                        },
                        html: true,
                        content: "To edit this " + MetacatUI.appModel.get("portalTermSingular") + ", contact us at " +
                                 "<a href='mailto:" + MetacatUI.appModel.get("emailContact") + "'>" +
                                 MetacatUI.appModel.get("emailContact") + "</a>" +
                                 " to activate it. It may be deactivated because your " +
                                  MetacatUI.appModel.get("dataonePlusName") + " membership has ended."
                      });
            }

          }
          else{
            if( usage.isActive() ){
              missingPortalObjects++;
            }
          }

        }, this);

        if( missingPortalObjects > 0 ){
          var missingMessage = missingPortalObjects + " " + MetacatUI.appModel.get("portalTermPlural") +
                          " have been created in your " + MetacatUI.appModel.get("dataonePlusName") +
                          " membership but we couldn't find them in a search.";

          if( this.$("tbody .loading, tbody .message").length ){
            this.$("tbody .loading, tbody .message").remove();

            var row = this.createListItem();
            row.html("<td colspan='4' class='center message'>" + missingMessage + "</td>");
            this.$(this.listContainer).html(row);

          }
          else{
            this.$el.append(missingMessage);
          }
        }

        //Add a "Create" button to create a new portal, since we know the total Usage and
        // remaining Quota now.
        this.renderCreateButton();

      },

      /**
      * @inheritdoc
      */
      renderCreateButton: function(){

        try{

          //Create a New portal buttton
          var createButton    = this.makeCreateButton(),
              canCreatePortal = true,
              portalLimit     = 0;

          if( this.membership ){
            var portalQuotas = this.membership.getQuotas("portal");

            if( portalQuotas.length ){
              canCreatePortal = portalQuotas[0].hasRemainingUsage();
              portalLimit = portalQuotas[0].get("softLimit");
            }
            else{
              canCreatePortal = false;
            }
          }
          else{
            canCreatePortal = false;
          }

          if( canCreatePortal ){

            //Add the link URL to the button
            createButton.attr("href", MetacatUI.root + "/edit/" + MetacatUI.appModel.get("portalTermPlural"))

          }
          else{
            //Disable the button
            createButton.addClass("disabled");

            var message = MetacatUI.appModel.get("portalEditNoQuotaMessage");

            if( portalLimit > 0 ){
              message += " (" + portalLimit + " " +
                         ((portalLimit > 1)? MetacatUI.appModel.get("portalTermPlural") : MetacatUI.appModel.get("portalTermSingular")) +
                         ")"
            }

            //Add the tooltip to the button
            createButton.tooltip({
              placement: "top",
              trigger: "hover click focus",
              delay: {
                show: 500
              },
              title: message
            });
          }

          //Add the create button to the view
          this.$(this.createBtnContainer).html(createButton);

        }
        catch(e){
          console.error("Couldn't render the Create Portal button: ", e);
        }


      }

    });
});
