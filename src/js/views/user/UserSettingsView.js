/*global define */
define(['jquery', 'underscore', 'backbone', 'clipboard',
        'collections/UserGroup',
        'views/GroupListView',
        'text!templates/loading.html', 'text!templates/userSettings.html'],
  function($, _, Backbone, Clipboard,
           UserGroup,
           GroupListView,
           LoadingTemplate, SettingsTemplate) {
  'use strict';

  /**
   * @class UserSettingsView
   * @classdesc A major view that displays the settings for a User's repository/DataONE account.
   */
  var UserSettingsView = Backbone.View.extend(
    /** @lends UserSettingsView.prototype */{

    /**
    * A reference to the User model used for this view
    * @type {User}
    */
    model: MetacatUI.appUserModel,

    /**
    * TThe name of the view section currently displayed
    * @type {string}
    */
    activeSection: "",

    /**
    * An array of other views that are contained within this view
    * @type {Backbone.View[]}
    */
    subviews: [],

    /**
    * A UserGroup collection that is currently being created
    * @type {UserGroup}
    */
    pendingGroup: null,

    /**
    * The view elementt
    */
    el: '#Content',

    /**
    * The template that displays all the user settings
    * @type {UnderscoreTemplate}
    */
    settingsTemplate: _.template(SettingsTemplate),
    /**
    * The template that displays a loading message
    * @type {UnderscoreTemplate}
    */
    loadingTemplate:  _.template(LoadingTemplate),

    /**
    * A jQuery selector for the element that the PortalListView should be inserted into
    * @type {string}
    */
    portalListContainer: ".my-portals-container",

    /**
    * A jQuery selector for the element that the DataONE Plus info should be inserted into
    * @type {string}
    */
    dataonePlusContainer: ".dataoneplus-container",

    /**
    * The DOM events and their listeners
    * @type {object}
    */
    events: {
      "click .section-link" : "switchToSection",
      "click .token-tab" : "switchTabs",
      "click .token-generator" : "getToken",
      "click #mod-save-btn" : "saveUser",
      "click #map-request-btn" : "sendMapRequest",
      "click .remove-identity-btn" : "removeMap",
      "click .confirm-request-btn" : "confirmMapRequest",
      "click .reject-request-btn" : "rejectMapRequest"
    },

    /**
    * Starts the rendering process, but waits for the user authentication to be verified first
    * @param {object} [options]
    * @property {string} options.section The section name to display
    */
    render: function(options){

      //Don't render anything if the user profile settings are turned off
      if( MetacatUI.appModel.get("enableUserProfileSettings") === false ){
        return;
      }

      if( typeof options == "undefined" ){
        var options = {};
      }

      // set the header type
      MetacatUI.appModel.set('headerType', 'default');

      //Stop listening to anything so listeners are not set twice
      this.stopListening();

      //Set the active section
      this.activeSection = (options && options.section)? options.section : "";

      //Render the user settings only after the app user's info has been checked
      //This prevents the app from rendering the settings before the login process has completed - which would
      //cause this view to render twice (first before the user is logged in then again after they log in)
      if( this.model.get("checked") ){
        this.renderSettings();
      }
      else{
        this.model.on("change:checked", this.renderSettings, this);
      }

      return this;
    },

    /**
    * Renders all of the User settings
    */
    renderSettings: function(){

      //If the user is not logged in, show a SignInView
      if( !this.model.get("loggedIn") ){
        this.renderSignIn();
        return;
      }

      //Insert the template first
      this.$el.html(this.settingsTemplate( Object.assign(this.model.toJSON(), {
        portalsSectionLinkText: MetacatUI.appModel.get("portalTermPlural").charAt(0).toUpperCase() + MetacatUI.appModel.get("portalTermPlural").slice(1)
      })));

      //Reset the sections and go to the active section
      this.switchToSection(null, this.activeSection);

      //Draw the group list
      this.listenTo(this.model, "change:isMemberOf", this.renderGroupViews);
      this.renderGroupViews();
      this.insertCreateGroupForm();

      //Listen for the identity list
      this.listenTo(this.model, "change:identities", this.insertIdentityList);
      this.insertIdentityList();

      //Listen for the pending list
      this.listenTo(this.model, "change:pending", this.insertPendingList);
      this.model.getPendingIdentities();

      //Render the portals section
      this.renderMyPortals();

      //Listen for updates to person details
      this.listenTo(this.model, "change:lastName change:firstName change:email change:registered", this.updateModForm);
      this.updateModForm();

      // init autocomplete fields
      this.setUpAutocomplete();

      //Get the token right away
      this.getToken();

    },

    /**
    * Renders the SignInView and inserts it into this view
    */
    renderSignIn: function(){
      this.$el.html("<div class='center'><h2>Login to access your account settings</h2></div>");

      var thisView = this;

      require(["views/SignInView"], function(SignInView){
        var signInView = new SignInView();
        thisView.$(".center").append(signInView.el);
        signInView.render();
      });
    },

    /**
    * Switches to the given section of this view. The new active section is determined by either a DOM Event or a section name.
    * @type {Event} [e] - The DOM Event that brought the user here
    * @type {string} [sectionName] - The name of the section to switch to.
    */
    switchToSection: function(e, sectionName){
      if(e){
        e.preventDefault();
        var sectionName = $(e.target).attr("data-section");
        if( !sectionName ){
          sectionName = $(e.target).parents("[data-section]").first().attr("data-section");
        }
      }

      if( !sectionName ){
        return;
      }

      //Mark its links as active
      this.$(".section-link.active").removeClass("active");
      this.$(".section-link[data-section='" + sectionName + "']").addClass("active");

      //Hide all the other sections
      this.$(".section").hide();
      this.$(".section[data-section='" + sectionName + "']").show();

      //Update the URL
      MetacatUI.uiRouter.navigate("/my-settings/" + sectionName);
    },

    /**
     * Gets the groups that this user is a part of and creates a UserGroup collection for each
     */
    renderGroupViews: function(){

      //Create a group Collection for each group this user is a member of
      _.each(_.sortBy(this.model.get("isMemberOf"), "name"), function(group){

        var userGroup = new UserGroup([this.model], group);

        this.renderGroupView(userGroup);

      }, this);
    },

    /**
     * Inserts a GroupListView for the given UserGroup collection
     * @param {UserGroup} userGroup The UserGroup collection to display
     */
    renderGroupView: function(userGroup){

      if( !userGroup ){
        return;
      }

      //Only create a list for new groups that aren't yet on the page
      var existingGroupLists = _.where(this.subviews, {type: "GroupListView"});
      if(existingGroupLists)
        var groupIds = _.pluck(existingGroupLists, "groupId");
      if(groupIds && (_.contains(groupIds, userGroup.groupId)))
        return;

      //Create the view and save it as a subview
      var groupView = new GroupListView({ collection: userGroup });

      //Save the view as a subview
      this.subviews.push(groupView);

      //Add the view element to the page
      this.$("#group-list-container").append(groupView.el);

      //Render the view
      groupView.render();

      //Collapse the views if need be
      if((this.model.get("isMemberOf") && (this.model.get("isMemberOf").length > 3)) || (userGroup.length > 3))
        groupView.collapseMemberList();

    },

    /**
     * Inserts a new form for this user to create a new group.
     */
    insertCreateGroupForm: function(){

      //Create a pending group that is stored locally until the user submits it
      this.pendingGroup = new UserGroup([this.model], { pending: true });
      this.groupView = new GroupListView({ collection: this.pendingGroup });

      //Add the view to the page
      this.$("#add-group-container").html(this.groupView.el);
      this.groupView.render();

      //When the group is saved, refresh the group list
      this.listenToOnce( this.pendingGroup, "sync", this.refreshGroupList );
    },

    /**
     * Will send a request for info about this user and their groups, and redraw the group lists
     * Will reset the Create New group form, too
     */
    refreshGroupList: function(){

      //Move the newly-saved group to the list
      this.groupView.$el.detach();
      this.$("#group-list-container").prepend(this.groupView.el);

      this.$("#add-group-container").slideUp();

      this.insertCreateGroupForm();

    },

    //------------------------------------------------ Identities/Accounts -------------------------------------------------------//
    /**
     * Sends a new identity map request and displays notifications about the result
     * @param {Event} e - The DOM Event that brought the user here
     */
    sendMapRequest: function(e) {
      e.preventDefault();

      //Get the identity entered into the input
      var equivalentIdentity = this.$("#map-request-field").val();
      if (!equivalentIdentity || equivalentIdentity.length < 1) {
        return;
      }
      //Clear the text input
      this.$("#map-request-field").val("");

      //Show notifications after the identity map request is a success or failure
      var viewRef = this,
        success = function(){
          var message = "An account map request has been sent to <a href=" + MetacatUI.root + "'/profile/" + equivalentIdentity + "'>" + equivalentIdentity + "</a>" +
            "<h4>Next step:</h4><p>Sign In with this other account and approve this request.</p>"

          MetacatUI.appView.showAlert({
            message: message,
            container: "#request-alert-container"
          });
        },
        error = function(xhr){
          var errorMessage = xhr.responseText;

          if( xhr.responseText.indexOf("Request already issued") > -1 ){
            MetacatUI.appView.showAlert({
              message: "<p>You have already sent a request to map this account to " + equivalentIdentity +
              ".</p> <h4>Next Step:</h4><p> Sign In with your " + equivalentIdentity + " account and approve the request.</p>",
              classes: "alert-info",
              container: "#request-alert-container"
            });
          }
          else{

            //Make a more understandable error message when the account isn't found
            if(xhr.responseText.indexOf("LDAP: error code 32 - No Such Object") > -1){
              xhr.responseText = "The username " + equivalentIdentity + " does not exist in our system."
            }

            MetacatUI.appView.showAlert({
              message: xhr.responseText,
              classes: 'alert-error',
              container: "#request-alert-container"
            });
          }
        };

      //Send it
      this.model.addMap(equivalentIdentity, success, error);
    },

    /**
     * Removes a confirmed identity map request and displays notifications about the result
     * @param {Event} e - The DOM Event that brought the user here
     */
    removeMap: function(e) {
      e.preventDefault();

      var equivalentIdentity = $(e.target).parents("a").attr("data-identity");
      if(!equivalentIdentity) return;

      var viewRef = this,
        success = function(){
          MetacatUI.appView.showAlert({
            message: "Success! Your account is no longer associated with the user " + equivalentIdentity,
            classes: "alert-success",
            container: "#identity-alert-container"
          });
        },
        error = function(xhr, textStatus, error){
          MetacatUI.appView.showAlert({
            message: "Something went wrong: " + xhr.responseText,
            classes: "alert-error",
            container: "#identity-alert-container"
          });
        };

      this.model.removeMap(equivalentIdentity, success, error);
    },

    /**
     * Confirms an identity map request that was initiated from another user, and displays notifications about the result
     * @param {Event} e - The DOM Event that brought the user here
     */
    confirmMapRequest: function(e) {
      var model = this.model;

      e.preventDefault();
      var otherUsername = $(e.target).parents("a").attr("data-identity"),
        mapRequestEl = $(e.target).parents(".pending.identity");

      var viewRef = this;

      var success = function(data, textStatus, xhr) {
        MetacatUI.appView.showAlert({
          message: "Success! Your account is now linked with the username " + otherUsername,
          classes: "alert-success",
          container: "#pending-alert-container"
        });

        mapRequestEl.remove();
      }
      var error = function(xhr, textStatus, error) {
        MetacatUI.appView.showAlert({
          message: xhr.responseText,
          classes: "alert-error",
          container: "#pending-alert-container"
        });
      }

      //Confirm this map request
      this.model.confirmMapRequest(otherUsername, success, error);
    },

    /**
     * Rejects an identity map request that was initiated by another user, and displays notifications about the result
     * @param {Event} e - The DOM Event that brought the user here
     */
    rejectMapRequest: function(e) {
      e.preventDefault();

      var equivalentIdentity = $(e.target).parents("a").attr("data-identity"),
        mapRequestEl = $(e.target).parents(".pending.identity");

      if(!equivalentIdentity) return;

      var viewRef = this,
        success = function(data){
          MetacatUI.appView.showAlert({
            message: "Removed mapping request for " + equivalentIdentity,
            classes: "alert-success",
            container: "#pending-alert-container"
          });
          $(mapRequestEl).remove();
        },
        error = function(xhr, textStatus, error){
          MetacatUI.appView.showAlert({
            message: xhr.responseText,
            classes: "alert-error",
            container: "#pending-alert-container"
          });
        };

      this.model.denyMapRequest(equivalentIdentity, success, error);
    },

    /**
    * Inserts a list of other identities that are associated with this user
    */
    insertIdentityList: function(){
      var identities = this.model.get("identities");

      //Remove the equivalentIdentities list if it was drawn already so we don't do it twice
      this.$("#identity-list-container").empty();

      if(!identities) return;

      //Create the list element
      if(identities.length < 1){
        var identityList = $(document.createElement("p")).text("You haven't linked to another account yet. Send a request below.");
      }
      else
        var identityList = $(document.createElement("ul")).addClass("list-identity").attr("id", "identity-list");

      var view = this;
      //Create a list item for each identity
      _.each(identities, function(identity, i){
        var listItem = view.createUserListItem(identity, { confirmed: true });

        //When/if the info from the equivalent identities is retrieved, update the item
        view.listenToOnce(identity, "change:fullName", function(identity){
          var newListItem = view.createUserListItem(identity, {confirmed: true});
          listItem.replaceWith(newListItem);
        });

        $(identityList).append(listItem);
      });

      //Add to the page
      //$(identityList).find(".collapsed").hide();
      this.$("#identity-list-container").append(identityList);
    },

    /**
    * Inserts a list of identities for this user that are currently pending
    */
    insertPendingList: function(){
      var pending = this.model.get("pending");

      //Remove the equivalentIdentities list if it was drawn already so we don't do it twice
      this.$("#pending-list-container").empty();

      //Create the list element
      if (pending.length < 1){
        this.$("[data-subsection='pending-accounts']").hide();
        return;
      }
      else{
        this.$("[data-subsection='pending-accounts']").show();
        this.$("#pending-list-container").prepend($(document.createElement("p")).text("You have " + pending.length + " new request to map accounts. If these requests are from you, accept them below. If you do not recognize a username, reject the request."));
        var pendingList = $(document.createElement("ul")).addClass("list-identity").attr("id", "pending-list");
        var pendingCount = $(document.createElement("span")).addClass("badge").attr("id", "pending-count").text(pending.length);
        this.$("#pending-list-heading").append(pendingCount);
      }

      //Create a list item for each pending id
      var view = this;
      _.each(pending, function(pendingUser, i){
        var listItem = view.createUserListItem(pendingUser, {pending: true});
        $(pendingList).append(listItem);

        if(pendingUser.isOrcid()){
          view.listenToOnce(pendingUser, "change:fullName", function(pendingUser){
            var newListItem = view.createUserListItem(pendingUser, {pending: true});
            listItem.replaceWith(newListItem);
          });
        }
      });

      //Add to the page
      this.$("#pending-list-container").append(pendingList);
    },

    /**
    * Creates a list of other identities that are associated with this User
    * @param {User} user - The User model to display
    * @param {object} [options] - Additional options for this function
    * @property {boolean} options.pending If true, this identity map request is still pending
    * @property {boolean} options.confirmed If true, this identity map request is confirmed already
    */
    createUserListItem: function(user, options){
      var pending = false,
        confirmed = false;

      if(options && options.pending)
        pending = true;
      if(options && options.confirmed)
        confirmed = true;

      var username = user.get("username"),
          fullName = user.get("fullName") || username;

      var listItem = $(document.createElement("li")).addClass("list-group-item identity"),
        link     = $(document.createElement("a")).attr("href", MetacatUI.root + "/profile/" + username).attr("data-identity", username).text(fullName),
        details  = $(document.createElement("span")).addClass("subtle details").text(username);

      listItem.append(link, details);

      if(pending){
        var acceptIcon = $(document.createElement("i")).addClass("icon icon-ok icon-large icon-positive tooltip-this").attr("data-title", "Accept Request").attr("data-trigger", "hover").attr("data-placement", "top"),
          rejectIcon = $(document.createElement("i")).addClass("icon icon-remove icon-large icon-negative tooltip-this").attr("data-title", "Reject Request").attr("data-trigger", "hover").attr("data-placement", "top"),
          confirm = $(document.createElement("a")).attr("href", "#").addClass('confirm-request-btn').attr("data-identity", username).append(acceptIcon),
          reject = $(document.createElement("a")).attr("href", "#").addClass("reject-request-btn").attr("data-identity", username).append(rejectIcon);

        listItem.prepend(confirm, reject).addClass("pending");
      }
      else if(confirmed){
        var removeIcon = $(document.createElement("i")).addClass("icon icon-remove icon-large icon-negative"),
          remove = $(document.createElement("a")).attr("href", "#").addClass("remove-identity-btn").attr("data-identity", username).append(removeIcon);
        $(remove).tooltip({
          trigger: "hover",
          placement: "top",
          title: "Remove equivalent account"
        });
        listItem.prepend(remove.append(removeIcon));
      }

      if(user.isOrcid()){
        details.prepend(this.createIdPrefix(), " ORCID: ");
      }
      else
        details.prepend(" Username: ");

      return listItem;
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

    /**
    * Updates the form for the basic user account info
    */
    updateModForm: function() {
      this.$("#mod-givenName").val(this.model.get("firstName"));
      this.$("#mod-familyName").val(this.model.get("lastName"));
      this.$("#mod-email").val(this.model.get("email"));

      if(!this.model.get("email")){
        this.$("#mod-email").parent(".form-group").addClass("has-warning");
        this.$("#mod-email").parent(".form-group").find(".help-block").text("Please provide an email address.");
      }
      else{
        this.$("#mod-email").parent(".form-group").removeClass("has-warning");
        this.$("#mod-email").parent(".form-group").find(".help-block").text("");
      }

      if (this.model.get("registered")) {
        this.$("#registered-user-container").show();
      } else {
        this.$("#registered-user-container").hide();
      }

      this.$("#mod-username").text( this.model.get("username") );
    },

    /**
     * Gets the user account settings, updates the UserModel and saves this new info to the server
     * @param {Event} e - The DOM Event that brought the user here
     */
    saveUser: function(e) {

      e.preventDefault();

      var view = this,
        container = this.$('[data-subsection="edit-account"] .content') || $(e.target).parent();

      var success = function(data){
        $(container).find(".loading").detach();
        $(container).children().show();

        MetacatUI.appView.showAlert({
          message: "Success! Your profile has been updated.",
          classes: "alert-success",
          container: container,
          delay: 3000
        });
      }
      var error = function(data){
        $(container).find(".loading").detach();
        $(container).children().show();
        var msg = (data && data.responseText) ? data.responseText : "Sorry, updating your profile failed. Please try again.";

        if(!data.responseText){
          MetacatUI.appView.showAlert({
            message: msg,
            classes: "alert-error",
            container: container
          });
        }
      }

      //Get info entered into form
      var givenName = this.$("#mod-givenName").val();
      var familyName = this.$("#mod-familyName").val();
      var email = this.$("#mod-email").val();

      //Update the model
      this.model.set("firstName", givenName);
      this.model.set("lastName", familyName);
      this.model.set("email", email);

      //Loading icon
      $(container).children().hide();
      $(container).prepend(this.loadingTemplate());

      //Send the update
      this.model.update(success, error);

    },

    //---------------------------------- Token -----------------------------------------//
    /**
    * Gets a new auth token for this User
    */
    getToken: function(){
      var model = this.model;

      //Show loading sign
      this.$("#token-generator-container").html(this.loadingTemplate());

      //When the token is retrieved, then show it
      this.listenToOnce(this.model, "change:token", this.showToken);

      //Get the token from the CN
      this.model.getToken(function(data, textStatus, xhr){
        model.getTokenExpiration();
        model.set("token", data);
        model.trigger("change:token");
      });
    },

    /**
    * Shows the authentication token
    */
    showToken: function(){
      var token = this.model.get("token");

      if(!token || !this.model.get("loggedIn"))
        return;

      var expires    = this.model.get("expires"),
        rTokenName = (MetacatUI.appModel.get("d1CNBaseUrl").indexOf("cn.dataone.org") > -1)? "dataone_token" : "dataone_test_token",
        rToken = 'options(' + rTokenName +' = "' + token + '")',
        matlabToken = "import org.dataone.client.run.RunManager; mgr = RunManager.getInstance(); mgr.configuration.authentication_token = '" + token + "';",
        tokenInput = $(document.createElement("textarea")).attr("type", "text").attr("rows", "5").addClass("token copy").text(token),
        copyButton = $(document.createElement("a")).addClass("btn btn-primary copy").text("Copy").attr("data-clipboard-text", token),
        copyRButton = $(document.createElement("a")).addClass("btn btn-primary copy").text("Copy").attr("data-clipboard-text", rToken),
        copyMatlabButton = $(document.createElement("a")).addClass("btn btn-primary copy").text("Copy").attr("data-clipboard-text", matlabToken),
        successIcon = $(document.createElement("i")).addClass("icon icon-ok"),
        copySuccess = $(document.createElement("div")).addClass("notification success copy-success hidden").append(successIcon, " Copied!"),
        expirationMsg = expires? "<strong>Note:</strong> Your authentication token expires on " + expires.toLocaleDateString() + " at " + expires.toLocaleTimeString() : "",
        usernameMsg = "<div class='footnote'>Your user identity is  ",
        usernamePrefix = this.createIdPrefix(),
        tabs = $(document.createElement("ul")).addClass("nav nav-tabs")
            .append($(document.createElement("li")).addClass("active")
                .append( $(document.createElement("a")).attr("href", "#token-code-panel").addClass("token-tab").text("Token") ))
            .append($(document.createElement("li"))
                .append( $(document.createElement("a")).attr("href", "#r-token-code-panel").addClass("token-tab").text("Token for DataONE R") ))
            .append($(document.createElement("li"))
                .append( $(document.createElement("a")).attr("href", "#matlab-token-code-panel").addClass("token-tab").text("Token for Matlab DataONE Toolbox") )),
        tokenRInput = $(document.createElement("textarea")).attr("type", "text").attr("rows", "5").addClass("token copy").text(rToken),
        tokenRText = $(document.createElement("p")).text("Copy this code snippet to use your token with the DataONE R package."),
        tokenMatlabInput = $(document.createElement("textarea")).attr("type", "text").attr("rows", "5").addClass("token copy").text(matlabToken),
        tokenMatlabText = $(document.createElement("p")).text("Copy this code snippet to use your token with the Matlab DataONE toolbox."),
        tokenInputContain = $(document.createElement("div")).attr("id", "token-code-panel").addClass("tab-panel active").append(tokenInput, copyButton, copySuccess),
        rTokenInputContain = $(document.createElement("div")).attr("id", "r-token-code-panel").addClass("tab-panel").append(tokenRText,   tokenRInput, copyRButton, copySuccess.clone()).addClass("hidden"),
        matlabTokenInputContain = $(document.createElement("div")).attr("id", "matlab-token-code-panel").addClass("tab-panel").append(tokenMatlabText,   tokenMatlabInput, copyMatlabButton, copySuccess.clone()).addClass("hidden");

      if(typeof usernamePrefix == "object")
        usernameMsg += usernamePrefix[0].outerHTML;
      else if(typeof usernamePrefix == "string")
        usernameMsg += usernamePrefix;

      usernameMsg += this.model.get("username") + "</div>";

      this.$("#token-generator-container").empty().append(tabs, tokenInputContain, rTokenInputContain, matlabTokenInputContain);

      MetacatUI.appView.showAlert({
        message: 'Copy your authentication token below. <br/> ' + expirationMsg + usernameMsg,
        classes: "alert-info",
        containerClasses: "well",
        container: this.$("#token-generator-container")
      });

      $(".token-tab").tab();

      //Create clickable "Copy" buttons to copy text (e.g. token) to the user's clipboard
      var clipboard = new Clipboard(".copy");

        clipboard.on("success", function(e){
        $(".copy-success").show().delay(3000).fadeOut();
        });

        clipboard.on("error", function(e){
          var textarea = $(e.trigger).parent().children("textarea.token");
          textarea.trigger("focus");
          textarea.tooltip({
            title: "Press Ctrl+c to copy",
            placement: "bottom"
          });
          textarea.tooltip("show");

        });
    },

    /**
    * Sets up the autocompletes for the user lookups in this view
    */
    setUpAutocomplete: function() {
      var input = this.$(".account-autocomplete");
      if(!input || !input.length) return;

      // look up registered identities
      $(input).hoverAutocomplete({
        source: function (request, response) {
                var term = $.ui.autocomplete.escapeRegex(request.term);

                var list = [];

                //Ids/Usernames that we want to ignore in the autocompelte
                var ignoreEquivIds = ($(this.element).attr("id") == "map-request-field"),
                  ignoreIds = ignoreEquivIds? MetacatUI.appUserModel.get("identitiesUsernames") : [];
                ignoreIds.push(MetacatUI.appUserModel.get("username").toLowerCase());

                var url = MetacatUI.appModel.get("accountsUrl") + "?query=" + encodeURIComponent(term);
          var requestSettings = {
            url: url,
            success: function(data, textStatus, xhr) {
              _.each($(data).find("person"), function(person, i){
                var item = {};
                item.value = $(person).find("subject").text();

                //Don't display yourself in the autocomplete dropdown (prevents users from adding themselves as an equivalent identity or group member)
                //Also don't display your equivalent identities in the autocomplete
                if(_.contains(ignoreIds, item.value.toLowerCase())) return;

                item.label = $(person).find("fullName").text() || ($(person).find("givenName").text() + " " + $(person).find("familyName").text());
                list.push(item);
              });

                    response(list);

            }
          }
          $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

          //Send an ORCID search when the search string gets long enough
          if(request.term.length > 3)
            MetacatUI.appLookupModel.orcidSearch(request, response, false, ignoreIds);
            },
        select: function(e, ui) {
          e.preventDefault();

          // set the text field
          $(e.target).val(ui.item.value);
          $(e.target).parents("form").find("input[name='fullName']").val(ui.item.label);
        },
        position: {
          my: "left top",
          at: "left bottom",
          collision: "none"
        }
      });

    },

    /**
    * Renders a list of portals that this user is an owner of.
    */
    renderMyPortals: function(){

      //If my portals has been disabled, don't render the list
      if( MetacatUI.appModel.get("showMyPortals") === false ){
        return;
      }

      var view = this;

      //If Bookkeeper services are enabled, render the Portals via a OrdersView,
      // which queries the DataONE Bookkeeper for portals in a Order
      if( MetacatUI.appModel.get("enableBookkeeperServices") ){

        this.$(this.dataonePlusContainer).html(this.loadingTemplate({
          msg: "Getting your " + MetacatUI.appModel.get("dataonePlusName") + " " + MetacatUI.appModel.get("dataonePlusGeneralName") + "s"
        }));

        //Render a OrdersView to show the user their DataONE Services Orders
        require(['views/bookkeeper/OrdersView'], function(OrdersView){

          var ordersView = new OrdersView();

          view.$(view.dataonePlusContainer)
              .html(ordersView.el);

          ordersView.orders = MetacatUI.appUserModel.get("dataoneOrders");

          ordersView.render();

        });
      }
      //If Bookkeeper services are disabled, render the Portals via a PortalListView,
      // which queries Solr for portal docs
      else{
        require(['views/portals/PortalListView'], function(PortalListView){
          //Create a PortalListView
          var portalListView = new PortalListView();
          //Render the Portal list view and insert it in the page
          portalListView.render();
          view.$(view.portalListContainer)
              .html(portalListView.el);
        });
      }

    },

    /**
    * Switches tabs
    * @param {Event} e - The DOM Event that brought the user here
    */
    switchTabs: function(e){
      e.preventDefault();

      $(e.target).tab('show');

      this.$(".tab-panel").hide();
      this.$(".tab-panel" + $(e.target).attr("href")).show();

    },

    /**
    * Closes this view and cleans up any data saved on this view
    */
    onClose: function () {
      //Clear the template
      this.$el.html("");

      //Reset the active section
      this.activeSection = "";

      //Reset the model
      this.stopListening(this.model);

      //Close the subviews
      _.each(this.subviews, function(view){
        view.onClose();
      });
      this.subviews = new Array();
    }

  });

  return UserSettingsView;
});
