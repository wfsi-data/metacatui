/*global define */
define(['jquery', 'underscore', 'backbone', 'clipboard',
        'collections/UserGroup',
    		'models/UserModel',
        "models/Stats",
        'views/StatsView', 'views/DataCatalogView',
        'views/GroupListView',
        'text!templates/userProfile.html',
        'text!templates/noResults.html'],
	function($, _, Backbone, Clipboard,
    UserGroup,
    UserModel, Stats,
    StatsView, DataCatalogView, GroupListView,
    userProfileTemplate,
    NoResultsTemplate) {
	'use strict';

	/**
	 * @class UserView
	 * @classdesc A major view that displays a public profile for the user and a settings page for the logged-in user
	 * to manage their account info, groups, identities, and API tokens.
	 */
	var UserView = Backbone.View.extend(
    /** @lends UserView.prototype */{

		el: '#Content',

		//Templates
		profileTemplate:  _.template(userProfileTemplate),
		noResultsTemplate: _.template(NoResultsTemplate),

		events: {

		},

		initialize: function(){
			this.subviews = new Array();
		},

		//------------------------------------------ Rendering the main parts of the view ------------------------------------------------//
		render: function (options) {
			//Don't render anything if the user profiles are turned off
			if( MetacatUI.appModel.get("enableUserProfiles") === false ){
				return;
			}

			this.stopListening();
			if(this.model) this.model.stopListening();

      //Create a Stats model
      this.statsModel = new Stats();

			this.username = (options && options.username)? options.username : undefined;

			this.$el.show();

			// set the header type
			MetacatUI.appModel.set('headerType', 'default');

			//Render the user profile only after the app user's info has been checked
			//This prevents the app from rendering the profile before the login process has completed - which would
			//cause this profile to render twice (first before the user is logged in then again after they log in)
			if(MetacatUI.appUserModel.get("checked")) this.renderUser();
			else MetacatUI.appUserModel.on("change:checked", this.renderUser, this);

			return this;
		},

		renderUser: function(){

			this.model = MetacatUI.appUserModel;

			var username = MetacatUI.appModel.get("profileUsername") || view.username,
				currentUser = MetacatUI.appUserModel.get("username") || "";

			if(username.toUpperCase() == currentUser.toUpperCase()){ //Case-insensitive matching of usernames
				this.model = MetacatUI.appUserModel;
				this.model.set("type", "user");

				//If the user is logged in, display the settings options
				if(this.model.get("loggedIn")){
					this.renderProfile();
				}
			}
			//If this isn't the currently-logged in user, then let's find out more info about this account
			else{
				//Create a UserModel with the username given
				this.model = new UserModel({
					username: username
				});

				//Is this a member node?
				if(MetacatUI.nodeModel.get("checked") && this.model.isNode()){
					this.model.saveAsNode();
					this.model.set("nodeInfo", _.find(MetacatUI.nodeModel.get("members"), function(nodeModel) {
						return nodeModel.identifier.toLowerCase() == "urn:node:" + username.toLowerCase();
					  }));
					this.forwardToPortals(username);
					return;
				}
				//If the node model hasn't been checked yet
				else if(!MetacatUI.nodeModel.get("checked")){
					var user = this.model,
						view = this;
					this.listenTo(MetacatUI.nodeModel, "change:checked", function(){
						if(user.isNode())
							view.render();
					});
				}

				//When we get the infomration about this account, then crender the profile
				this.model.once("change:checked", this.renderProfile, this);
				//Get the info
				this.model.getInfo();
			}

			//When the model is reset, refresh the page
			this.listenTo(this.model, "reset", this.render);

		},

		renderProfile: function(){

			//Insert the template first
			var profileEl = $.parseHTML(this.profileTemplate({
				type: this.model.get("type"),
				logo: this.model.get("logo") || "",
				description: this.model.get("description") || "",
				user: this.model.toJSON()
			}).trim());

			this.$el.html(profileEl);

			//If this user hasn't uploaded anything yet, display so
			this.listenTo(this.statsModel, "change:totalCount", function(){
				if(!this.statsModel.get("totalCount"))
					this.noActivity();
			});

			//Insert the user data statistics
			this.insertStats();

			//Insert the user's basic information
			this.listenTo(this.model, "change:fullName", this.insertUserInfo);
			this.insertUserInfo();

			var view = this;
			//Listen to changes in the user's search terms
			this.listenTo(this.model, "change:searchModel", this.renderProfile);

			//Insert this user's data content
			this.insertContent();

			//List the groups this user is in
			if(this.model.get("type") == "group"){

        this.$el.addClass("group-profile");

				//Create the User Group collection
				var options = {
					name: this.model.get("fullName"),
					groupId: this.model.get("username"),
					rawData: this.model.get("rawData") || null
					}
				var userGroup = new UserGroup([], options);

				//Create the group list and add it to the page
				var viewOptions = { collapsable: false, showGroupName: false }
				var groupList = this.createGroupList(userGroup, viewOptions);
				this.$("#user-membership-container").html(groupList);
			}
			else{
				this.insertMembership();
			}
		},

    /**
     * Update the window location path to route to /portals path
     * @param {string} username - Short identifier for the member node
    */
    forwardToPortals: function(username){

      var pathName      = decodeURIComponent(window.location.pathname)
                .substring(MetacatUI.root.length)
                // remove trailing forward slash if one exists in path
                .replace(/\/$/, "");

      // Routes the /profile/{node-id} to /portals/{node-id}
      var pathRE = new RegExp("\\/profile(\\/[^\\/]*)?$", "i");
      var newPathName = pathName.replace(pathRE, "") + "/" +
              MetacatUI.appModel.get("portalTermPlural") + "/" + username;

      // Update the window location
      MetacatUI.uiRouter.navigate( newPathName, { trigger: true, replace: true } );
      return;
    },

		//------------------------------------------ Inserting public profile UI elements ------------------------------------------------//
		insertStats: function(){
			if(this.model.noActivity && this.statsView){
				this.statsView.$el.addClass("no-activity");
				this.$("#total-download-wrapper, section.downloads").hide();
				return;
			}

			var username = this.model.get("username"),
				view = this;

			this.listenToOnce(this.statsModel, "change:totalCount", function(){
				view.$("#total-upload-container").text(MetacatUI.appView.commaSeparateNumber(view.statsModel.get("totalCount")));
			});

			//Create a base query for the statistics
			var statsSearchModel = this.model.get("searchModel").clone();
			statsSearchModel.set("exclude", [], {silent: true}).set("formatType", [], {silent: true});
			this.statsModel.set("query", statsSearchModel.getQuery());
      this.statsModel.set("isSystemMetadataQuery", true);
			this.statsModel.set("searchModel", statsSearchModel);

			//Create the description for this profile
			var description;

			switch(this.model.get("type")){
				case "node":
					description = "A summary of all datasets from the " + this.model.get("fullName") + " repository";
					break;
				case "group":
					description = "A summary of all datasets from the " + this.model.get("fullName") + " group";
					break;
				case "user":
					description = "A summary of all datasets from " + this.model.get("fullName");
					break;
				default:
					description = "";
					break;
			}

			//Render the Stats View for this person
			this.statsView = new StatsView({
				title: "Statistics and Figures",
				description: description,
				userType: "user",
				el: this.$("#user-stats"),
				model: this.statsModel
			});
			this.subviews.push(this.statsView);
			this.statsView.render();

      //Remove the replicas stat for non-node profiles
      if( this.model.get("type") !== "node" ){
        this.statsView.$("#replicas-container").remove();
      }

			if(this.model.noActivity)
				this.statsView.$el.addClass("no-activity");

		},

		/*
		 * Insert the name of the user
		 */
		insertUserInfo: function(){

			//Don't try to insert anything if we haven't gotten all the user info yet
			if(!this.model.get("fullName")) return;

			//Insert the name into this page
			var usernameLink = $(document.createElement("a")).attr("href", MetacatUI.root + "/profile/" + this.model.get("username")).text(this.model.get("fullName"));
			this.$(".insert-fullname").append(usernameLink);

			//Insert the username
			if(this.model.get("type") != "node"){
				if(!this.model.get("usernameReadable")) this.model.createReadableUsername();
				this.$(".insert-username").text(this.model.get("usernameReadable"));
			}
			else{
				$("#username-wrapper").hide();
			}

			//Show or hide ORCID logo
			if(this.model.isOrcid())
				this.$(".show-orcid").show();
			else
				this.$(".show-orcid").hide();

			//Show the email
			if(this.model.get("email")){
				this.$(".email-wrapper").show();
				var parts = this.model.get("email").split("@");
				this.$(".email-container").attr("data-user", parts[0]);
				this.$(".email-container").attr("data-domain", parts[1]);
			}
			else
				this.$(".email-wrapper").hide();

		},

		/** Creates an HTML element to display in front of the user identity/subject.
		* Only used for the ORCID logo right now
    */
		createIdPrefix: function(){
			if(this.model.isOrcid())
				return $(document.createElement("img")).attr("src", MetacatUI.root + "/img/orcid_64x64.png").addClass("orcid-logo");
			else
				return "";
		},

		/*
		 * Insert a list of this user's content
		 */
		insertContent: function(){
			if(this.model.noActivity){
				this.$("#data-list").html(this.noResultsTemplate({
					fullName: this.model.get("fullName"),
					username: ((this.model == MetacatUI.appUserModel) && MetacatUI.appUserModel.get("loggedIn"))? this.model.get("username") : null
				}));
				return;
			}

			var view = new DataCatalogView({
				el            : this.$("#data-list")[0],
				searchModel   : this.model.get("searchModel"),
				searchResults : this.model.get("searchResults"),
				mode          : "list",
				isSubView     : true,
				filters       : false
			});
			this.subviews.push(view);
			view.render();
			view.$el.addClass("list-only");
			view.$(".auto-height").removeClass("auto-height").css("height", "auto");
			$("#metacatui-app").removeClass("DataCatalog mapMode");
		},

		/*
		 * Inserts a list of groups this user is a member of
		 */
		insertMembership: function(){
			var groups = _.sortBy(this.model.get("isMemberOf"), "name");
			if(!groups.length){
				this.$("#user-membership-header").hide();
				return;
			}

			var	model  = this.model,
				list   = $(document.createElement("ul")).addClass("list-group member-list"),
				listHeader = $(document.createElement("h5")).addClass("list-group-item list-group-header").text("Member of " + groups.length + " groups"),
				listContainer = this.$("#user-membership-container");

			_.each(groups, function(group, i){
				var name = group.name || "Group",
					listItem = $(document.createElement("li")).addClass("list-group-item"),
					groupLink = group.groupId? $(document.createElement("a")).attr("href", MetacatUI.root + "/profile/" + group.groupId).text(name).appendTo(listItem) : "<a></a>";

				$(list).append(listItem);
			});

			if(this.model.get("username") == MetacatUI.appUserModel.get("username")){
				var link = $(document.createElement("a")).attr("href", MetacatUI.root + "/my-settings/groups").text("Create New Group"),
					icon = $(document.createElement("i")).addClass("icon icon-on-left icon-plus"),
					listItem = $(document.createElement("li")).addClass("list-group-item create-group").append( $(link).prepend(icon) );

				$(list).append(listItem);
			}

			listContainer.html(list);
			list.before(listHeader);
		},

		/*
		 * When this user has not uploaded any content, render the profile differently
		 */
		noActivity: function(){
			this.model.noActivity = true;
			this.insertContent();
			this.insertStats();
		},

		//-------------------------------------------------------------- Groups -------------------------------------------------------//


		/*
		 * Inserts a GroupListView for the given UserGroup collection
		 */
		createGroupList: function(userGroup, options){

      try{
  			//Only create a list for new groups that aren't yet on the page
  			var existingGroupLists = _.where(this.subviews, {type: "GroupListView"});
  			if(existingGroupLists)
  				var groupIds = _.pluck(existingGroupLists, "groupId");
  			if(groupIds && (_.contains(groupIds, userGroup.groupId)))
  				return;

  			//Create a list of the view options
  			if(typeof options == "object")
  				options.collection = userGroup;
  			else
  				var options = { collection: userGroup };

  			//Create the view and save it as a subview
  			var groupView = new GroupListView(options);
  			this.subviews.push(groupView);

  			//Collapse the views if need be
  			if((this.model.get("isMemberOf") && (this.model.get("isMemberOf").length > 3)) || (userGroup.length > 3))
  				groupView.collapseMemberList();

        groupView.render();

        //Update the group name when it's updated in the GroupListView
        this.listenTo(userGroup, "sync", function(){
          this.$(".insert-fullname").text( userGroup.name );
        });

  			//Finally, render it and return
  			return groupView.el;
      }
      catch(e){
        console.error("Failed to render Group List: ", e);
      }
		},

		//---------------------------------- Misc. and Utilities -----------------------------------------//

		onClose: function () {
			//Clear the template
			this.$el.html("");

      //Reset the model
      if( this.model ){
			  this.model.noActivity = null;
        this.stopListening(this.model);
      }

			//Stop listening to changes in models
			this.stopListening(this.statsModel);
			this.stopListening(MetacatUI.appUserModel);

			//Close the subviews
			_.each(this.subviews, function(view){
				view.onClose();
			});
			this.subviews = new Array();
		}

	});

	return UserView;
});
