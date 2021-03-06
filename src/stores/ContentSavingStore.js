import AppDispatcher from '../app-dispatcher';
var Immutable = require('immutable');
var MicroEvent = require('microevent');
var ContentStore = require('./ContentStore');
var ConfigurationStore = require('./ConfigurationStore');
var qwest = require('qwest');
var ContentActionsEventIDs = require('../actions/ContentActionsEventIDs');
var documentSectionEventIDs = ContentActionsEventIDs.documentSection;


var documentSectionActivity = Immutable.Map({});

var ContentSavingStore = {
	on: MicroEvent.prototype.bind,
	trigger: MicroEvent.prototype.trigger,
	off: MicroEvent.prototype.unbind
};


var isSavingContentForDocumentSection = function(documentID, sectionID) {
	var isSaving = documentSectionActivity.getIn([documentID, sectionID, 'isSaving'], false);
	return isSaving;
};
ContentSavingStore.isSavingContentForDocumentSection = isSavingContentForDocumentSection;
	
var setSavingContentForDocumentSection = function(documentID, sectionID, isSaving) {
	var isSavingCurrent = isSavingContentForDocumentSection(documentID, sectionID);
	if (isSavingCurrent === isSaving) {
		return;
	}
	
	documentSectionActivity = documentSectionActivity.setIn([documentID, sectionID, 'isSaving'], isSaving);
	
	ContentSavingStore.trigger('isSavingDidChangeForDocumentSection', documentID, sectionID, isSaving);
	//ContentSavingStore.trigger('isSavingDidChangeForDocument', documentID, isSaving);
};
	
var saveContentForDocumentSection = function(documentID, sectionID) {
	var isSaving = isSavingContentForDocumentSection(documentID, sectionID);
	if (isSaving) {
		return;
	}
	
	var actionURL = ConfigurationStore.getActionURL();
	var actionsFunctions = ConfigurationStore.getActionsFunctions();
	if (!actionURL && !actionsFunctions) {
		return;
	}
	
	setSavingContentForDocumentSection(documentID, sectionID, true);
	
	var contentJSON = ContentStore.getContentAsJSONForDocumentSection(documentID, sectionID);
	
	if (actionURL) {
		qwest.post(actionURL + documentID + '/', {
			sectionID: sectionID,
			contentJSON: contentJSON
		}, {
			dataType: 'json',
			responseType: 'json'
		})
		.then(function(response) {
		
		})
		.catch(function(message) {
			ContentSavingStore.trigger('saveContentDidFailForDocumentSectionWithMessage', documentID, sectionID, message);
		})
		.complete(function() {
			setSavingContentForDocumentSection(documentID, sectionID, false);
		});
	}
	else {
		if (actionsFunctions.saveContentJSONForDocumentSection) {
			actionsFunctions.saveContentJSONForDocumentSection(
				documentID, sectionID, contentJSON
			);
		}
		else {
			console.error("Icing actions functions must include 'saveContentJSONForDocumentSection'.");
		}
	}
};
ContentSavingStore.saveContentForDocumentSection = saveContentForDocumentSection;


AppDispatcher.register( function(payload) {
	switch (payload.eventID) {
		
	case (documentSectionEventIDs.saveChanges):
		saveContentForDocumentSection(payload.documentID, payload.sectionID);
		break;
	
	}
});

module.exports = ContentSavingStore;