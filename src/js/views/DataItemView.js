define([
  "underscore",
  "jquery",
  "backbone",
  "models/DataONEObject",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLOtherEntity",
  "views/DownloadButtonView",
  "text!templates/dataItem.html",
  "text!templates/dataItemHierarchy.html",
], (
  _,
  $,
  Backbone,
  DataONEObject,
  EML,
  EMLOtherEntity,
  DownloadButtonView,
  DataItemTemplate,
  DataItemHierarchy,
) => {
  /**
   * @class DataItemView
   * @classdesc    A DataItemView represents a single data item in a data package as a single row of
            a nested table.  An item may represent a metadata object (as a folder), or a data
            object described by the metadata (as a file).  Every metadata DataItemView has a
            resource map associated with it that describes the relationships between the
            aggregated metadata and data objects.
   * @classcategory Views
   * @class
   * @screenshot views/DataItemView.png
   */
  const DataItemView = Backbone.View.extend(
    /** @lends DataItemView.prototype */ {
      tagName: "tr",

      className: "data-package-item",

      id: null,

      /** The HTML template for a data item */
      template: _.template(DataItemTemplate),

      /** The HTML template for a data item */
      dataItemHierarchyTemplate: _.template(DataItemHierarchy),

      // Templates
      metricTemplate: _.template(
        "<span class='packageTable-resultItem badge '>" +
          "<i class='catalog-metric-icon <%= metricIcon %>'>" +
          "</i> <%= memberRowMetrics %> " +
          "</span>",
      ),

      /**
       * The DataONEObject model to display in this view
       * @type {DataONEObject}
       */
      model: null,

      /**
       * A reference to the parent EditorView that contains this DataItemView
       * @type EditorView
       * @since 2.15.0
       */
      parentEditorView: null,

      /** Events this view listens to */
      events: {
        "focusout .name.canRename": "updateName",
        "click    .name.canRename": "emptyName",
        "click .duplicate": "duplicate", // Edit dropdown, duplicate scimeta/rdf
        "click .addFolder": "handleAddFolder", // Edit dropdown, add nested scimeta/rdf
        "click .addFiles": "handleAddFiles", // Edit dropdown, open file picker dialog
        "change .file-upload": "addFiles", // Adds the files into the collection
        "change .file-replace": "replaceFile", // Replace a file in the collection
        dragover: "showDropzone", // Drag & drop, show the dropzone for this row
        dragend: "hideDropzone", // Drag & drop, hide the dropzone for this row
        dragleave: "hideDropzone", // Drag & drop, hide the dropzone for this row
        drop: "addFiles", // Drag & drop, adds the files into the collection
        "click .replaceFile": "handleReplace", // Replace dropdown, data in collection
        "click .removeFiles": "handleRemove", // Edit dropdown, remove sci{data,meta} from collection
        "click .cancel": "handleCancel", // Cancel a file load
        "change: percentLoaded": "updateLoadProgress", // Update the file read progress bar
        "mouseover .remove": "previewRemove",
        "mouseout  .remove": "previewRemove",
        "change .public": "changeAccessPolicy",
        "click .downloadAction": "downloadFile",
      },

      /**
       * Initialize the object - post constructor
       * @param options
       */
      initialize(options) {
        if (typeof options === "undefined") var options = {};

        this.model = options.model || new DataONEObject();
        this.currentlyViewing = options.currentlyViewing || null;
        this.mode = options.mode || "edit";
        this.itemName = options.itemName || null;
        this.itemPath = options.itemPath || null;
        this.itemType = options.itemType || "file";
        this.insertInfoIcon = options.insertInfoIcon || false;
        this.id = this.model.get("id");
        this.canWrite = false; // Default. Updated in render()
        this.canShare = false; // Default. Updated in render()
        this.parentEditorView = options.parentEditorView || null;
        this.dataPackageId = options.dataPackageId || null;

        if (!(typeof options.metricsModel === "undefined")) {
          this.metricsModel = options.metricsModel;
        }
      },

      /**
       * Renders a DataItemView for the given DataONEObject
       * @param {DataONEObject} model
       */
      render(model) {
        // Prevent duplicate listeners
        this.stopListening();

        if (this.itemType === "folder") {
          // Set the data-id for identifying events to model ids
          this.$el.attr(
            "data-id",
            `${this.itemPath ? this.itemPath : ""}/${this.itemName}`,
          );
          this.$el.attr("data-parent", this.itemPath ? this.itemPath : "");
          this.$el.attr("data-category", `entities-${this.itemName}`);

          var attributes = new Object();
          attributes.fileType = undefined;
          attributes.isFolder = true;
          attributes.icon = "icon-folder-open";
          attributes.id = this.itemName;
          attributes.size = undefined;
          attributes.insertInfoIcon = false;
          attributes.memberRowMetrics = undefined;
          attributes.isMetadata = false;
          attributes.downloadUrl = undefined;
          attributes.moreInfoLink = undefined;
          // attributes.isMetadata = false;
          attributes.viewType = this.mode;
          attributes.objectTitle = this.itemName;

          var itemPathParts = new Array();
          if (this.itemPath) {
            itemPathParts = this.itemPath.split("/");
            attributes.nodeLevel = itemPathParts.length;
            if (this.itemPath.startsWith("/")) {
              attributes.nodeLevel -= 1;
            }
            if (this.itemPath.endsWith("/")) {
              attributes.nodeLevel -= 1;
            }
            if (itemPathParts[-1] == attributes.objectTitle) {
              attributes.nodeLevel -= 1;
            }
          } else {
            attributes.nodeLevel = 0;
            this.itemPath = "/";
            this.$el.attr("data-packageId", this.dataPackageId);
          }
          this.$el.html(this.dataItemHierarchyTemplate(attributes));
        } else {
          // Set the data-id for identifying events to model ids
          this.$el.attr("data-id", this.model.get("id"));
          this.$el.attr("data-category", `entities-${this.model.get("id")}`);

          // Destroy the old tooltip
          this.$(".status .icon, .status .progress")
            .tooltip("hide")
            .tooltip("destroy");

          var attributes = this.model.toJSON();

          // check if this data item is a metadata object
          attributes.isMetadata = false;
          if (
            this.model.get("type") == "Metadata" ||
            this.model.get("formatType") == "METADATA"
          ) {
            attributes.isMetadata = true;
          }

          // Format the title
          if (Array.isArray(attributes.title)) {
            attributes.title = attributes.title[0];
          }

          // Set some defaults
          attributes.numAttributes = 0;
          attributes.entityIsValid = true;
          attributes.hasInvalidAttribute = false;
          attributes.viewType = this.mode;

          if (this.mode === "edit") {
            // Restrict item replacement and renaming depending on access policy
            //
            // Note: .canWrite is set here (at render) instead of at init
            // because render will get called a few times during page load
            // as the app updates what it knows about the object
            const accessPolicy = this.model.get("accessPolicy");
            if (accessPolicy) {
              attributes.canWrite = accessPolicy.isAuthorized("write");
              this.canWrite = attributes.canWrite;
              attributes.canRename = accessPolicy.isAuthorizedUpdateSysMeta();
            } else {
              attributes.canWrite = false;
              this.canWrite = false;
              attributes.canRename = false;
            }

            // Restrict item sharing depending on access
            this.canShare = this.canShareItem();
            attributes.canShare = this.canShare;

            // Get the number of attributes for this item
            if (this.model.type != "EML") {
              // Get the parent EML model
              if (this.parentEML) {
                var { parentEML } = this;
              } else {
                var parentEML = MetacatUI.rootDataPackage.where({
                  id: Array.isArray(this.model.get("isDocumentedBy"))
                    ? this.model.get("isDocumentedBy")[0]
                    : null,
                });
              }

              if (Array.isArray(parentEML)) parentEML = parentEML[0];

              // If we found a parent EML model
              if (parentEML && parentEML.type == "EML") {
                this.parentEML = parentEML;

                // Find the EMLEntity model for this data item
                const entity =
                  this.model.get("metadataEntity") ||
                  parentEML.getEntity(this.model);

                // If we found an EMLEntity model
                if (entity) {
                  this.entity = entity;

                  // Get the file name from the metadata if it is not in the model
                  if (!this.model.get("fileName")) {
                    let fileName = "";

                    if (entity.get("physicalObjectName"))
                      fileName = entity.get("physicalObjectName");
                    else if (entity.get("entityName"))
                      fileName = entity.get("entityName");

                    if (fileName) attributes.fileName = fileName;
                    this.model.set("fileName", fileName);
                  }

                  // Get the number of attributes for this entity
                  const attrList = entity.get("attributeList");
                  attributes.numAttributes = attrList.hasNonEmptyAttributes()
                    ? entity.get("attributeList").length
                    : 0;
                  // Determine if the entity model is valid
                  attributes.entityIsValid = entity.isValid();

                  // Listen to changes to certain attributes of this EMLEntity model
                  // to re-render this view
                  this.stopListening(entity);
                  this.listenTo(
                    entity,
                    "change:entityType, change:entityName",
                    this.render,
                  );

                  // Check if there are any invalid attribute models
                  // Also listen to each attribute model
                  entity.get("attributeList").each((attr) => {
                    const isValid = attr.isValid();

                    // Mark that this entity has at least one invalid attribute
                    if (!attributes.hasInvalidAttribute && !isValid)
                      attributes.hasInvalidAttribute = true;

                    this.stopListening(attr);

                    // Listen to when the validation status changes and rerender
                    if (isValid) this.listenTo(attr, "invalid", this.render);
                    else this.listenTo(attr, "valid", this.render);
                  }, this);

                  // If there are no attributes now, rerender when one is added
                  this.stopListening(
                    entity,
                    "change:attributeList",
                    this.render,
                  );
                  this.listenTo(entity, "change:attributeList", this.render);
                  this.stopListening(
                    entity.get("attributeList"),
                    "change update",
                    this.render,
                  );
                  this.listenTo(
                    entity.get("attributeList"),
                    "change update",
                    this.render,
                  );
                } else {
                  // Rerender when an entity is added
                  this.stopListening(
                    this.model,
                    "change:entities",
                    this.render,
                  );
                  this.listenTo(this.model, "change:entities", this.render);
                }
              } else {
                // When the package is complete, rerender
                this.listenTo(
                  MetacatUI.rootDataPackage,
                  "add:EML",
                  this.render,
                );
              }
            }

            this.$el.html(this.template(attributes));

            // Initialize dropdowns
            this.$el.find(".dropdown-toggle").dropdown();

            // Render the Share button
            this.renderShareControl();

            if (this.model.get("type") == "Metadata") {
              // Add the title data-attribute attribute to the name cell
              this.$el.find(".name").attr("data-attribute", "title");
              this.$el.addClass("folder");
            } else {
              this.$el.addClass("data");
            }

            // Add tooltip to a disabled Replace link
            $(this.$el)
              .find(".replace.disabled")
              .tooltip({
                title:
                  "You don't have sufficient privileges to replace this item.",
                placement: "left",
                trigger: "hover",
                delay: { show: 400 },
                container: "body",
              });

            // Check if the data package is in progress of being uploaded
            this.toggleSaving();

            // Create tooltips based on the upload status
            const uploadStatus = this.model.get("uploadStatus");
            let errorMessage = this.model.get("errorMessage");

            // Use a friendlier message for 401 errors (the one returned is a little hard to understand)
            if (this.model.get("sysMetaErrorCode") == 401) {
              // If the user at least has write permission, they cannot update the system metadata only, so show this message
              /** @todo Do an object update when someone has write permission but not changePermission and is trying to change the system metadata (but not the access policy)  */
              if (accessPolicy && accessPolicy.isAuthorized("write")) {
                errorMessage = `The owner of this data file has not given you permission to rename it or change the ${MetacatUI.appModel.get(
                  "accessPolicyName",
                )}.`;
                // Otherwise, assume they only have read access
              } else {
                errorMessage = `The owner of this data file has not given you permission to edit this data file or change the ${MetacatUI.appModel.get(
                  "accessPolicyName",
                )}.`;
              }
            }

            // When there's an error or a warninig
            if (uploadStatus == "e" && errorMessage) {
              const tooltipClass = uploadStatus == "e" ? "error" : "";

              this.$(".status .icon").tooltip({
                placement: "top",
                trigger: "hover",
                html: true,
                title: `<div class='status-tooltip ${tooltipClass}'><h6>Issue saving:</h6><div>${errorMessage}</div></div>`,
                container: "body",
              });

              this.$el.removeClass("loading");
            } else if (
              (!uploadStatus || uploadStatus == "c" || uploadStatus == "q") &&
              attributes.numAttributes == 0
            ) {
              this.$(".status .icon").tooltip({
                placement: "top",
                trigger: "hover",
                html: true,
                title:
                  "<div class='status-tooltip'>This file needs to be described - Click 'Describe'</div>",
                container: "body",
              });

              this.$el.removeClass("loading");
            } else if (
              attributes.hasInvalidAttribute ||
              !attributes.entityIsValid
            ) {
              this.$(".status .icon").tooltip({
                placement: "top",
                trigger: "hover",
                html: true,
                title:
                  "<div class='status-tooltip'>There is missing information about this file. Click 'Describe'</div>",
                container: "body",
              });

              this.$el.removeClass("loading");
            } else if (uploadStatus == "c") {
              this.$(".status .icon").tooltip({
                placement: "top",
                trigger: "hover",
                html: true,
                title: "<div class='status-tooltip'>Complete</div>",
                container: "body",
              });

              this.$el.removeClass("loading");
            } else if (uploadStatus == "l") {
              this.$(".status .icon").tooltip({
                placement: "top",
                trigger: "hover",
                html: true,
                title: "<div class='status-tooltip'>Reading file...</div>",
                container: "body",
              });

              this.$el.addClass("loading");
            } else if (uploadStatus == "p") {
              var { model } = this;

              this.$(".status .progress").tooltip({
                placement: "top",
                trigger: "hover",
                html: true,
                title() {
                  if (model.get("numSaveAttempts") > 0) {
                    return `<div class='status-tooltip'>Something went wrong during upload. <br/> Trying again... (attempt ${
                      model.get("numSaveAttempts") + 1
                    } of 3)</div>`;
                  }
                  if (model.get("uploadProgress")) {
                    var percentDone = model.get("uploadProgress").toString();
                    if (percentDone.indexOf(".") > -1)
                      percentDone = percentDone.substring(
                        0,
                        percentDone.indexOf("."),
                      );
                  } else var percentDone = "0";

                  return `<div class='status-tooltip'>Uploading: ${percentDone}%</div>`;
                },
                container: "body",
              });

              this.$el.addClass("loading");
            } else {
              this.$el.removeClass("loading");
            }

            // Listen to changes to the upload progress of this object
            this.listenTo(
              this.model,
              "change:uploadProgress",
              this.showUploadProgress,
            );

            // Listen to changes to the upload status of the entire package
            this.listenTo(
              MetacatUI.rootDataPackage.packageModel,
              "change:uploadStatus",
              this.toggleSaving,
            );

            // listen for changes to rerender the view
            this.listenTo(
              this.model,
              "change:fileName change:title change:id change:formatType " +
                "change:formatId change:type change:resourceMap change:documents change:isDocumentedBy " +
                "change:size change:nodeLevel change:uploadStatus change:errorMessage",
              this.render,
            ); // render changes to the item

            var view = this;
            this.listenTo(this.model, "replace", (newModel) => {
              view.model = newModel;
              view.render();
            });
          } else {
            this.isMetadata = false;
            // format metadata object title
            if (
              attributes.isMetadata ||
              this.model.getFormat() == "metadata" ||
              this.model.get("id") == this.currentlyViewing
            ) {
              attributes.title = `Metadata: ${this.model.get("fileName")}`;
              attributes.icon = "icon-file-text";
              attributes.metricIcon = "icon-eye-open";
              this.isMetadata = true;
              this.$el.attr("data-packageId", this.dataPackageId);
            }

            const objectTitleTooltip =
              attributes.title || attributes.fileName || attributes.id;
            attributes.objectTitle =
              objectTitleTooltip.length > 150
                ? `${objectTitleTooltip.slice(
                    0,
                    75,
                  )}...${objectTitleTooltip.slice(
                    objectTitleTooltip.length - 75,
                    objectTitleTooltip.length,
                  )}`
                : objectTitleTooltip;

            attributes.fileType = this.model.getFormat();
            attributes.isFolder = false;
            // Determine the icon type based on format type
            if (this.model.getFormat() == "program")
              attributes.icon = "icon-code";
            else if (this.model.getFormat() == "data")
              attributes.icon = "icon-table";
            else if (this.model.getFormat() == "image/jpeg")
              attributes.icon = "icon-picture";
            else if (this.model.getFormat() == "PDF")
              attributes.icon = "icon-file";
            else attributes.icon = "icon-table";

            attributes.id = this.model.get("id");
            attributes.memberRowMetrics = null;
            let metricToolTip = null;
            var view = this;

            // Insert metrics for this item,
            // if the model has already been fethced.
            if (
              this.metricsModel != null &&
              this.metricsModel.get("views") !== null
            ) {
              metricToolTip = this.getMemberRowMetrics(view.id);
              attributes.memberRowMetrics = metricToolTip.split(" ")[0];
            } else {
              // Update the metrics later on
              // If the fetch() is still in progress.
              this.listenTo(this.metricsModel, "sync", function () {
                metricToolTip = this.getMemberRowMetrics(view.id);
                const readsCell = this.$(
                  `.metrics-count.downloads[data-id="${view.id}"]`,
                );
                metricToolTip = view.getMemberRowMetrics(view.id);
                if (typeof metricToolTip !== "undefined" && metricToolTip)
                  readsCell.html(
                    this.metricTemplate({
                      metricIcon: attributes.metricIcon,
                      memberRowMetrics: metricToolTip.split(" ")[0],
                    }),
                  );
              });
            }

            // add nodeLevel for displaying indented filename
            attributes.nodeLevel = 1;
            if (
              !(
                attributes.isMetadata ||
                this.model.getFormat() == "metadata" ||
                this.model.get("id") == this.currentlyViewing
              )
            ) {
              attributes.metricIcon = "icon-cloud-download";

              this.$el.addClass();
              if (
                this.itemPath &&
                typeof this.itemPath !== undefined &&
                this.itemPath != "/"
              ) {
                itemPathParts = this.itemPath.split("/");

                attributes.nodeLevel = itemPathParts.length;

                if (this.itemPath.startsWith("/")) {
                  attributes.nodeLevel -= 1;
                }
                if (this.itemPath.endsWith("/")) {
                  attributes.nodeLevel -= 1;
                }

                // var parent = itemPathParts[itemPathParts.length - 2];
                const parentPath = itemPathParts.slice(0, -1).join("/");

                if (parentPath !== undefined) {
                  this.$el.attr("data-parent", parentPath);
                }
              } else {
                attributes.nodeLevel = 1;
                this.$el.attr("data-packageId", this.dataPackageId);
              }
            }

            if (attributes.nodeLevel == 1) {
              this.$el.attr("data-packageId", this.dataPackageId);
            }

            // Download button
            this.downloadButtonView = new DownloadButtonView({
              model: this.model,
              view: "actionsView",
            });
            this.downloadButtonView.render();

            const id = this.model.get("id");
            const infoLink = `${MetacatUI.root}/view/${encodeURIComponent(
              this.currentlyViewing,
            )}#${encodeURIComponent(id)}`;
            attributes.moreInfoLink = infoLink;

            attributes.insertInfoIcon = this.insertInfoIcon;

            this.$el.html(this.dataItemHierarchyTemplate(attributes));

            this.$(".downloadAction").html(this.downloadButtonView.el);

            // add tooltip for metrics in package table
            this.$(".packageTable-resultItem").tooltip({
              placement: "top",
              trigger: "hover",
              delay: 300,
              title: metricToolTip,
            });

            this.$(".fileTitle")
              .addClass("tooltip-this")
              .attr("data-placement", "top")
              .attr("data-trigger", "hover")
              .attr("data-delay", "300")
              .attr("data-title", objectTitleTooltip);
          }
        }

        this.$el.data({
          view: this,
          model: this.model,
        });

        if (this.model.get("errorMessage")) {
          this.showError(this.model.get("errorMessage"));
        }

        return this;
      },

      /**
       * Renders a button that opens the AccessPolicyView for editing permissions on this data item
       * @since 2.15.0
       */
      renderShareControl() {
        // Get the Share button element
        const shareButton = this.$(".sharing button");

        if (
          this.parentEditorView &&
          this.parentEditorView.isAccessPolicyEditEnabled()
        ) {
          // Start a title for the button tooltip
          let sharebuttonTitle;

          // If the user is not authorized to change the permissions of
          // this object, then disable the share button
          if (this.canShare) {
            shareButton.removeClass("disabled");
            sharebuttonTitle = "Share this item with others";
          } else {
            shareButton.addClass("disabled");
            sharebuttonTitle = "You are not authorized to share this item.";
          }

          // Set up tooltips for share button
          shareButton.tooltip({
            title: sharebuttonTitle,
            placement: "top",
            container: this.el,
            trigger: "hover",
            delay: { show: 400 },
          });
        } else {
          shareButton.remove();
        }
      },

      /** Close the view and remove it from the DOM */
      onClose() {
        this.remove(); // remove for the DOM, stop listening
        this.off(); // remove callbacks, prevent zombies
      },

      /**
              Generate a unique id for each data item in the table
              TODO: This could be replaced with the DataONE identifier
       */
      generateId() {
        let idStr = ""; // the id to return
        const length = 30; // the length of the generated string
        const chars =
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".split(
            "",
          );

        for (let i = 0; i < length; i++) {
          idStr += chars[Math.floor(Math.random() * chars.length)];
        }

        return idStr;
      },

      /**
       * Update the folder name based on the scimeta title
       * @param e The event triggering this method
       */
      updateName(e) {
        const enteredText = this.cleanInput($(e.target).text().trim());

        // Set the title if this item is metadata or set the file name
        // if its not
        if (this.model.get("type") == "Metadata") {
          const title = this.model.get("title");

          // Get the current title which is either an array of titles
          // or a single string. When it's an array of strings, we
          // use the first as the canonical title
          const currentTitle = Array.isArray(title) ? title[0] : title;

          // Don't set the title if it hasn't changed or is empty
          if (
            enteredText !== "" &&
            currentTitle !== enteredText &&
            enteredText !== "Untitled dataset"
          ) {
            // Set the new title, upgrading any title attributes
            // that aren't Arrays into Arrays
            if (
              (Array.isArray(title) && title.length < 2) ||
              typeof title === "string"
            ) {
              this.model.set("title", [enteredText]);
            } else {
              title[0] = enteredText;
            }
          }
        } else {
          this.model.set("fileName", enteredText);

          // Reset sysMetaUploadStatus only if this item doesn't
          // have content changes. This is here because replaceFile
          // sets sysMetaUploadStatus to "c" to prevent the editor
          // from updating sysmeta after the update call
          if (!this.model.get("hasContentChanges")) {
            this.model.set("sysMetaUploadStatus", null);
          }
        }
      },

      /**
                Handle the add file event, showing the file picker dialog
                Multiple files are allowed using the shift and or option/alt key
                @param {Event} event
       */
      handleAddFiles(event) {
        event.stopPropagation();
        const fileUploadElement = this.$(".file-upload");

        fileUploadElement.val("");

        if (fileUploadElement) {
          fileUploadElement.click();
        }
        event.preventDefault();
      },

      /**
       * Method to handle batch file uploads.
       * This method processes files independently to avoid being slowed down by large files.
       * @param {FileList} fileList - The list of files to be uploaded.
       * @param {number} [batchSize] - The number of files to upload concurrently.
       * @since 2.32.0
       */
      uploadFilesInBatch(fileList, batchSize = 10) {
        const view = this;
        let currentIndex = 0; // Index of the current file being processed
        let activeUploads = 0; // Counter for the number of active uploads

        // If batchSize is 0, set it to the total number of files
        if (batchSize === 0) batchSize = fileList.length;

        /**
         * Function to upload the next file in the list.
         * This function is called recursively to ensure that the number of concurrent uploads
         * does not exceed the batch size.
         */
        function uploadNextFile() {
          // If all files have been processed, return
          if (currentIndex >= fileList.length) {
            return;
          }

          // If the number of active uploads is less than the batch size, start a new upload
          if (activeUploads < batchSize) {
            const dataONEObject = fileList[currentIndex];
            currentIndex++; // Move to the next file
            activeUploads++; // Increment the active uploads counter

            // Create a new Promise to handle the file upload
            new Promise((resolve, reject) => {
              // If the file needs to be uploaded and its checksum is not calculated
              if (
                dataONEObject.get("uploadFile") &&
                !dataONEObject.get("checksum")
              ) {
                // Stop listening to previous checksumCalculated events
                dataONEObject.stopListening(
                  dataONEObject,
                  "checksumCalculated",
                );
                // Listen to the checksumCalculated event to start the upload
                dataONEObject.listenToOnce(
                  dataONEObject,
                  "checksumCalculated",
                  () => {
                    dataONEObject.save(); // Save the file
                    // Listen to changes in the uploadStatus to resolve the Promise
                    dataONEObject.listenTo(
                      dataONEObject,
                      "change:uploadStatus",
                      () => {
                        if (
                          dataONEObject.get("uploadStatus") !== "p" &&
                          dataONEObject.get("uploadStatus") !== "q" &&
                          dataONEObject.get("uploadStatus") !== "l"
                        ) {
                          resolve(); // Resolve the Promise when the upload is complete
                        }
                      },
                    );
                  },
                );
                try {
                  dataONEObject.calculateChecksum(); // Calculate the checksum
                } catch (exception) {
                  reject(exception); // Reject the Promise if an error occurs
                }
              } else {
                resolve(); // Resolve the Promise if the file does not need to be uploaded
              }
            })
              .then(() => {
                activeUploads--; // Decrement the active uploads counter
                uploadNextFile(); // Start the next file upload
              })
              .catch((error) => {
                console.error("Error uploading file:", error);
                activeUploads--; // Decrement the active uploads counter
                uploadNextFile(); // Start the next file upload
              });

            uploadNextFile(); // Start the next file upload
          }
        }

        // Start the initial batch of uploads
        for (let i = 0; i < batchSize; i++) {
          uploadNextFile();
        }
      },

      /**
                With a file list from the file picker or drag and drop,
                add the files to the collection
                @param {Event} event
       */
      addFiles(event) {
        let fileList; // The list of chosen files
        let parentDataPackage; // The id of the first resource of this row's scimeta
        const self = this; // A reference to this view

        event.stopPropagation();
        event.preventDefault();
        // handle drag and drop files
        if (typeof event.originalEvent.dataTransfer !== "undefined") {
          fileList = event.originalEvent.dataTransfer.files;

          // handle file picker files
        } else if (event.target) {
          fileList = event.target.files;
        }
        this.$el.removeClass("droppable");

        // Find the correct collection to add to. Use JQuery's delegateTarget
        // attribute corresponding to the element where the event handler was attached
        if (typeof event.delegateTarget.dataset.id !== "undefined") {
          this.parentSciMeta = this.getParentScienceMetadata(event);
          this.collection = this.getParentDataPackage(event);
          // Queue the files for upload
          const queueFilesPromise = new Promise((resolve) => {
            _.each(
              fileList,
              function (file) {
                let uploadStatus = "l";
                let errorMessage = "";

                if (file.size == 0) {
                  uploadStatus = "e";
                  errorMessage =
                    "This is an empty file. It won't be included in the dataset.";
                }

                const dataONEObject = new DataONEObject({
                  synced: true,
                  type: "Data",
                  fileName: file.name,
                  size: file.size,
                  mediaType: file.type,
                  uploadFile: file,
                  uploadStatus,
                  errorMessage,
                  isDocumentedBy: [this.parentSciMeta.id],
                  isDocumentedByModels: [this.parentSciMeta],
                  resourceMap: [this.collection.packageModel.id],
                });

                // Add it to the parent collection
                this.collection.add(dataONEObject);
              },
              this,
            );
            resolve();
          });

          queueFilesPromise.then(() => {
            // Call the batch upload method
            this.uploadFilesInBatch(
              this.collection.models,
              MetacatUI.appModel.get("batchSizeUpload"),
            );
          });
        }
      },

      /** Show the drop zone for this row in the table */
      showDropzone() {
        if (this.model.get("type") !== "Metadata") return;
        this.$el.addClass("droppable");
      },

      /**
       * Hide the drop zone for this row in the table
       * @param event
       */
      hideDropzone(event) {
        if (this.model.get("type") !== "Metadata") return;
        this.$el.removeClass("droppable");
      },

      /**
       * Handle the user's click of the Replace item in the DataItemView
       * dropdown. Triggers replaceFile after some basic validation.
       *
       * Called indirectly via the "click" event on elements with the
       * class .replaceFile. See this View's events map.
       * @param {MouseEvent} event Browser Click event
       */
      handleReplace(event) {
        event.stopPropagation();

        // Stop immediately if we know the user doesn't have privs
        if (!this.canWrite) {
          event.preventDefault();
          return;
        }

        const fileReplaceElement = $(event.target)
          .parents(".dropdown-menu")
          .children(".file-replace");

        if (!fileReplaceElement) {
          console.log("Unable to find Replace file picker.");

          return;
        }

        fileReplaceElement.val("");
        fileReplaceElement.trigger("click");

        event.preventDefault();
      },

      /**
       * Replace a file (DataONEObject) in the collection with another one
       * from a file picker. Maintains attributes on the original
       * DataONEObject and maintains the entity information in the parent
       * collection's metadata record (i.e., keeps your attributes, etc.).
       *
       * Called indirectly via the "change" event on elements with the
       * class .file-upload. See this View's events map.
       *
       * The bulk of the work is done in a try-catch block to catch
       * mistakes that would cause the editor to get into a broken state.
       * On error, we attempt to return the editor back to its pre-replace
       * state.
       * @param {Event} event
       */
      replaceFile(event) {
        event.stopPropagation();
        event.preventDefault();

        if (!this.canWrite) {
          return;
        }

        const fileList = event.target.files;

        // Pre-check fileList value to make sure we can work with it
        if (fileList.length != 1) {
          // TODO: Show error, find out how to do this
          return;
        }

        if (typeof event.delegateTarget.dataset.id === "undefined") {
          // TODO: Show error, find out how to do this
          return;
        }

        // Save uploadStatus for reverting if need to
        const oldUploadStatus = this.model.get("uploadStatus");

        const file = fileList[0];
        let uploadStatus = "q";
        let errorMessage = "";

        if (file.size == 0) {
          uploadStatus = "e";
          errorMessage =
            "This is an empty file. It won't be included in the dataset.";
        }

        if (!this.model) {
          console.log(
            "Couldn't find model we're supposed to be replacing. Stopping.",
          );
          return;
        }

        // Copy model attributes aside for reverting on error
        const newAttributes = {
          synced: false,
          fileName: file.name,
          size: file.size,
          mediaType: file.type,
          uploadFile: file,
          hasContentChanges: true,
          checksum: null,
          uploadStatus,
          sysMetaUploadStatus: "c", // I set this so DataPackage::save
          // wouldn't try to update the sysmeta after the update
          errorMessage,
        };

        // Save a copy of the attributes we're changing so we can revert
        // later if we encounter an exception
        const oldAttributes = {};
        _.each(
          Object.keys(newAttributes),
          function (k) {
            oldAttributes[k] = _.clone(this.model.get(k));
          },
          this,
        );

        oldAttributes.uploadStatus = oldUploadStatus;

        try {
          this.model.set(newAttributes);

          // Attempt the formatId. Defaults to app/octet-stream
          this.model.set("formatId", this.model.getFormatId());

          // Grab a reference to the entity in the EML for the object
          // we're replacing
          this.parentSciMeta = this.getParentScienceMetadata(event);
          let entity = null;

          if (this.parentSciMeta) {
            entity = this.parentSciMeta.getEntity(this.model);
          }

          // Eagerly update the PID for this object so we can update
          // the matching EML entity
          this.model.updateID();

          // Update the EML entity with the new id
          if (entity) {
            entity.set("xmlID", this.model.getXMLSafeID());
          }

          this.render();

          if (this.model.get("uploadFile") && !this.model.get("checksum")) {
            try {
              this.model.calculateChecksum();
            } catch (exception) {
              // TODO: Fail gracefully here for the user
            }
          }

          MetacatUI.rootDataPackage.packageModel.set("changed", true);

          // Last, provided a visual indication the replace was completed
          const describeButton = this.$el
            .children(".controls")
            .children(".btn-group")
            .children("button.edit")
            .first();

          if (describeButton.length != 1) {
            return;
          }

          const oldText = describeButton.html();

          describeButton.html('<i class="icon icon-ok success" /> Replaced');

          const previousBtnClasses = describeButton.attr("class");
          describeButton.removeClass("warning error").addClass("message");

          window.setTimeout(() => {
            describeButton.html(oldText);
            describeButton.addClass(previousBtnClasses).removeClass("message");
          }, 3000);
        } catch (error) {
          console.log("Error replacing: ", error);

          // Revert changes to the attributes
          this.model.set(oldAttributes);
          this.model.set("formatId", this.model.getFormatId());
          this.model.set("sysMetaUploadStatus", "c"); // Prevents a sysmeta update
          this.model.resetID();

          this.render();
        }
      },

      /**
             Handle remove events for this row in the data package table
              @param {Event} event
       */
      handleRemove(event) {
        let eventId; // The id of the row of this event
        const removalIds = []; // The list of target ids to remove
        let dataONEObject; // The model represented by this row
        let documents; // The list of ids documented by this row (if meta)

        event.stopPropagation();
        event.preventDefault();

        // Get the row id, add it to the remove list
        if (typeof event.delegateTarget.dataset.id !== "undefined") {
          eventId = event.delegateTarget.dataset.id;
          removalIds.push(eventId);
        }

        this.parentSciMeta = this.getParentScienceMetadata(event);

        if (!this.parentSciMeta) {
          this.$(".status .icon, .status .progress")
            .tooltip("hide")
            .tooltip("destroy");

          // Remove the row
          this.remove();
          return;
        }

        this.collection = this.getParentDataPackage(event);

        // Get the corresponding model
        if (typeof eventId !== "undefined") {
          dataONEObject = this.collection.get(eventId);
        }

        // Is it nested science metadata?
        if (dataONEObject && dataONEObject.get("type") == "Metadata") {
          // We also remove the data documented by these metadata
          documents = dataONEObject.get("documents");

          if (documents.length > 0) {
            _.each(documents, removalIds.push());
          }
        }
        // Data objects may need to be removed from the EML model entities list
        else if (dataONEObject && this.parentSciMeta.type == "EML") {
          const matchingEntity = this.parentSciMeta.getEntity(dataONEObject);

          if (matchingEntity) this.parentSciMeta.removeEntity(matchingEntity);
        }

        // Remove the id from the documents array in the science metadata
        _.each(
          removalIds,
          function (id) {
            const documents = this.parentSciMeta.get("documents");
            const index = documents.indexOf(id);
            if (index > -1) {
              this.parentSciMeta.get("documents").splice(index, 1);
            }
          },
          this,
        );

        // Remove each object from the collection
        this.collection.remove(removalIds);

        this.$(".status .icon, .status .progress")
          .tooltip("hide")
          .tooltip("destroy");

        // Remove the row
        this.remove();

        MetacatUI.rootDataPackage.packageModel.set("changed", true);
      },

      /**
       * Return the parent science metadata model associated with the
       * data or metadata row of the UI event
       *   @param {Event} event
       */
      getParentScienceMetadata(event) {
        let parentMetadata; // The parent metadata array in the collection
        let eventModels; // The models associated with the event's table row
        let eventModel; // The model associated with the event's table row
        let parentSciMeta; // The parent science metadata for the event model

        if (typeof event.delegateTarget.dataset.id !== "undefined") {
          eventModels = MetacatUI.rootDataPackage.where({
            id: event.delegateTarget.dataset.id,
          });

          if (eventModels.length > 0) {
            eventModel = eventModels[0];
          } else {
            return;
          }

          // Is this a Data or Metadata model?
          if (eventModel.get && eventModel.get("type") === "Metadata") {
            return eventModel;
          }
          // It's data, get the parent scimeta
          parentMetadata = MetacatUI.rootDataPackage.where({
            id: Array.isArray(eventModel.get("isDocumentedBy"))
              ? eventModel.get("isDocumentedBy")[0]
              : null,
          });

          if (parentMetadata.length > 0) {
            parentSciMeta = parentMetadata[0];
            return parentSciMeta;
          }
          // If there is only one metadata model in the root data package, then use that metadata model
          const metadataModels = MetacatUI.rootDataPackage.where({
            type: "Metadata",
          });

          if (metadataModels.length == 1) return metadataModels[0];
        }
      },

      /**
       * Return the parent data package collection associated with the
       * data or metadata row of the UI event
       *  @param {Event} event
       */
      getParentDataPackage(event) {
        let parentSciMeta;
        let parenResourceMaps;
        let parentResourceMapId;

        if (typeof event.delegateTarget.dataset.id !== "undefined") {
          parentSciMeta = this.getParentScienceMetadata(event);

          if (
            parentSciMeta.get &&
            parentSciMeta.get("resourceMap").length > 0
          ) {
            parentResourceMaps = parentSciMeta.get("resourceMap");

            if (!MetacatUI.rootDataPackage.packageModel.get("latestVersion")) {
              // Decide how to handle this by calling model.findLatestVersion()
              // and listen for the result, setting getParentDataPackage() as the callback?
            } else {
              parentResourceMapId =
                MetacatUI.rootDataPackage.packageModel.get("latestVersion");
            }
          } else {
            console.log(
              "There is no resource map associated with the science metadata.",
            );
          }

          // Is this the root package or a nested package?
          if (
            MetacatUI.rootDataPackage.packageModel.id === parentResourceMapId
          ) {
            return MetacatUI.rootDataPackage;

            // A nested package
          }
          return MetacatUI.rootDataPackage.where({
            id: parentResourceMapId,
          })[0];
        }
      },

      /**
       * Removes invalid characters and formatting from the given input string
       * @param {string} input The string to clean
       * @returns {string}
       */
      cleanInput(input) {
        // 1. remove line breaks / Mso classes
        const stringStripper = /(\n|\r| class=(")?Mso[a-zA-Z]+(")?)/g;
        let output = input.replace(stringStripper, " ");

        // 2. strip Word generated HTML comments
        const commentSripper = new RegExp("<!--(.*?)-->", "g");
        output = output.replace(commentSripper, "");
        let tagStripper = new RegExp(
          "<(/)*(meta|link|span|\\?xml:|st1:|o:|font)(.*?)>",
          "gi",
        );

        // 3. remove tags leave content if any
        output = output.replace(tagStripper, "");

        // 4. Remove everything in between and including tags '<style(.)style(.)>'
        const badTags = [
          "style",
          "script",
          "applet",
          "embed",
          "noframes",
          "noscript",
        ];

        for (var i = 0; i < badTags.length; i++) {
          tagStripper = new RegExp(
            `<${badTags[i]}.*?${badTags[i]}(.*?)>`,
            "gi",
          );
          output = output.replace(tagStripper, "");
        }

        // 5. remove attributes ' style="..."'
        const badAttributes = ["style", "start"];
        for (var i = 0; i < badAttributes.length; i++) {
          const attributeStripper = new RegExp(
            ` ${badAttributes[i]}="(.*?)"`,
            "gi",
          );
          output = output.replace(attributeStripper, "");
        }

        output = EML.prototype.cleanXMLText(output);

        return output;
      },

      /**
       * Style this table row to indicate it will be removed
       */
      previewRemove() {
        this.$el.toggleClass("remove-preview");
      },

      /**
       * Clears the text in the cell if the text was the default. We add
       * an 'empty' class, and remove it when the user focuses back out.
       * @param {Event} e
       */
      emptyName(e) {
        const editableCell = this.$(".canRename [contenteditable]");

        editableCell.tooltip("hide");

        if (editableCell.text().indexOf("Untitled") > -1) {
          editableCell
            .attr("data-original-text", editableCell.text().trim())
            .text("")
            .addClass("empty")
            .on("focusout", () => {
              if (!editableCell.text())
                editableCell
                  .text(editableCell.attr("data-original-text"))
                  .removeClass("empty");
            });
        }
      },

      /**
       * Changes the access policy of a data object based on user input.
       * @param {Event} e - The event that triggered this function as a callback
       */
      changeAccessPolicy(e) {
        if (typeof e === "undefined" || !e) return;

        const accessPolicy = this.model.get("accessPolicy");

        const makePublic = $(e.target).prop("checked");

        // If the user has chosen to make this object private
        if (!makePublic) {
          if (accessPolicy) {
            // Make the access policy private
            accessPolicy.makePrivate();
          } else {
            // Create an access policy from the default settings
            this.model.createAccessPolicy();
            // Make the access policy private
            this.model.get("accessPolicy").makePrivate();
          }
        } else if (accessPolicy) {
          // Make the access policy public
          accessPolicy.makePublic();
        } else {
          // Create an access policy from the default settings
          this.model.createAccessPolicy();
          // Make the access policy public
          this.model.get("accessPolicy").makePublic();
        }
      },

      /**
       * Shows form validation for this data item
       * @param {string} attr The modal attribute that has been validated
       * @param {string} errorMsg The validation error message to display
       */
      showValidation(attr, errorMsg) {
        // Find the element that is required
        const requiredEl = this.$(`[data-category='${attr}']`).addClass(
          "error",
        );

        // When it is updated, remove the error styling
        this.listenToOnce(this.model, `change:${attr}`, this.hideRequired);
      },

      /**
       * Show an error, e.g. if the file can't be fetched
       * @param {string} message The error message to display
       * @since 2.32.1
       */
      showError(message) {
        this.$el.removeClass("loading");
        const nameColumn = this.$(".name");
        nameColumn.addClass("error");
        // Append an error message
        this.errorEl = $(document.createElement("div"))
          .addClass("error-message")
          .text(`There was an error: ${message}`);
        nameColumn.append(this.errorEl);
        const icon = this.$(".type-icon");
        icon.addClass("error");
      },

      /**
       * Hides the 'required' styling from this view
       */
      hideRequired() {
        // Remove the error styling
        this.$("[contenteditable].error").removeClass("error");
      },

      /**
       * Show the data item as saving
       */
      showSaving() {
        this.$(".controls button").prop("disabled", true);

        if (this.model.get("type") != "Metadata")
          this.$(".controls").prepend(
            $(document.createElement("div")).addClass("disable-layer"),
          );

        this.$(".canRename > div").prop("contenteditable", false);
      },

      /**
       * Hides the styles applied in {@link DataItemView#showSaving}
       */
      hideSaving() {
        this.$(".controls button").prop("disabled", false);
        this.$(".disable-layer").remove();

        // Make the name cell editable again
        this.$(".canRename > div").prop("contenteditable", true);

        this.$el.removeClass("error-saving");
      },

      toggleSaving() {
        if (
          this.model.get("uploadStatus") == "p" ||
          this.model.get("uploadStatus") == "l" ||
          (this.model.get("uploadStatus") == "e" &&
            this.model.get("type") != "Metadata") ||
          MetacatUI.rootDataPackage.packageModel.get("uploadStatus") == "p"
        )
          this.showSaving();
        else this.hideSaving();

        if (this.model.get("uploadStatus") == "e")
          this.$el.addClass("error-saving");
      },

      /**
       * Shows the current progress of the file upload
       */
      showUploadProgress() {
        if (this.model.get("numSaveAttempts") > 0) {
          this.$(".progress .bar").css("width", "100%");
        } else {
          this.$(".progress .bar").css(
            "width",
            `${this.model.get("uploadProgress")}%`,
          );
        }
      },

      /**
       * Determine whether this item can be shared
       *
       * Used to control whether the Share button in the template
       * is enabled or not.
       *
       * Has special behavior depending on whether the item is metadata or
       * not. If metadata (ie type is EML), also checks that the resource
       * map can be shared. Otherwise, only checks if the data item can be
       * shared.
       * @returns {boolean} Whether the item can be shared
       * @since 2.15.0
       */
      canShareItem() {
        if (this.parentEditorView) {
          if (this.parentEditorView.isAccessPolicyEditEnabled()) {
            if (this.model.type === "EML") {
              // Check whether we can share the resource map
              const pkgModel = MetacatUI.rootDataPackage.packageModel;
              const pkgAccessPolicy = pkgModel.get("accessPolicy");

              const canShareResourceMap =
                pkgModel.isNew() ||
                (pkgAccessPolicy &&
                  pkgAccessPolicy.isAuthorized("changePermission"));

              // Check whether we can share the metadata
              const modelAccessPolicy = this.model.get("accessPolicy");
              const canShareMetadata =
                this.model.isNew() ||
                (modelAccessPolicy &&
                  modelAccessPolicy.isAuthorized("changePermission"));

              // Only return true if we can share both
              return canShareMetadata && canShareResourceMap;
            }
            return (
              this.model.get("accessPolicy") &&
              this.model.get("accessPolicy").isAuthorized("changePermission")
            );
          }
        }
      },

      downloadFile(e) {
        this.downloadButtonView.download(e);
      },

      // Member row metrics for the package table
      // Retrieving information from the Metrics Model's result details
      getMemberRowMetrics(id) {
        if (typeof this.metricsModel !== "undefined") {
          const metricsResultDetails = this.metricsModel.get("resultDetails");

          if (
            typeof metricsResultDetails !== "undefined" &&
            metricsResultDetails
          ) {
            const metricsPackageDetails =
              metricsResultDetails.metrics_package_counts;

            const objectLevelMetrics = metricsPackageDetails[id];
            if (typeof objectLevelMetrics !== "undefined") {
              if (this.isMetadata) {
                var reads = objectLevelMetrics.viewCount;
              } else {
                var reads = objectLevelMetrics.downloadCount;
              }
            } else {
              var reads = 0;
            }
          } else {
            var reads = 0;
          }
        }

        if (typeof reads !== "undefined" && reads) {
          // giving labels
          if (this.isMetadata && reads == 1) reads += " view";
          else if (this.isMetadata) reads += " views";
          else if (reads == 1) reads += " download";
          else reads += " downloads";
        } else {
          // returning an empty string if the metrics are 0
          reads = "";
        }

        return reads;
      },
    },
  );

  return DataItemView;
});
