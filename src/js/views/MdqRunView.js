/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'DonutChart', 'views/CitationView', 'text!templates/mdqRun.html', 'text!templates/mdqSuites.html', 'text!templates/loading.html'],
	function($, _, Backbone, d3, DonutChart, CitationView, MdqRunTemplate, SuitesTemplate, LoadingTemplate) {
	'use strict';

	// Build the Footer view of the application
	var MdqRunView = Backbone.View.extend({

		el: '#Content',

		events: {
			"click input[type='submit']"	:	"submitForm",
			"change #suiteId" : "switchSuite"
		},

		url: null,

		pid: null,

		suiteId: null,

		loadingTemplate: _.template(LoadingTemplate),

		template: _.template(MdqRunTemplate),

		suitesTemplate: _.template(SuitesTemplate),


		initialize: function () {

		},

		switchSuite: function(event) {

			var select = $(event.target);

			var suiteId = $(select).val();
            
            console.log("setting suiteId to : " + suiteId);
            //MetacatUI.appModel.set("mdqSuiteId", suiteId);
			MetacatUI.uiRouter.navigate("quality/s=" + suiteId + "/" + this.pid, {trigger: true});

			return false;
		},

		render: function () {

			// use the default suite id 
            if (!this.suiteId) {
                this.suiteId = MetacatUI.appModel.get("mdqSuiteId");
            }
            console.log("current suiteId: " + this.suiteId);
            
			//this.url = this.mdqRunsServiceUrl + "/" + this.suiteId + "/" + this.pid;

			var viewRef = this;

			if (this.pid) {
				this.showLoading();
                this.fetchReport();
				
			} else {
				this.$el.html(this.template({}));
			}

		},

		showLoading: function() {
			this.$el.html(this.loadingTemplate({ msg: "Retreiving quality report..."}));
		},
        
        hideLoading: function() {
            if(this.$loading)  this.$loading.remove();
            if(this.$detached) this.$el.html(this.$detached);
        },

		showCitation: function(){
			if(!this.citationView) return false;

			this.$("#mdqCitation").prepend(this.citationView.el);
		},

		show: function() {
			var view = this;
			this.$el.hide();
			this.$el.fadeIn({duration: "slow"});
		},

		// lookup the suites we can run
		showAvailableSuites: function() {
			var viewRef = this;

			try {
				var args = {
						url: MetacatUI.appModel.get("mdqSuitesServiceUrl"),
					    type: 'GET',
                        header: 'Accept: application/json',
						success: function(data, textStatus, xhr) {
							viewRef.$el.find('#suites').append(
									viewRef.suitesTemplate(
											{
												suiteId: viewRef.suiteId,
												suiteIds: data
											}));
							//Initialize all popover elements
							//$('.popover-this').popover();
						}
				};
                console.log("suites url: " + MetacatUI.appModel.get("mdqSuitesServiceUrl"))
				$.ajax(args);
			} catch (error) {
				console.log(error.stack);
			}
		},

		submitForm: function(event) {

			var form = $(event.target).parents("form");

			var formData = new FormData($(form)[0]);

			this.fetchReport(formData);

			return false;

		},
        
        
        // Fetch a quality report from the quality server and display it.
        sendReportRequest: function(formData) {
            var viewRef = this;

            try {
                var suitesUrl = MetacatUI.appModel.get("mdqSuitesServiceUrl") + viewRef.suiteId + "/run";
                console.log("quality suites url: " + suitesUrl);
                var args = {
                    url: suitesUrl,
                    cache: false,
                    data: formData,
                    contentType: false, //"multipart/form-data",
                    processData: false,
                    type: 'POST',
                    success: function(data, textStatus, jqXHR) {  
                        console.log("Sent quality report generation request");
                        viewRef.hideLoading();
                        var msgText = "A quality report is not yet available for this dataset, so";
                        msgText += " one will be generated automatically. Please try again later.";
                        MetacatUI.uiRouter.navigate("#view" + "/" + viewRef.pid, {trigger: true});
                        var message = $(document.createElement("div")).append($(document.createElement("span")).text(msgText));
                        MetacatUI.appView.showAlert(message, "alert-success", "body", 10000, {remove: true});
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        viewRef.hideLoading();
                        var msgText = "A quality report is not yet available for this dataset, and";
                        msgText += " there was a problem attempting to generate one automatically: "; 
                        msgText += errorThrown;
                        MetacatUI.uiRouter.navigate("#view" + "/" + viewRef.pid, {trigger: true});
                        var message = $(document.createElement("div")).append($(document.createElement("span")).text(msgText));
                        MetacatUI.appView.showAlert(message, "alert-errors", "body", 10000, {remove: true});
                        console.log("Error sending quality report generation request: " + errorThrown);
                    }
                };
                console.log("Sending quality suites request");
                $.ajax(args);
            } catch (error) {
                console.log(error.stack);
            }
        },
        
        // Send a request to generate a quality report.
        prepareReportRequest: function() {
            var viewRef = this;

            // fetch SystemMetadata		
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200){
                    //this.response contains the returned system metadata
                    var sysMetaBlob = this.response;
                    
                    // fetch the metadata contents by the pid
                    var xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function() {
                        if (this.readyState == 4 && this.status == 200){
                            // this.response contains the fetched D1 object data (metadata)
                            var documentBlob = this.response;
                            console.log("Got sysmeta, obj, now send new report request...");
                            // send to MDQ as blob
                            var formData = new FormData();
                            formData.append('document', documentBlob);
                            formData.append('systemMetadata', sysMetaBlob);
                            viewRef.sendReportRequest(formData);    
                        }
                    }
                    console.log("Getting metadata object for pid: " + viewRef.pid);
                    var url = MetacatUI.appModel.get("objectServiceUrl") + viewRef.pid;
                    xhr.open('GET', url);
                    xhr.responseType = 'blob';
                    xhr.withCredentials = true;
                    xhr.setRequestHeader("Authorization", "Bearer " + MetacatUI.appUserModel.get("token"));
                    xhr.send();
    
                    //Render a Citation View for the page header
                    var citationView = new CitationView({ pid: viewRef.pid });
                    citationView.render();
                    viewRef.citationView = citationView;
                } 
            }
            console.log("Getting sysmeta for pid: " + viewRef.pid);
            var url = MetacatUI.appModel.get("metaServiceUrl") + this.pid;
            xhr.open('GET', url);
            xhr.responseType = 'blob';
            xhr.withCredentials = true;
            xhr.setRequestHeader("Authorization", "Bearer " + MetacatUI.appUserModel.get("token"));
            xhr.send();
        },
        
        
    	// Fetch a quality report from the quality server and display it.
        fetchReport: function() {
        	var viewRef = this;

        	try {
        		var qualityUrl = MetacatUI.appModel.get("mdqRunsServiceUrl") + viewRef.suiteId + "/" + viewRef.pid;
                console.log("quality url: " + qualityUrl);
        		var args = {
        			url: qualityUrl,
        			cache: false,
        			contentType: false, //"multipart/form-data",
        			processData: false,
        			type: 'GET',
                    //headers: { 'Access-Control-Allow-Origin': 'http://localhost:8081' },
                    headers: { 'Accept': 'application/json'},
        			success: function(data, textStatus, xhr) {
                        // Inspect the results to see if a quality report was returned.
                        // If not, then submit a request to the quality engine to create the
                        // quality report for this pid/suiteId, and inform the user of this.
                        if(!data.result) {
                            console.log("hey have to submit a quality report request.");
                        } else {
                            var groupedResults = viewRef.groupResults(data.result);
                            var groupedByType = viewRef.groupByType(data.result);

                            data = _.extend(data,
                                {
                                    objectIdentifier: viewRef.pid,
                                    suiteId: viewRef.suiteId,
                                    groupedResults: groupedResults,
                                    groupedByType: groupedByType
                                });

                            viewRef.$el.html(viewRef.template(data));
                            viewRef.drawScoreChart(data.result, groupedResults);
                            viewRef.showAvailableSuites();
                            viewRef.showCitation();
                            viewRef.show();
                            //Initialize all popover elements
                            viewRef.$('.popover-this').popover();
        				} 
                    },
                    error: function(data) {
                        viewRef.prepareReportRequest();
                    }
        		};
        		$.ajax(args);
        	} catch (error) {
        		console.log(error.stack);
        	}
        },
        
		groupResults: function(results) {
			var groupedResults = _.groupBy(results, function(result) {
				var color;

				// simple cases
				// always blue for info and skip
				if (result.check.level == 'INFO') {
					color = 'BLUE';
					return color;
				}
				if (result.status == 'SKIP') {
					color = 'BLUE';
					return color;
				}
				// always green for success
				if (result.status == 'SUCCESS') {
					color = 'GREEN';
					return color;
				}

				// handle failures and warnings
				if (result.status == 'FAILURE') {
					color = 'RED';
					if (result.check.level == 'OPTIONAL') {
						color = 'ORANGE';
					}
				}
				if (result.status == 'ERROR') {
					color = 'ORANGE';
					if (result.check.level == 'REQUIRED') {
						color = 'RED';
					}
				}
				return color;

			});

			// make sure we have everything, even if empty
			if (!groupedResults.BLUE) {
				groupedResults.BLUE = [];
			}
			if (!groupedResults.GREEN) {
				groupedResults.GREEN = [];
			}
			if (!groupedResults.ORANGE) {
				groupedResults.ORANGE = [];
			}
			if (!groupedResults.RED) {
				groupedResults.RED = [];
			}

			var total = results.length;
			if (groupedResults.BLUE) {
				total = total - groupedResults.BLUE.length;
			}

			return groupedResults;
		},

		groupByType: function(results) {
			var groupedResults = _.groupBy(results, function(result) {
				if (result.status == "ERROR" || result.status == "SKIP") {
					// orange or blue
					return "removeMe";
				}
				if (result.status == "FAILURE" && result.check.level == "OPTIONAL") {
					// orange
					return "removeMe";
				}

				return result.check.type || "uncategorized";
			});

			// get rid of the ones that should not be counted in our totals
			delete groupedResults["removeMe"];

			return groupedResults;
		},

		drawScoreChart: function(results, groupedResults){

			var dataCount = results.length;


			var data = [
			            {label: "Pass", count: groupedResults.GREEN.length, perc: groupedResults.GREEN.length/results.length },
			            {label: "Warn", count:  groupedResults.ORANGE.length, perc: groupedResults.ORANGE.length/results.length},
			            {label: "Fail", count: groupedResults.RED.length, perc: groupedResults.RED.length/results.length},
			            {label: "Info", count: groupedResults.BLUE.length, perc: groupedResults.BLUE.length/results.length},
			        ];
			/*
			var data = [
			            "Pass", groupedResults.GREEN.length,
			            "Warning", groupedResults.ORANGE.length,
			            "Fail", groupedResults.RED.length,
			            "Info", groupedResults.BLUE.length,
			        ];
			 */

			var svgClass = "data";

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-data').html("<h2 class='" + svgClass + " fallback'>" + MetacatUI.appView.commaSeparateNumber(dataCount) + " data files</h2>");

				return;
			}

			//Draw a donut chart
			var donut = new DonutChart({
							id: "data-chart",
							data: data,
							total: dataCount,
							titleText: "checks",
							titleCount: dataCount,
							svgClass: svgClass,
							countClass: "data",
							height: 250,
							width: 250,
							keepOrder: true,
							formatLabel: function(name) {
								return name;
							}
						});
			this.$('.format-charts-data').html(donut.render().el);
		}

	});
	return MdqRunView;
});
