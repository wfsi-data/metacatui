"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @class UIRouter
   * @classdesc MetacatUI Router
   * @classcategory Router
   * @extends Backbone.Router
   * @constructor
   */
  var UIRouter = Backbone.Router.extend(
    /** @lends UIRouter.prototype */ {
      routes: {
        "": "renderIndex", // the default route
        "about(/:anchorId)(/)": "renderAbout", // about page
        "help(/:page)(/:anchorId)(/)": "renderHelp",
        "tools(/:anchorId)(/)": "renderTools", // tools page
        "data/my-data(/page/:page)(/)": "renderMyData", // data search page
        "data(/mode=:mode)(/query=:query)(/page/:page)(/)": "renderData", // data search page
        "data/my-data(/)": "renderMyData",
        "profile(/*username)(/s=:section)(/s=:subsection)(/)": "renderProfile",
        "my-profile(/s=:section)(/s=:subsection)(/)": "renderMyProfile",
        "logout(/)": "logout", // logout the user
        "signout(/)": "logout", // logout the user
        "signin(/)": "renderSignIn", // signin the user
        "signinsuccess(/)": "renderSignInSuccess",
        "signinldaperror(/)": "renderLdapSignInError",
        "signinLdap(/)": "renderLdapSignIn",
        "signinSuccessLdap(/)": "renderLdapSignInSuccess",
        "signin-help": "renderSignInHelp", //The Sign In troubleshotting page
        "share(/*pid)(/)": "renderEditor", // registry page
        "submit(/*pid)(/)": "renderEditor", // registry page
        "quality(/s=:suiteId)(/:pid)(/)": "renderMdqRun", // MDQ page
        "api(/:anchorId)(/)": "renderAPI", // API page
        "edit/:portalTermPlural(/:portalIdentifier)(/:portalSection)(/)":
          "renderPortalEditor",
        drafts: "renderDrafts",
      },

      helpPages: {
        search: "searchTips",
        defaultPage: "searchTips",
      },

      initialize: function () {
        // Add routes to portal dynamically using the appModel portal term
        var portalTermPlural = MetacatUI.appModel.get("portalTermPlural");
        this.route(
          portalTermPlural + "(/:portalId)(/:portalSection)(/)",
          ["portalId", "portalSection"],
          this.renderPortal,
        );

        this.listenTo(
          Backbone.history,
          "routeNotFound",
          this.navigateToDefault,
        );

        // This route handler replaces the route handler we had in the
        // routes table before which was "view/*pid". The * only finds URL
        // parts until the ? but DataONE PIDs can have ? in them so we need
        // to make this route more inclusive.
        this.route(/^view\/(.*)$/, "renderMetadata");

        this.on("route", this.trackPathName);

        // Clear stale JSONLD and meta tags
        this.on("route", this.clearJSONLD);
        this.on("route", this.clearHighwirePressMetaTags);
      },

      //Keep track of navigation movements
      routeHistory: new Array(),
      pathHistory: new Array(),

      // Will return the last route, which is actually the second to last item in the route history,
      // since the last item is the route being currently viewed
      lastRoute: function () {
        if (
          typeof this.routeHistory === "undefined" ||
          this.routeHistory.length <= 1
        )
          return false;
        else return this.routeHistory[this.routeHistory.length - 2];
      },

      trackPathName: function (e) {
        if (_.last(this.pathHistory) != window.location.pathname)
          this.pathHistory.push(window.location.pathname);
      },

      //If the user or app cancelled the last route, call this function to revert
      // the window location pathname back to the correct value
      undoLastRoute: function () {
        this.routeHistory.pop();

        // Remove the last route and pathname from the history
        if (_.last(this.pathHistory) == window.location.pathname)
          this.pathHistory.pop();

        //Change the pathname in the window location back
        this.navigate(_.last(this.pathHistory), { replace: true });
      },

      renderIndex: function (param) {
        this.routeHistory.push("index");

        if (!MetacatUI.appView.indexView) {
          require(["views/IndexView"], function (IndexView) {
            MetacatUI.appView.indexView = new IndexView();
            MetacatUI.appView.showView(MetacatUI.appView.indexView);
          });
        } else MetacatUI.appView.showView(MetacatUI.appView.indexView);
      },

      renderText: function (options) {
        if (!MetacatUI.appView.textView) {
          require(["views/TextView"], function (TextView) {
            MetacatUI.appView.textView = new TextView();
            MetacatUI.appView.showView(MetacatUI.appView.textView, options);
          });
        } else MetacatUI.appView.showView(MetacatUI.appView.textView, options);
      },

      renderHelp: function (page, anchorId) {
        this.routeHistory.push("help");
        MetacatUI.appModel.set("anchorId", anchorId);

        if (page) var pageName = this.helpPages[page];
        else var pageName = this.helpPages["defaultPage"]; //default

        var options = {
          pageName: pageName,
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderSignInHelp: function () {
        this.routeHistory.push("signin-help");
        this.renderText({ pageName: "signInHelp" });
      },

      renderAbout: function (anchorId) {
        this.routeHistory.push("about");
        MetacatUI.appModel.set("anchorId", anchorId);
        var options = {
          pageName: "about",
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderAPI: function (anchorId) {
        this.routeHistory.push("api");
        MetacatUI.appModel.set("anchorId", anchorId);
        var options = {
          pageName: "api",
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderProjects: function () {
        require(["views/projects/ProjectView"], function (ProjectView) {
          MetacatUI.appView.projectView = new ProjectView();
          MetacatUI.appView.showView(MetacatUI.appView.projectView);
        });
      },

      /*
       * Renders the editor view given a root package identifier,
       * or a metadata identifier.  If the latter, the corresponding
       * package identifier will be queried and then rendered.
       */
      renderEditor: function (pid) {
        //If there is no EML211EditorView yet, create one
        if (!MetacatUI.appView.eml211EditorView) {
          var router = this;

          //Load the EML211EditorView file
          require(["views/metadata/EML211EditorView"], function (
            EML211EditorView,
          ) {
            //Add the submit route to the router history
            router.routeHistory.push("submit");

            //Create a new EML211EditorView
            MetacatUI.appView.eml211EditorView = new EML211EditorView({
              pid: pid,
            });

            //Set the pid from the pid given in the URL
            MetacatUI.appView.eml211EditorView.pid = pid;

            //Render the EML211EditorView
            MetacatUI.appView.showView(MetacatUI.appView.eml211EditorView);
          });
        } else {
          //Set the pid from the pid given in the URL
          MetacatUI.appView.eml211EditorView.pid = pid;

          //Add the submit route to the router history
          this.routeHistory.push("submit");

          //Render the Editor View
          MetacatUI.appView.showView(MetacatUI.appView.eml211EditorView);
        }
      },

      /**
       * Renders the Drafts view which is a simple view backed by LocalForage that
       * lists drafts created in the Editor so users can recover any failed
       * submissions.
       */
      renderDrafts: function () {
        require(["views/DraftsView"], function (DraftsView) {
          MetacatUI.appView.draftsView = new DraftsView();
          MetacatUI.appView.showView(MetacatUI.appView.draftsView);
        });
      },

      renderMdqRun: function (suiteId, pid) {
        this.routeHistory.push("quality");

        if (!MetacatUI.appView.mdqRunView) {
          require(["views/MdqRunView"], function (MdqRunView) {
            MetacatUI.appView.mdqRunView = new MdqRunView();
            MetacatUI.appView.mdqRunView.suiteId = suiteId;
            MetacatUI.appView.mdqRunView.pid = pid;
            MetacatUI.appView.showView(MetacatUI.appView.mdqRunView);
          });
        } else {
          MetacatUI.appView.mdqRunView.suiteId = suiteId;
          MetacatUI.appView.mdqRunView.pid = pid;
          MetacatUI.appView.showView(MetacatUI.appView.mdqRunView);
        }
      },

      renderTools: function (anchorId) {
        this.routeHistory.push("tools");
        MetacatUI.appModel.set("anchorId", anchorId);

        var options = {
          pageName: "tools",
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderMyData: function (page) {
        //Only display this is the user is logged in
        if (
          !MetacatUI.appUserModel.get("loggedIn") &&
          MetacatUI.appUserModel.get("checked")
        )
          this.navigate("data", { trigger: true });
        else if (!MetacatUI.appUserModel.get("checked")) {
          var router = this;

          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            function () {
              if (MetacatUI.appUserModel.get("loggedIn"))
                router.renderMyData(page);
              else this.navigate("data", { trigger: true });
            },
          );

          return;
        }

        this.routeHistory.push("data");

        ///Check for a page URL parameter
        if (typeof page === "undefined") MetacatUI.appModel.set("page", 0);
        else MetacatUI.appModel.set("page", page);

        if (!MetacatUI.appView.dataCatalogView) {
          require(["views/DataCatalogView"], function (DataCatalogView) {
            MetacatUI.appView.dataCatalogView = new DataCatalogView();
            MetacatUI.appView.dataCatalogView.searchModel =
              MetacatUI.appUserModel.get("searchModel").clone();
            MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
          });
        } else {
          MetacatUI.appView.dataCatalogView.searchModel = MetacatUI.appUserModel
            .get("searchModel")
            .clone();
          MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
        }
      },

      renderData: function (mode, query, page) {
        this.routeHistory.push("data");
        // Check for a page URL parameter
        page = parseInt(page);
        page = isNaN(page) || page < 1 ? 1 : page;
        MetacatUI.appModel.set("page", page - 1);

        // Check if we are using the new CatalogSearchView
        if (!MetacatUI.appModel.get("useDeprecatedDataCatalogView")) {
          require(["views/search/CatalogSearchView"], function (
            CatalogSearchView,
          ) {
            MetacatUI.appView.catalogSearchView = new CatalogSearchView({
              initialQuery: query,
            });
            MetacatUI.appView.showView(MetacatUI.appView.catalogSearchView);
          });
          return;
        }

        // Check for a query URL parameter
        if (typeof query !== "undefined" && query) {
          MetacatUI.appSearchModel.set("additionalCriteria", [query]);
        }

        require(["views/DataCatalogView"], function (DataCatalogView) {
          if (!MetacatUI.appView.dataCatalogView) {
            MetacatUI.appView.dataCatalogView = new DataCatalogView();
          }
          if (mode) MetacatUI.appView.dataCatalogView.mode = mode;
          MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
        });
      },

      /**
       * Renders the Portals Search view.
       */
      renderPortalsSearch: function () {
        require(["views/portals/PortalsSearchView"], function (
          PortalsSearchView,
        ) {
          MetacatUI.appView.showView(new PortalsSearchView({ el: "#Content" }));
        });
      },

      /**
       * renderPortal - Render the portal view based on the given name or id, as
       * well as optional section
       *
       * @param  {string} label         The portal ID or name
       * @param  {string} portalSection A specific section within the portal
       */
      renderPortal: function (label, portalSection) {
        //If no portal was specified, go to the portal search view
        if (!label) {
          this.renderPortalsSearch();
          return;
        }

        // Add the overall class immediately so the navbar is styled correctly right away
        $("body").addClass("PortalView");
        // Look up the portal document seriesId by its registered name if given
        if (portalSection) {
          this.routeHistory.push(
            MetacatUI.appModel.get("portalTermPlural") +
              "/" +
              label +
              "/" +
              portalSection,
          );
        } else {
          this.routeHistory.push(
            MetacatUI.appModel.get("portalTermPlural") + "/" + label,
          );
        }

        require(["views/portals/PortalView"], function (PortalView) {
          MetacatUI.appView.portalView = new PortalView({
            label: label,
            activeSectionLabel: portalSection,
          });
          MetacatUI.appView.showView(MetacatUI.appView.portalView);
        });
      },

      /**
       * Renders the PortalEditorView
       * @param {string} [portalTermPlural] - This should match the `portalTermPlural` configured in the AppModel.
       * @param {string} [portalIdentifier] - The id or labebl of the portal
       * @param {string} [portalSection] - The name of the section within the portal to navigate to (e.g. "data")
       */
      renderPortalEditor: function (
        portalTermPlural,
        portalIdentifier,
        portalSection,
      ) {
        //If the user navigated to a route with a portal term other than the one supported, then this is not a portal editor route.
        if (portalTermPlural != MetacatUI.appModel.get("portalTermPlural")) {
          this.navigateToDefault();
          return;
        }

        // Add the overall class immediately so the navbar is styled correctly right away
        $("body").addClass("Editor").addClass("Portal");

        // Look up the portal document seriesId by its registered name if given
        if (portalSection) {
          this.routeHistory.push(
            "edit/" +
              MetacatUI.appModel.get("portalTermPlural") +
              "/" +
              portalIdentifier +
              "/" +
              portalSection,
          );
        } else {
          if (!portalIdentifier) {
            this.routeHistory.push(
              "edit/" + MetacatUI.appModel.get("portalTermPlural"),
            );
          } else {
            this.routeHistory.push(
              "edit/" +
                MetacatUI.appModel.get("portalTermPlural") +
                "/" +
                portalIdentifier,
            );
          }
        }

        require(["views/portals/editor/PortalEditorView"], function (
          PortalEditorView,
        ) {
          MetacatUI.appView.portalEditorView = new PortalEditorView({
            activeSectionLabel: portalSection,
            portalIdentifier: portalIdentifier,
          });
          MetacatUI.appView.showView(MetacatUI.appView.portalEditorView);
        });
      },

      renderMetadata: function (pid) {
        pid = decodeURIComponent(pid);

        this.routeHistory.push("metadata");
        MetacatUI.appModel.set("lastPid", MetacatUI.appModel.get("pid"));

        var seriesId;

        //Check for a seriesId
        if (pid.indexOf("version:") > -1) {
          seriesId = pid.substr(0, pid.indexOf(", version:"));

          pid = pid.substr(pid.indexOf(", version: ") + ", version: ".length);
        }

        //Save the id in the app model
        MetacatUI.appModel.set("pid", pid);

        if (!MetacatUI.appView.metadataView) {
          require(["views/MetadataView"], function (MetadataView) {
            MetacatUI.appView.metadataView = new MetadataView();

            //Send the id(s) to the view
            MetacatUI.appView.metadataView.seriesId = seriesId;
            MetacatUI.appView.metadataView.pid = pid;

            MetacatUI.appView.showView(MetacatUI.appView.metadataView);
          });
        } else {
          //Send the id(s) to the view
          MetacatUI.appView.metadataView.seriesId = seriesId;
          MetacatUI.appView.metadataView.pid = pid;

          // MetacatUI resets the dataPackage and dataPackageSynced
          // attributes before rendering the view. These attributes are
          // initialized on a per-dataset basis to prevent displaying the
          // same dataset repeatedly.

          MetacatUI.appView.metadataView.dataPackage = null;
          MetacatUI.appView.metadataView.dataPackageSynced = false;

          MetacatUI.appView.showView(MetacatUI.appView.metadataView);
        }
      },

      renderProfile: function (username, section, subsection) {
        this.closeLastView();

        var viewChoice;

        //If there is a username specified and user profiles are disabled,
        // forward to the entire repo profile view.
        if (username && !MetacatUI.appModel.get("enableUserProfiles")) {
          this.navigate("profile", { trigger: true, replace: true });
          return;
        }

        if (!username) {
          this.routeHistory.push("summary");

          // flag indicating /profile view
          var viewOptions = { nodeSummaryView: true };

          if (!MetacatUI.appView.statsView) {
            require(["views/StatsView"], function (StatsView) {
              MetacatUI.appView.statsView = new StatsView({
                userType: "repository",
              });

              MetacatUI.appView.showView(
                MetacatUI.appView.statsView,
                viewOptions,
              );
            });
          } else
            MetacatUI.appView.showView(
              MetacatUI.appView.statsView,
              viewOptions,
            );
        } else {
          this.routeHistory.push("profile");
          MetacatUI.appModel.set("profileUsername", username);

          if (section || subsection) {
            var viewOptions = { section: section, subsection: subsection };
          }

          if (!MetacatUI.appView.userView) {
            require(["views/UserView"], function (UserView) {
              MetacatUI.appView.userView = new UserView();

              MetacatUI.appView.showView(
                MetacatUI.appView.userView,
                viewOptions,
              );
            });
          } else
            MetacatUI.appView.showView(MetacatUI.appView.userView, viewOptions);
        }
      },

      renderMyProfile: function (section, subsection) {
        if (
          MetacatUI.appUserModel.get("checked") &&
          !MetacatUI.appUserModel.get("loggedIn")
        )
          this.renderSignIn();
        else if (!MetacatUI.appUserModel.get("checked")) {
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            function () {
              if (MetacatUI.appUserModel.get("loggedIn"))
                this.renderProfile(
                  MetacatUI.appUserModel.get("username"),
                  section,
                  subsection,
                );
              else this.renderSignIn();
            },
          );
        } else if (
          MetacatUI.appUserModel.get("checked") &&
          MetacatUI.appUserModel.get("loggedIn")
        ) {
          this.renderProfile(
            MetacatUI.appUserModel.get("username"),
            section,
            subsection,
          );
        }
      },

      logout: function (param) {
        //Clear our browsing history when we log out
        this.routeHistory.length = 0;

        if (
          (typeof MetacatUI.appModel.get("tokenUrl") == "undefined" ||
            !MetacatUI.appModel.get("tokenUrl")) &&
          !MetacatUI.appView.registryView
        ) {
          require(["views/RegistryView"], function (RegistryView) {
            MetacatUI.appView.registryView = new RegistryView();
            if (MetacatUI.appView.currentView.onClose)
              MetacatUI.appView.currentView.onClose();
            MetacatUI.appUserModel.logout();
          });
        } else {
          if (
            MetacatUI.appView.currentView &&
            MetacatUI.appView.currentView.onClose
          )
            MetacatUI.appView.currentView.onClose();
          MetacatUI.appUserModel.logout();
        }
      },

      renderSignIn: function () {
        var router = this;

        //If there is no SignInView yet, create one
        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            MetacatUI.appView.signInView = new SignInView({
              el: "#Content",
              fullPage: true,
            });
            router.renderSignIn();
          });

          return;
        }

        //If the user status has been checked and they are already logged in, we will forward them to their profile
        if (
          MetacatUI.appUserModel.get("checked") &&
          MetacatUI.appUserModel.get("loggedIn")
        ) {
          this.navigate("my-profile", { trigger: true });
          return;
        }
        //If the user status has been checked and they are NOT logged in, show the SignInView
        else if (
          MetacatUI.appUserModel.get("checked") &&
          !MetacatUI.appUserModel.get("loggedIn")
        ) {
          this.routeHistory.push("signin");
          MetacatUI.appView.showView(MetacatUI.appView.signInView);
        }
        //If the user status has not been checked yet, wait for it
        else if (!MetacatUI.appUserModel.get("checked")) {
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            this.renderSignIn,
          );
          MetacatUI.appView.showView(MetacatUI.appView.signInView);
        }
      },

      renderSignInSuccess: function () {
        $("body").html("Sign-in successful.");
        setTimeout(window.close, 1000);
      },

      renderLdapSignInSuccess: function () {
        //If there is an LDAP sign in error message
        if (
          window.location.pathname.indexOf(
            "error=Unable%20to%20authenticate%20LDAP%20user",
          ) > -1
        ) {
          this.renderLdapOnlySignInError();
        } else {
          this.renderSignInSuccess();
        }
      },

      renderLdapSignInError: function () {
        this.routeHistory.push("signinldaperror");

        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            MetacatUI.appView.signInView = new SignInView({ el: "#Content" });
            MetacatUI.appView.signInView.ldapError = true;
            MetacatUI.appView.signInView.ldapOnly = true;
            MetacatUI.appView.signInView.fullPage = true;
            MetacatUI.appView.showView(MetacatUI.appView.signInView);
          });
        } else {
          MetacatUI.appView.signInView.ldapError = true;
          MetacatUI.appView.signInView.ldapOnly = true;
          MetacatUI.appView.signInView.fullPage = true;
          MetacatUI.appView.showView(MetacatUI.appView.signInView);
        }
      },

      renderLdapOnlySignInError: function () {
        this.routeHistory.push("signinldaponlyerror");

        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            var signInView = new SignInView({ el: "#Content" });
            signInView.ldapError = true;
            signInView.ldapOnly = true;
            signInView.fullPage = true;
            MetacatUI.appView.showView(signInView);
          });
        } else {
          var signInView = new SignInView({ el: "#Content" });
          signInView.ldapError = true;
          signInView.ldapOnly = true;
          signInView.fullPage = true;
          MetacatUI.appView.showView(signInView);
        }
      },

      renderLdapSignIn: function () {
        this.routeHistory.push("signinLdap");

        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            MetacatUI.appView.signInView = new SignInView({ el: "#Content" });
            MetacatUI.appView.signInView.ldapOnly = true;
            MetacatUI.appView.signInView.fullPage = true;
            MetacatUI.appView.showView(MetacatUI.appView.signInView);
          });
        } else {
          var signInLdapView = new SignInView({ el: "#Content" });
          MetacatUI.appView.signInView.ldapOnly = true;
          MetacatUI.appView.signInView.fullPage = true;
          MetacatUI.appView.showView(signInLdapView);
        }
      },

      navigateToDefault: function () {
        //Navigate to the default view
        this.navigate(MetacatUI.appModel.defaultView, { trigger: true });
      },

      /*
       * Gets an array of route names that are set on this router.
       * @return {Array} - An array of route names, not including any special characters
       */
      getRouteNames: function () {
        var router = this;

        var routeNames = _.map(Object.keys(this.routes), function (routeName) {
          return router.getRouteName(routeName);
        });

        //The "view" and portals routes are not included in the route hash (they are set up during initialize),
        // so we have to manually add it here.
        routeNames.push("view");
        if (!routeNames.includes(MetacatUI.appModel.get("portalTermPlural"))) {
          routeNames.push(MetacatUI.appModel.get("portalTermPlural"));
        }

        return routeNames;
      },

      /*
       * Gets the route name based on the route pattern given
       * @param {string} routePattern - A string that represents the route pattern e.g. "view(/pid)"
       * @return {string} - The name of the route without any pattern special characters e.g. "view"
       */
      getRouteName: function (routePattern) {
        var specialChars = ["/", "(", "*", ":"];

        _.each(specialChars, function (specialChar) {
          var substring = routePattern.substring(
            0,
            routePattern.indexOf(specialChar),
          );

          if (substring && substring.length < routePattern.length) {
            routePattern = substring;
          }
        });

        return routePattern;
      },

      closeLastView: function () {
        //Get the last route and close the view
        var lastRoute = _.last(this.routeHistory);

        if (lastRoute == "summary") MetacatUI.appView.statsView.onClose();
        else if (lastRoute == "profile") MetacatUI.appView.userView.onClose();
      },

      clearJSONLD: function () {
        MetacatUI.appView.schemaOrg.removeExistingJsonldEls();
        MetacatUI.appView.schemaOrg.setSchemaFromTemplate();
      },

      clearHighwirePressMetaTags: function () {
        $("head > meta[name='citation_title']").remove();
        $("head > meta[name='citation_authors']").remove();
        $("head > meta[name='citation_publisher']").remove();
        $("head > meta[name='citation_date']").remove();
      },
    },
  );

  return UIRouter;
});
