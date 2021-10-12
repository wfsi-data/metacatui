
define([
  "jquery",
  "underscore",
  "backbone",
  "bioportal",
  "text!templates/tabbedAnnotationFilterView.html"
],
  function (
    $, _, Backbone, Bioportal, Template
  ) {

    return Backbone.View.extend({
      type: "TabbedAnnotationFilter",
      className: "annotation-filter",
      tagName: "div",
      template: _.template(Template),

      /**
       * List of ontologies to show. Each element of this array will show up,
       * in the order below, as tabs, with the first member shown first.
       *
       * Each member should be an Object with names:
       *
       * - name: Title of the tab.
       * - ontology: Ontology acronym as it exists in BioPortal.
       * - startingRoot: Optional, term to root the tree from.
       * - treeEl: Always initialize to null. Stores a reference to the
       *   BioPortal tree widget in the corresponding tab.
       *
       * @type {object}
       */
      ontologies: [{
        name: "MeasurementType",
        ontology: "ECSO",
        startingRoot: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType",
        treeEl: null
      },
      {
        name: "ECSO",
        ontology: "ECSO",
        treeEl: null
      }, {
        name: "ARCRC",
        ontology: "ARCRC",
        treeEl: null
      },
      {
        name: "MOSAiC",
        ontology: "MOSAIC",
        treeEl: null
      }],

      /**
       * Width of the BioPortal tree, in pixels
       *
       * @type {string}
       */
      treeWidth: "460",

      /**
       * The selector for the element that will show/hide the annotation
       * popover interface when clicked. Searches within body.
       * @type {string}
       */
      popoverTriggerSelector: "[data-category='annotation'] .expand-collapse-control",

      /**
       * Select for the container element of the popover
       *
       * @type {string}
       */
      container: "#bioportal-popover",

      initialize: function (options) {

      },

      render: function () {
        this.createPopover();
      },

      createPopover: function () {
        var view = this;

        $("body").append($('<div id="bioportal-popover" data-category="annotation"></div>'));

        $(view.popoverTriggerSelector).popover({
          html: true,
          placement: "bottom",
          trigger: "manual",
          content: this.template({ ontologies: this.ontologies }),
          container: view.container
        }).on("click", function () {
          $(this).popover("toggle");

          // Ensure first tree gets rendered
          const firstTab = $(view.container).find("div.tab-pane.active");
          const name = firstTab.data("name");
          const index = _.findIndex(view.ontologies, function (x) { return x.name === name });

          if (index === -1) {
            return;
          }

          view.ontologies[index].treeEl = firstTab.NCBOTree({
            apikey: MetacatUI.appModel.get("bioportalAPIKey"),
            ontology: view.ontologies[index].ontology,
            startingRoot: view.ontologies[index].startingRoot,
            width: view.treeWidth
          });

          view.ontologies[index].treeEl.on("afterSelect", function (event, classId, prefLabel, selectedNode) {
            view.selectConcept.call(view, event, classId, prefLabel, selectedNode)
          });

          $(view.container).find('a[data-toggle="pill"]').on('shown', function (e) {
            const name = $(e.target).data("name");
            const contentEl = $(view.container).find("div.tab-pane[data-name=" + name + "]");

            if (!contentEl.is(":empty")) {
              return;
            }

            const index = _.findIndex(view.ontologies, function (x) { return x.name === name });

            if (index === -1) {
              return;
            }

            view.ontologies[index].treeEl = contentEl.NCBOTree({
              apikey: MetacatUI.appModel.get("bioportalAPIKey"),
              ontology: view.ontologies[index].ontology,
              startingRoot: view.ontologies[index].startingRoot,
              width: view.treeWidth
            });

            view.ontologies[index].treeEl.on("afterSelect", function (event, classId, prefLabel, selectedNode) {
              view.selectConcept.call(view, event, classId, prefLabel, selectedNode)
            });
          });
        });
      },

      /**
       * selectConcept - Actions that are performed after the user selects
       * a concept from the annotation tree interface. Triggers an event for
       * any parent views, hides and resets the annotation popup.
       *
       * @param  {object} event        The "afterSelect" event
       * @param  {string} classId      The ID for the selected concept (a URL)
       * @param  {string} prefLabel    The label for the selected concept
       * @param  {jQuery} selectedNode The element that was clicked
       */
      selectConcept: function (event, classId, prefLabel, selectedNode) {
        var view = this;

        // Get the concept info
        var item = {
          value: classId,
          label: prefLabel,
          filterLabel: prefLabel,
          desc: ""
        }

        try {
          // Trigger an event so that the parent view can update filters, etc.
          view.trigger("annotationSelected", event, item);

          // Hide the popover
          $(view.popoverTriggerSelector).trigger("click");

          // // Ensure tooltips are removed
          $("body > .tooltip").remove();

          // Prevent default action
          return false;

        } catch (e) {
          console.log("Failed to select an annotation concept, error message: " + e);
        }
      }
    });
  });
