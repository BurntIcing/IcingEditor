/**
	Copyright 2015 Patrick George Wyndham Smith
*/

let AppDispatcher = require('../app-dispatcher');
let Immutable = require('immutable');
let MicroEvent = require('microevent');
let objectAssign = require('object-assign');
let ConfigurationStore = require('./ConfigurationStore');
let SpecsStore = require('./SpecsStore');

//let ContentActions = require('../actions/ContentActions');

let ContentActionsEventIDs = require('../actions/ContentActionsEventIDs');
var documentEventIDs = ContentActionsEventIDs.document;
let documentSectionEventIDs = ContentActionsEventIDs.documentSection;


//TODO: renamed Subsection to Portion?


//let defaultSpecsURL = 'http://www.burnticing.org/specs/default/1.0/default-1.0.json';
let defaultSpecsURL = 'http://burnticing.github.io/specs/default/1.0/default-1.0.json';


let getIndexForObjectKeyPath = function(keyPath) {
	return keyPath[keyPath.length - 1];
};

let getParentKeyPath = function(keyPath) {
	return keyPath.slice(0, -1);
};

let getObjectKeyPathWithIndexChange = function(keyPath, changeCallback) {
	let index = getIndexForObjectKeyPath(keyPath);
	return getParentKeyPath(keyPath).concat(changeCallback(index));
};

let getBlocksKeyPath = function() {
	return ['blocks'];
};

let getBlockKeyPathForItemKeyPath = function(itemKeyPath) {
	return itemKeyPath.slice(0, -2);
};


let ContentStore = {}

ContentStore.on = MicroEvent.prototype.bind;
ContentStore.trigger = MicroEvent.prototype.trigger;
ContentStore.off = MicroEvent.prototype.unbind;



let documentCombinedSpecs = Immutable.Map();
let documentSectionContents = Immutable.Map();
let documentSectionEditedTextItemIdentifiers =  Immutable.Map();

function newIdentifier() {
	return 'i-' + (Math.random().toString().replace('0.', ''));
}

function getContentKeyPathForDocumentSection(documentID, sectionID, additionalKeyPath) {
	let keyPath = [documentID, 'sections', sectionID];
	if (additionalKeyPath) {
		keyPath = keyPath.concat(additionalKeyPath);
	}
	return keyPath;
}

function getContentForDocumentSection(documentID, sectionID) {
	return documentSectionContents.getIn(getContentKeyPathForDocumentSection(documentID, sectionID));
}

function getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, keyPath) {
	return documentSectionContents.getIn(getContentKeyPathForDocumentSection(documentID, sectionID, keyPath));
}

function setContentFromImmutableForDocumentSection(documentID, sectionID, content) {
	documentSectionContents = documentSectionContents.setIn(getContentKeyPathForDocumentSection(documentID, sectionID), content);
	
	ContentStore.trigger('contentChangedForDocumentSection', documentID, sectionID);
}

function prepareContentFromJSON(contentJSON) {
	return Immutable.fromJS(contentJSON, function(key, value) {
		var isIndexed = Immutable.Iterable.isIndexed(value);
		var newValue = isIndexed ? value.toList() : value.toMap();
		
		if ((key === 'blocks') || (key === 'textItems')) {
			newValue = newValue.map(function(item) {
				if (!item.has('identifier')) {
					item = item.set('identifier', newIdentifier());
				}
				return item;
			});
		}
		
		return newValue;
	});
}

function setContentFromJSONForDocumentSection(documentID, sectionID, contentJSON) {
	let content = null;
	if (contentJSON) {
		content = prepareContentFromJSON(contentJSON);
	}
	setContentFromImmutableForDocumentSection(documentID, sectionID, content);
}

function updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, keyPath, updater,
	{trigger = true} = {}
) {
	var fullKeyPath = getContentKeyPathForDocumentSection(documentID, sectionID, keyPath);
	documentSectionContents = documentSectionContents.updateIn(fullKeyPath, updater);

	if (trigger) {
		ContentStore.trigger('contentChangedForDocumentSection', documentID, sectionID);
	}
}

function getSpecsURLsForDocumentWithID(documentID) {
	let specsURLs = documentSectionContents.getIn([documentID, 'specsURLs']);
	if (specsURLs) {
		return specsURLs.toArray();
	}
	else {
		return null;
	}
}

function setSpecsURLsForDocumentWithID(documentID, specsURLs) {
	// Removed cached specs, which might have been combined from the URLs.
	documentCombinedSpecs = documentCombinedSpecs.remove(documentID);
	
	if (specsURLs) {
		specsURLs = Immutable.fromJS(specsURLs);
		specsURLs = specsURLs.filter(function(specsURL) {
			return typeof specsURL === 'string' && specsURL.trim() !== '';
		});
		documentSectionContents = documentSectionContents.setIn([documentID, 'specsURLs'], specsURLs);
	}
	else {
		documentSectionContents = documentSectionContents.removeIn([documentID, 'specsURLs']);
	}
	
	ContentStore.trigger('specsChangedForDocument', documentID);
}

function getSpecsForDocumentSection(documentID, sectionID) {
	var specs = documentCombinedSpecs.get(documentID);
	if (!specs) {
		let specsURLs = getSpecsURLsForDocumentWithID(documentID);
		
		if (!specsURLs) {
			if (true) {
				let defaultSpecs = SpecsStore.getSpecWithURL(defaultSpecsURL);
				if (!defaultSpecs) {
					var defaultSpecsJSON = require('../dummy/dummy-content-specs.json');
					defaultSpecs = Immutable.fromJS(defaultSpecsJSON);
					SpecsStore.setContentForSpecWithURL(defaultSpecsURL, defaultSpecs);
				}
			}
			specsURLs = [defaultSpecsURL];
		}
		else if (specsURLs.length === 0) {
			return null;
		}
		
		if (!SpecsStore.hasLoadedAllSpecsWithURLs(specsURLs)) {
			specsURLs.forEach(specsURL => {
				SpecsStore.loadSpecWithURL(specsURL);
			});
			return null;
		}
		
		specs = SpecsStore.getCombinedSpecsWithURLs(specsURLs);
		documentCombinedSpecs = documentCombinedSpecs.set(documentID, specs);
	}
	return specs;
}

// SETTINGS

var isShowingSettings = false;

function getIsShowingSettings() {
	return isShowingSettings;
}

function setShowSettingsOn(on) {
	if (isShowingSettings === on) {
		return;
	}
	
	isShowingSettings = on;
	ContentStore.trigger('isShowingSettingsDidChange', isShowingSettings);
}



objectAssign(ContentStore, {
	documentSectionContents,
	documentSectionEditedTextItemIdentifiers,
	
	/*
	newContentForTextItems: function() {
		return Immutable.Map({
			"type": "textItems",
			"blocks": Immutable.List([
				this.newBlockOfType('text', 'body')
			])
		});
	},
	*/
	
	newTextItem: function(options) {
		var textItem = Immutable.Map({
			"type": "text",
			"identifier": newIdentifier(),
			"traits": Immutable.Map(),
            "text": ""
		});
		if (options) {
			textItem = textItem.merge(options);
		}
		
		return textItem;
	},
	
	newLineBreakTextItem: function() {
		var textItem = Immutable.Map({
			"type": "lineBreak",
			"identifier": newIdentifier()
		});
		
		return textItem;
	},
	
	blockGroupTypeHasTextItems: function(blockGroupType) {
		return (blockGroupType === 'text');
	},
	
	newBlockOfType: function(typeGroup, type) {
		var blockJSON = {
			"typeGroup": typeGroup,
			"type": type,
			"identifier": newIdentifier()
		};
		
		if (this.blockGroupTypeHasTextItems(typeGroup)) {
			blockJSON.textItems = Immutable.List();
		}
		
		return Immutable.Map(blockJSON);
	},
	
	newBlockWithSameTypeAs: function(block) {
		return this.newBlockOfType(block.get('typeGroup'), block.get('type'));
	},
	
	newTextBlockWithDefaultType: function() {
		return this.newBlockOfType('text', 'body');
	},
	
	newBlockSubsectionOfType: function(subsectionType) {
		return Immutable.Map({
			"typeGroup": "subsection",
			"type": subsectionType,
			"identifier": newIdentifier()
		});
	},
	
	blockKeyPathForItemKeyPath: getBlockKeyPathForItemKeyPath,
	
	
	getIsShowingSettings,
	
	getSpecsURLsForDocumentWithID,
	getSpecsForDocumentSection,
	
	getContentForDocumentSection,
	
	getContentAsJSONForDocumentSection: function(documentID, sectionID) {
		var content = this.getContentForDocumentSection(documentID, sectionID);
		if (content) {
			return content.toJS();
		}
		else {
			return null;
		}
	},
	
	getContentObjectAtKeyPathForDocumentSection,
	
	getIdentifierOfObjectAtKeyPathForDocumentSection: function(documentID, sectionID, keyPath) {
		return this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, keyPath.concat('identifier'));
	},
	
	getNumberOfBlocksForDocumentSection: function(documentID, sectionID, keyPath) {
		let blocksKeyPath = getBlocksKeyPath();
		let blocks = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blocksKeyPath);
		if (blocks) {
			return blocks.size;
		}
		else {
			return null;
		}
	},
	
	// UPDATING
	
	updateBlockAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath, updater, options) {
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, keyPath, updater, options);
	},
	
	removeBlockAtKeyPathInDocumentSection: function(documentID, sectionID, blockKeyPath,
		{finishEditing = false, editPrevious = false} = {}
	) {
		var editedBlockKeyPath = this.getEditedBlockKeyPathForDocumentSection(documentID, sectionID);
		var isEditingThisBlock = (editedBlockKeyPath == blockKeyPath);
		if (isEditingThisBlock || finishEditing) {
			this.finishEditingInDocumentSection(documentID, sectionID);
		}
		
		var blockIndex = blockKeyPath.slice(-1)[0];
		var blocksKeyPath = blockKeyPath.slice(0, -1);
		
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blocksKeyPath, function(blocks) {
			return blocks.remove(blockIndex);
		});
		
		if (editPrevious) {
			var precedingBlockIndex = blockIndex - 1;
			var precedingBlockKeyPath = blocksKeyPath.concat(precedingBlockIndex);
			this.editBlockWithKeyPathInDocumentSection(documentID, sectionID, precedingBlockKeyPath);
		}
		
		//this.trigger('contentChangedForDocumentSection', documentID, sectionID);
	},
	
	updateTextItemAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath, updater, options) {
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, keyPath, updater, options);
	},
	
	textItemIsEmptyAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath) {
		var text = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, keyPath.concat('text'));
		var isEmpty = (!text || text.length === 0);
		return isEmpty;
	},
	
	removeTextItemAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath) {
		var itemIndex = keyPath.slice(-1)[0];
		var textItemsKeyPath = keyPath.slice(0, -1);
		
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, textItemsKeyPath, function(textItems) {
			return textItems.remove(itemIndex);
		});
	},
	
	insertItemAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath, item, options) {
		var insertIndex = keyPath.slice(-1)[0];
		var textItemsKeyPath = keyPath.slice(0, -1); // Without the index
		
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, textItemsKeyPath, function(textItems) {
			// Insert the item.
			return textItems.splice(insertIndex, 0, item);
		});
		
		if (options && options.edit) {
			var newItemKeyPath = textItemsKeyPath.concat(insertIndex);
			this.editItemWithKeyPathInDocumentSection(documentID, sectionID, newItemKeyPath);
		}
	},
	
	insertItemAfterItemAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath, item, options) {
		var textItemIndex = keyPath.slice(-1)[0];
		var textItemsKeyPath = keyPath.slice(0, -1);
		
		var newItemIndex = textItemIndex + 1;
		
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, textItemsKeyPath, function(textItems) {
			// Insert the item.
			return textItems.splice(newItemIndex, 0, item);
		});
		
		if (options && options.edit) {
			var newItemKeyPath = textItemsKeyPath.concat(newItemIndex);
			this.editItemWithKeyPathInDocumentSection(documentID, sectionID, newItemKeyPath);
		}
	},
	
	addNewItemAfterItemAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath, options) {
		var newTextItem = this.newTextItem();
		this.insertItemAfterItemAtKeyPathInDocumentSection(documentID, sectionID, keyPath, newTextItem, options);
	},
	
	addLineBreakAfterItemAtKeyPathInDocumentSection: function(documentID, sectionID, keyPath, options) {
		var item = this.newLineBreakTextItem();
		this.insertItemAfterItemAtKeyPathInDocumentSection(documentID, sectionID, keyPath, item, options);
	},
	
	insertBlockAtKeyPathInDocumentSection: function(documentID, sectionID,
		keyPath, block, {edit = false, editFirstItem = null, editLastItem = null} = {}
	) {
		var insertIndex = keyPath.slice(-1)[0];
		var blocksKeyPath = keyPath.slice(0, -1); // Without the index
		
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blocksKeyPath, function(blocks) {
			// Insert the item.
			return blocks.splice(insertIndex, 0, block);
		});
		
		if (edit) {
			var newBlockKeyPath = blocksKeyPath.concat(insertIndex);
			this.editBlockWithKeyPathInDocumentSection(documentID, sectionID,
				newBlockKeyPath, {editFirstItem, editLastItem}
			);
		}
	},
	
	insertSubsectionOfTypeAtBlockIndexInDocumentSection: function(documentID, sectionID,
		subsectionType, blockIndex, {editFollowingBlock = false} = {}
	) {
		let blocksKeyPath = getBlocksKeyPath();
		var blockKeyPath = blocksKeyPath.concat(blockIndex);
		var subsectionBlock = this.newBlockSubsectionOfType(subsectionType);
		this.insertBlockAtKeyPathInDocumentSection(documentID, sectionID, blockKeyPath, subsectionBlock);
		
		if (editFollowingBlock) {
			let followingBlockIndex = blockIndex + 1;
			let followingBlockKeyPath = blocksKeyPath.concat(followingBlockIndex);
			console.log('followingBlockIndex', 'getNumberOfBlocks', this.getNumberOfBlocksForDocumentSection(documentID, sectionID));
			if (followingBlockIndex < this.getNumberOfBlocksForDocumentSection(documentID, sectionID)) {
				this.editBlockWithKeyPathInDocumentSection(documentID, sectionID, followingBlockKeyPath);
			}
			else {
				let newBlock = this.newTextBlockWithDefaultType();
				this.insertBlockAtKeyPathInDocumentSection(documentID, sectionID, followingBlockKeyPath, newBlock, {edit: true});
			}
		}
	},
	
	changeTypeOfBlockAtKeyPathInDocumentSection: function(documentID, sectionID, blockKeyPath, newBlockTypeGroup, newBlockType) {
		let hasDifferentTypeGroup = true;
		
		var editedBlockKeyPath = this.getEditedBlockKeyPathForDocumentSection(documentID, sectionID);
		if (editedBlockKeyPath && this.blockGroupTypeHasTextItems(newBlockTypeGroup)) {
			var block = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath);
			if (this.blockGroupTypeHasTextItems(block.get('typeGroup'))) {
				hasDifferentTypeGroup = false;
			}
		}
		
		if (hasDifferentTypeGroup) {
			// Finish editing, as changing to a different type may edit in a different way.
			this.finishEditingInDocumentSection(documentID, sectionID);
		}
		
		ContentStore.updateBlockAtKeyPathInDocumentSection(documentID, sectionID, blockKeyPath, function(block) {
			return block.withMutations(function(mutableBlock) {
				mutableBlock.set('typeGroup', newBlockTypeGroup);
				mutableBlock.set('type', newBlockType);
				
				if (!ContentStore.blockGroupTypeHasTextItems(newBlockTypeGroup)) {
					mutableBlock.remove('textItems');
				}
			});
		});
		
		if (editedBlockKeyPath && hasDifferentTypeGroup) {
			this.editBlockWithKeyPathInDocumentSection(documentID, sectionID, editedBlockKeyPath);
		}
	},
	
	changeTypeOfSubsectionAtKeyPathInDocumentSection: function(documentID, sectionID, subsectionKeyPath, newSubsectionType) {
		ContentStore.updateBlockAtKeyPathInDocumentSection(documentID, sectionID, subsectionKeyPath, function(block) {
			return block.set('type', newSubsectionType);
		});
	},
	
	insertBlockAfterBlockAtKeyPathInDocumentSection: function(documentID, sectionID, blockKeyPath, block, options) {
		let newBlockKeyPath = getObjectKeyPathWithIndexChange(blockKeyPath, function(originalIndex) {
			return originalIndex + 1;
		});
		
		this.insertBlockAtKeyPathInDocumentSection(documentID, sectionID, newBlockKeyPath, block, options);
	},
	
	moveBlockAtKeyPathToBeforeBlockAtIndexInDocumentSection: function(documentID, sectionID, blockKeyPath, newIndex, options) {
		let blocksKeyPath = getParentKeyPath(blockKeyPath);
		let blockOriginalIndex = getIndexForObjectKeyPath(blockKeyPath);
		
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blocksKeyPath, function(blocks) {
			let blockToMove = blocks.get(blockOriginalIndex);
			blocks = blocks.remove(blockOriginalIndex);
			if (blockOriginalIndex < newIndex) {
				newIndex -= 1;
			}
			blocks = blocks.splice(newIndex, 0, blockToMove);
			
			return blocks;
		});
	},
	
	insertBlockOfTypeAtIndexInDocumentSection: function(documentID, sectionID, typeGroup, type, blockIndex, options) {
		let newBlock = this.newBlockOfType(typeGroup, type);
		
		let blocksKeyPath = getBlocksKeyPath();
		var blockKeyPath = blocksKeyPath.concat(blockIndex);
		
		this.insertBlockAtKeyPathInDocumentSection(documentID, sectionID, blockKeyPath, newBlock, options);
	},
	
	insertRelatedBlockAfterBlockAtKeyPathInDocumentSection: function(documentID, sectionID, blockKeyPath, options) {
		var currentBlock = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath);
		var newBlock = this.newBlockWithSameTypeAs(currentBlock);
		
		this.insertBlockAfterBlockAtKeyPathInDocumentSection(documentID, sectionID, blockKeyPath, newBlock, options);
	},
	
	insertRelatedTextItemBlocksAfterBlockAtKeyPathWithPastedTextInDocumentSection(documentID, sectionID, blockKeyPath, pastedText, options) {
		pastedText = pastedText.replace(/\r\n/g, "\n");
		let textParagraphs = pastedText.split("\n");
		let whiteSpaceRE = /^[\s\n]+$/;
		textParagraphs = textParagraphs.filter(function(paragraphText) {
			if (whiteSpaceRE.test(paragraphText)) {
				return false;
			}
			
			return true;
		});
		
		var currentBlock = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath);
		
		let newBlocks = textParagraphs.map(function(paragraphText) {
			let textItem = this.newTextItem({text: paragraphText});
			let block = this.newBlockWithSameTypeAs(currentBlock);
			block = block.set('textItems', Immutable.List([textItem]));
			return block;
		}, this);
		
		var sourceIndex = blockKeyPath.slice(-1)[0];
		var insertIndex = sourceIndex + 1;
		var blocksKeyPath = blockKeyPath.slice(0, -1); // Without the index
		
		updateContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blocksKeyPath, function(blocks) {
			// Insert the blocks.
			return blocks.splice.bind(blocks, insertIndex, 0).apply(blocks, newBlocks);
		});
		
		if (options && options.edit) {
			let insertedBlockCount = newBlocks.length;
			var lastBlockKeyPath = blocksKeyPath.concat(insertIndex + insertedBlockCount - 1);
			this.editBlockWithKeyPathInDocumentSection(documentID, sectionID, lastBlockKeyPath);
		}
	},
	
	splitBlockBeforeItemAtKeyPathInDocumentSection: function(documentID, sectionID, itemKeyPath) {
		var blockKeyPath = getBlockKeyPathForItemKeyPath(itemKeyPath);
		var currentBlock = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath);
		
		var textItemIndex = itemKeyPath.slice(-1)[0];
		
		var followingItems = [];
		this.updateBlockAtKeyPathInDocumentSection(documentID, sectionID, blockKeyPath, function(block) {
			var textItems = block.get('textItems');
			var precedingItems = textItems.slice(0, textItemIndex);
			followingItems = textItems.slice(textItemIndex);
			
			block = block.set('textItems', precedingItems);
			return block;
		});
		
		var followingBlock = this.newBlockWithSameTypeAs(currentBlock);
		followingBlock = followingBlock.set('textItems', followingItems);
		
		this.insertBlockAfterBlockAtKeyPathInDocumentSection(documentID, sectionID,
			blockKeyPath, followingBlock, {edit: true, editFirstItem: true}
		);
	},
	
	joinBlockAtKeyPathWithPreviousInDocumentSection: function(documentID, sectionID, currentBlockKeyPath) {
		var currentBlockIndex = currentBlockKeyPath.slice(-1)[0];
		var currentBlock = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, currentBlockKeyPath);
		
		var currentBlockGroupType = currentBlock.get('typeGroup');
		if (currentBlockIndex === 0 || !this.blockGroupTypeHasTextItems(currentBlockGroupType)) {
			return false;
		}
		
		var precedingBlockIndex = currentBlockIndex - 1;
		var precedingBlockKeyPath = currentBlockKeyPath.slice(0, -1).concat(precedingBlockIndex);
		var precedingBlock = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, precedingBlockKeyPath);
		
		var precedingBlockGroupType = precedingBlock.get('typeGroup');
		if (!this.blockGroupTypeHasTextItems(precedingBlockGroupType)) {
			return false;
		}
		
		var followingTextItems = currentBlock.get('textItems');
		var precedingTextItems = precedingBlock.get('textItems');
		
		this.updateBlockAtKeyPathInDocumentSection(documentID, sectionID, precedingBlockKeyPath, function(block) {
			return block.update('textItems', function(textItems) {
				return textItems.concat(followingTextItems);
			});
		});
		
		this.removeBlockAtKeyPathInDocumentSection(documentID, sectionID, currentBlockKeyPath);
		
		var itemKeyPath = precedingBlockKeyPath.concat('textItems', precedingTextItems.count());
		this.editItemWithKeyPathInDocumentSection(documentID, sectionID, itemKeyPath);
	},
	
	joinItemAtKeyPathWithPreviousInDocumentSection: function(documentID, sectionID, itemKeyPath) {
		var itemIndex = itemKeyPath.slice(-1)[0];
		if (itemIndex === 0) {
			var blockKeyPath = getBlockKeyPathForItemKeyPath(itemKeyPath);
			this.joinBlockAtKeyPathWithPreviousInDocumentSection(documentID, sectionID, blockKeyPath);
		}
		else {
			var precedingItemIndex = itemIndex - 1;
			var precedingItemKeyPath = itemKeyPath.slice(0, -1).concat(precedingItemIndex);
			var precedingItem = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, precedingItemKeyPath);
			var followingItem = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, itemKeyPath);
			
			var precedingText = precedingItem.get('text');
			var followingText = followingItem.get('text');
			var combinedText = precedingText + followingText;
			this.updateTextItemAtKeyPathInDocumentSection(documentID, sectionID, precedingItemKeyPath, function(textItem) {
				return textItem.set('text', combinedText);
			});
			
			this.removeTextItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath);
			this.editItemWithKeyPathInDocumentSection(documentID, sectionID, precedingItemKeyPath);
		}
	},
	
	splitTextInRangeOfItemAtKeyPathInDocumentSection: function(documentID, sectionID, textSplitRange, itemKeyPath, insertedItem) {
		var splitStart = textSplitRange.start;
		var splitEnd = textSplitRange.end;
		
		var currentItem = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, itemKeyPath);
		var currentText = currentItem.get('text');
		var currentItemIndex = getIndexForObjectKeyPath(itemKeyPath);
		var textItemsKeyPath = getParentKeyPath(itemKeyPath);
		
		// Just a caret
		if (splitStart === splitEnd) {
			var itemAText = currentText.slice(0, splitStart);
			var itemBText = currentText.slice(splitStart);
			
			if (itemAText === '') {
				return;
			}
			
			this.updateTextItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath, function(textItem) {
				return textItem.set('text', itemAText);
			});
			
			// TODO: Used for line break?
			if (insertedItem) {
				this.insertItemAfterItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath, insertedItem);
			}
			
			var itemB = this.newTextItem({"text": itemBText});
			//var itemBIndex = currentItemIndex + 1;
			//var itemBKeyPath = textItemsKeyPath.concat(itemBIndex);
			this.insertItemAfterItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath, itemB, {edit: true});
		}
		// Actual selection range
		else {
			var itemAText = currentText.slice(0, splitStart)
			var itemBText = currentText.slice(splitStart, splitEnd);
			var itemCText = currentText.slice(splitEnd);
			
			this.updateTextItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath, function(textItem) {
				return textItem.set('text', itemAText);
			});
			
			var itemB = this.newTextItem({"text": itemBText});
			var itemC = this.newTextItem({"text": itemCText});
			
			// Insert itemC then itemB, so that itemB is in front of itemC
			this.insertItemAfterItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath, itemC);
			this.insertItemAfterItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath, itemB, {edit: true});
		}
	},
	
	getEditedBlockIdentifierForDocumentSection: function(documentID, sectionID) {
		return this.documentSectionEditedTextItemIdentifiers.getIn([documentID, sectionID, "block", "identifier"], null);
	},
	
	getEditedBlockKeyPathForDocumentSection: function(documentID, sectionID) {
		var keyPath = this.documentSectionEditedTextItemIdentifiers.getIn([documentID, sectionID, "block", "keyPath"], null);
		if (keyPath) {
			keyPath = keyPath.toJS();
		}
		return keyPath;
	},
	
	getEditedTextItemIdentifierForDocumentSection: function(documentID, sectionID) {
		return this.documentSectionEditedTextItemIdentifiers.getIn([documentID, sectionID, "item", "identifier"], null);
	},
	
	getEditedTextItemKeyPathForDocumentSection: function(documentID, sectionID) {
		var keyPath = this.documentSectionEditedTextItemIdentifiers.getIn([documentID, sectionID, "item", "keyPath"], null);
		if (keyPath) {
			keyPath = keyPath.toJS();
		}
		return keyPath;
	},
	
	editingWillEndInDocumentSection: function(documentID, sectionID) {
		var itemKeyPath = this.getEditedTextItemKeyPathForDocumentSection(documentID, sectionID);
		if (!itemKeyPath) {
			return;
		}
		
		var blockKeyPath = getBlockKeyPathForItemKeyPath(itemKeyPath);
		var blockGroupType = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath.concat('typeGroup'));
		
		if (this.blockGroupTypeHasTextItems(blockGroupType)) {
			var isEmpty = this.textItemIsEmptyAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath);
			if (isEmpty) {
				this.removeTextItemAtKeyPathInDocumentSection(documentID, sectionID, itemKeyPath);
			}
		}
		
		this.trigger('editedItemWillEndEditingForDocumentSection', documentID, sectionID);
	},
	
	editBlockWithKeyPathInDocumentSection: function(documentID, sectionID, blockKeyPath, {
		editTextItemsIfPresent = true, editLastItem = null, editFirstItem = null
	} = {}) {
		editLastItem = !editFirstItem; // This is the default
		editFirstItem = !editLastItem;
		
		this.editingWillEndInDocumentSection(documentID, sectionID);
		
		var block = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath);
		
		if (editTextItemsIfPresent) {
			if (this.blockGroupTypeHasTextItems(block.get('typeGroup'))) {
				this.editTextItemBasedBlockWithKeyPathAddingIfNeededInDocumentSection(documentID, sectionID, blockKeyPath, {
					lastItem: editLastItem,
					firstItem: editFirstItem
				});

				return;
			}
		}
		
		var blockIdentifier = block.get('identifier');
		var state = Immutable.fromJS({
			"block": {
				keyPath: blockKeyPath,
				identifier: blockIdentifier
			}
		});
		
		this.documentSectionEditedTextItemIdentifiers = this.documentSectionEditedTextItemIdentifiers.setIn(
			[documentID, sectionID], state
		);
		
		this.trigger('editedBlockChangedForDocumentSection', documentID, sectionID);
	},
	
	editTextItemBasedBlockWithKeyPathAddingIfNeededInDocumentSection: function(documentID, sectionID, blockKeyPath, {
		lastItem = null, firstItem = null
	} = {}) {
		lastItem = !firstItem; // This is the default, will be true if firstItem is null.
		firstItem = !lastItem;
		
		this.editingWillEndInDocumentSection(documentID, sectionID);
		
		var block = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath);
		var textItems = block.get('textItems');
		var textItemCount = textItems.count();
		if (textItemCount === 0) {
			// Insert an empty item and edit it.
			var newTextItem = this.newTextItem();
			this.insertItemAtKeyPathInDocumentSection(documentID, sectionID, blockKeyPath.concat('textItems', 0), newTextItem, {edit: true});
		}
		else {
			let itemIndex = lastItem ? (textItemCount - 1) : firstItem ? 0 : 0;
			// Edit last item.
			this.editItemWithKeyPathInDocumentSection(documentID, sectionID, blockKeyPath.concat('textItems', itemIndex));
		}
	},
	
	editItemWithKeyPathInDocumentSection: function(documentID, sectionID, itemKeyPath) {
		var blockKeyPath = getBlockKeyPathForItemKeyPath(itemKeyPath);
		var blockIdentifier = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blockKeyPath.concat('identifier'));
		
		var itemIdentifier = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, itemKeyPath.concat('identifier'));
		
		var currentEditedItemIdentifier = this.getEditedTextItemIdentifierForDocumentSection();
		if (itemIdentifier !== currentEditedItemIdentifier) {
			this.editingWillEndInDocumentSection(documentID, sectionID);
		}
		
		var state = Immutable.fromJS({
			"block": {
				keyPath: blockKeyPath,
				identifier: blockIdentifier
			},
			"item": {
				keyPath: itemKeyPath,
				identifier: itemIdentifier
			}
		});
		
		this.documentSectionEditedTextItemIdentifiers = this.documentSectionEditedTextItemIdentifiers.setIn(
			[documentID, sectionID], state
		);
		
		this.trigger('editedBlockChangedForDocumentSection', documentID, sectionID);
		this.trigger('editedItemChangedForDocumentSection', documentID, sectionID);
	},
	
	finishEditingInDocumentSection: function(documentID, sectionID) {
		this.editingWillEndInDocumentSection(documentID, sectionID);
		
		this.documentSectionEditedTextItemIdentifiers = this.documentSectionEditedTextItemIdentifiers.removeIn(
			[documentID, sectionID]
		);
		
		this.trigger('editedBlockChangedForDocumentSection', documentID, sectionID);
		this.trigger('editedItemChangedForDocumentSection', documentID, sectionID);
	},
	
	registerSelectedTextRangeFunctionForEditedItemInDocumentSection: function(documentID, sectionID, selectedTextRangeFunction) {
		this.documentSectionEditedTextItemIdentifiers = this.documentSectionEditedTextItemIdentifiers.setIn(
			[documentID, sectionID, "item", "selectedTextRangeFunction"], selectedTextRangeFunction
		);
	},
	
	unregisterSelectedTextRangeFunctionForEditedItemInDocumentSection: function(documentID, sectionID) {
		this.documentSectionEditedTextItemIdentifiers = this.documentSectionEditedTextItemIdentifiers.deleteIn(
			[documentID, sectionID, "item", "selectedTextRangeFunction"]
		);
	},
	
	getSelectedTextRangeForEditedItemInDocumentSection: function(documentID, sectionID, selectedTextRange) {
		var selectedTextRangeFunction = this.documentSectionEditedTextItemIdentifiers.getIn(
			[documentID, sectionID, "item", "selectedTextRangeFunction"], null
		);
		if (selectedTextRangeFunction) {
			var selectedTextRange = selectedTextRangeFunction();
			console.log('selectedTextRange', selectedTextRange);
			return selectedTextRange;
		}
		
		return null;
	},
	
	setSelectedTextRangeForEditedItemInDocumentSection: function(documentID, sectionID, selectedTextRange) {
		this.documentSectionEditedTextItemIdentifiers = this.documentSectionEditedTextItemIdentifiers.setIn(
			[documentID, sectionID, "item", "selectedTextRange"], selectedTextRange
		);
	},
	
	editPreviousBlockInDocumentSection: function(documentID, sectionID) {
		var blockKeyPath = this.getEditedBlockKeyPathForDocumentSection(documentID, sectionID);
		if (!blockKeyPath) {
			return false;
		}
		
		var blockIndex = blockKeyPath.slice(-1)[0];
		if (blockIndex === 0) {
			return false;
		}
		
		var previousBlockKeyPath = blockKeyPath.slice(0, -1).concat(blockIndex - 1);
		this.editBlockWithKeyPathInDocumentSection(documentID, sectionID, previousBlockKeyPath, {
			editLastItem: true
		});
	},
	
	editNextBlockInDocumentSection: function(documentID, sectionID) {
		var blockKeyPath = this.getEditedBlockKeyPathForDocumentSection(documentID, sectionID);
		if (!blockKeyPath) {
			return false;
		}
		
		var blocksKeyPath = blockKeyPath.slice(0, -1);
		var blocks = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, blocksKeyPath);
		var blockCount = blocks.count();
		
		var blockIndex = blockKeyPath.slice(-1)[0];
		if (blockIndex === (blockCount - 1)) {
			return false;
		}
		
		var nextBlockKeyPath = blockKeyPath.slice(0, -1).concat(blockIndex + 1);
		this.editBlockWithKeyPathInDocumentSection(documentID, sectionID, nextBlockKeyPath, {
			editFirstItem: true
		});
	},
	
	editPreviousItemInDocumentSection: function(documentID, sectionID) {
		var itemKeyPath = this.getEditedTextItemKeyPathForDocumentSection(documentID, sectionID);
		if (!itemKeyPath) {
			return false;
		}
		
		var itemIndex = itemKeyPath.slice(-1)[0];
		// If first text item is being edited,
		if (itemIndex === 0) {
			// then edit the previous block.
			return this.editPreviousBlockInDocumentSection(documentID, sectionID);
		}
		
		var previousItemKeyPath = itemKeyPath.slice(0, -1).concat(itemIndex - 1);
		this.editItemWithKeyPathInDocumentSection(documentID, sectionID, previousItemKeyPath);
	},
	
	editNextItemInDocumentSection: function(documentID, sectionID) {
		var itemKeyPath = this.getEditedTextItemKeyPathForDocumentSection(documentID, sectionID);
		if (!itemKeyPath) {
			return false;
		}
		
		var blockKeyPath = getBlockKeyPathForItemKeyPath(itemKeyPath);
		var textItemsKeyPath = blockKeyPath.concat('textItems');
		var textItems = this.getContentObjectAtKeyPathForDocumentSection(documentID, sectionID, textItemsKeyPath);
		var itemCount = textItems.count();
		
		var itemIndex = itemKeyPath.slice(-1)[0];
		// If last text item is being edited,
		if (itemIndex === (itemCount - 1)) {
			// then edit the next block.
			return this.editNextBlockInDocumentSection(documentID, sectionID);
		}
		
		var nextItemKeyPath = itemKeyPath.slice(0, -1).concat(itemIndex + 1);
		this.editItemWithKeyPathInDocumentSection(documentID, sectionID, nextItemKeyPath);
	}
});

ContentStore.dispatchToken = AppDispatcher.register( function(payload) {
	if (!payload.eventID) {
		return;
	}
	
	var documentID = null;
	var sectionID = null;
	// TODO: use these two variables.
	var blockKeyPath = null;
	var textItemKeyPath = null;
	var editedBlockKeyPath = null;
	var editedTextItemKeyPath = null;
	var blockKeyPathIsEdited = false;
	
	if (payload.documentID) {
		documentID = payload.documentID;
		if (payload.sectionID) {
			sectionID = payload.sectionID;
			editedBlockKeyPath = ContentStore.getEditedBlockKeyPathForDocumentSection(documentID, sectionID);
			editedTextItemKeyPath = ContentStore.getEditedTextItemKeyPathForDocumentSection(documentID, sectionID);
			
			// TODO: use these variables.
			if (payload.useEditedBlockKeyPath) {
				blockKeyPath = editedBlockKeyPath;
			}
			else {
				blockKeyPath = payload.blockKeyPath;
			}
			blockKeyPathIsEdited = (blockKeyPath == editedBlockKeyPath);
			
			if (payload.useEditedTextItemKeyPath) {
				textItemKeyPath = editedTextItemKeyPath;
			}
			else {
				textItemKeyPath = payload.textItemKeyPath;
			}
		}
	}
	
	switch (payload.eventID) {
		
	case (documentEventIDs.setSpecsURLs):
		setSpecsURLsForDocumentWithID(documentID, payload.specsURLs);
		break;
		
	case (documentSectionEventIDs.showSettings):
		setShowSettingsOn(true);
		break;
		
	case (documentSectionEventIDs.hideSettings):
		setShowSettingsOn(false);
		break;
		
	case (documentSectionEventIDs.setContentJSON):
		setContentFromJSONForDocumentSection(
			documentID,
			sectionID,
			payload.contentJSON
		);
		break;
	
	case (documentSectionEventIDs.edit.textItemWithKeyPath):
		ContentStore.editItemWithKeyPathInDocumentSection(
			documentID,
			sectionID,
			payload.textItemKeyPath
		);
		break;
	
	case (documentSectionEventIDs.edit.blockWithKeyPath):
		ContentStore.editBlockWithKeyPathInDocumentSection(
			documentID,
			sectionID,
			payload.blockKeyPath
		);
		
		break;
	
	case (documentSectionEventIDs.finishEditing):
		ContentStore.finishEditingInDocumentSection(documentID, sectionID);
		
		break;
	
	case (documentSectionEventIDs.blocks.insertSubsectionOfTypeAtIndex):
		ContentStore.insertSubsectionOfTypeAtBlockIndexInDocumentSection(documentID, sectionID,
			payload.subsectionType, payload.blockIndex, {editFollowingBlock: true}
		);
		
		break;
	
	case (documentSectionEventIDs.blocks.insertBlockOfTypeAtIndex):
		ContentStore.insertBlockOfTypeAtIndexInDocumentSection(documentID, sectionID,
			payload.typeGroup, payload.type, payload.blockIndex, {edit: true}
		);
		
		break;
	
	case (documentSectionEventIDs.subsectionAtKeyPath.changeType):
		ContentStore.changeTypeOfSubsectionAtKeyPathInDocumentSection(documentID, sectionID,
			payload.subsectionKeyPath, payload.subsectionType
		);
		
		break;
	
	case (documentSectionEventIDs.subsectionAtKeyPath.remove):
		ContentStore.removeBlockAtKeyPathInDocumentSection(documentID, sectionID,
			payload.subsectionKeyPath, {finishEditing: true}
		);
		
		break;
	
	case (documentSectionEventIDs.blockAtKeyPath.changeType):
		ContentStore.changeTypeOfBlockAtKeyPathInDocumentSection(documentID, sectionID,
			payload.blockKeyPath, payload.blockTypeGroup, payload.blockType
		);
		break;
		
	case (documentSectionEventIDs.blockAtKeyPath.remove):
		ContentStore.removeBlockAtKeyPathInDocumentSection(documentID, sectionID, payload.blockKeyPath);
		break;
		
	case (documentSectionEventIDs.blockAtKeyPath.changeValue):
		var defaultValue = payload.defaultValue;
		var newValueFunction = payload.newValueFunction;
		ContentStore.updateBlockAtKeyPathInDocumentSection(documentID, sectionID, payload.blockKeyPath, function(block) {
			return block.updateIn(['value'], defaultValue, newValueFunction);
		});
		break;
	
	case (documentSectionEventIDs.blockAtKeyPath.insertRelatedBlockAfter):
		ContentStore.insertRelatedBlockAfterBlockAtKeyPathInDocumentSection(documentID, sectionID,
			blockKeyPath, {edit: blockKeyPathIsEdited}
		);
		break;
	
	case (documentSectionEventIDs.blockAtKeyPath.insertRelatedTextItemBlocksAfterWithPastedText):
		ContentStore.insertRelatedTextItemBlocksAfterBlockAtKeyPathWithPastedTextInDocumentSection(documentID, sectionID,
			blockKeyPath, payload.pastedText, {edit: true}
		);
		break;
	
	// EDITED BLOCK
	
	case (documentSectionEventIDs.editedBlock.remove):
		ContentStore.removeBlockAtKeyPathInDocumentSection(documentID, sectionID, editedBlockKeyPath, {editPrevious: true});
		break;
	
	case (documentSectionEventIDs.editedBlock.changeTraitValue):
		var traitID = payload.traitID;
		var defaultValue = payload.defaultValue;
		var newValueFunction = payload.newValueFunction;
		ContentStore.updateBlockAtKeyPathInDocumentSection(documentID, sectionID, editedBlockKeyPath, function(block) {
			return block.updateIn(['traits', traitID], defaultValue, newValueFunction);
		});
		break;
		
	case (documentSectionEventIDs.editedBlock.removeTrait):
		var traitID = payload.traitID;
		ContentStore.updateBlockAtKeyPathInDocumentSection(documentID, sectionID, editedBlockKeyPath, function(block) {
			return block.removeIn(['traits', traitID]);
		});
		break;
	
	// EDITED TEXT ITEM
		
	case (documentSectionEventIDs.editedItem.remove):
		ContentStore.removeTextItemAtKeyPathInDocumentSection(documentID, sectionID, editedTextItemKeyPath, {editPrevious: true});
		break;
		
	case (documentSectionEventIDs.editedItem.setText):
		var text = payload.textItemText;
		ContentStore.updateTextItemAtKeyPathInDocumentSection(documentID, sectionID, editedTextItemKeyPath, function(textItem) {
			return textItem.set('text', text);
		});
		break;
	
	case (documentSectionEventIDs.editedItem.changeTraitValue):
		var traitID = payload.traitID;
		var defaultValue = payload.defaultValue;
		var newValueFunction = payload.newValueFunction;
		ContentStore.updateTextItemAtKeyPathInDocumentSection(documentID, sectionID, editedTextItemKeyPath, function(textItem) {
			return textItem.updateIn(['traits', traitID], defaultValue, newValueFunction);
		});
		break;
		
	case (documentSectionEventIDs.editedItem.removeTrait):
		ContentStore.updateTextItemAtKeyPathInDocumentSection(documentID, sectionID, editedTextItemKeyPath, function(textItem) {
			return textItem.removeIn(['traits', payload.traitID]);
		});
		break;
	
	case (documentSectionEventIDs.editedItem.editPreviousItem):
		ContentStore.editPreviousItemInDocumentSection(documentID, sectionID);
		break;
	
	case (documentSectionEventIDs.editedItem.editNextItem):
		ContentStore.editNextItemInDocumentSection(documentID, sectionID);
		break;
		
	case (documentSectionEventIDs.edit.textItemBasedBlockWithKeyPathAddingIfNeeded):
		ContentStore.editTextItemBasedBlockWithKeyPathAddingIfNeededInDocumentSection(documentID, sectionID, payload.blockKeyPath);
		break;
	
	case (documentSectionEventIDs.editedItem.addNewTextItemAfter):
		ContentStore.addNewItemAfterItemAtKeyPathInDocumentSection(documentID, sectionID, editedTextItemKeyPath, {edit: true});
		break;
	
	case (documentSectionEventIDs.editedItem.addNewLineBreakAfter):
		ContentStore.addLineBreakAfterItemAtKeyPathInDocumentSection(documentID, sectionID, editedTextItemKeyPath, {edit: true});
		break;
	
	case (documentSectionEventIDs.editedItem.splitBlockBefore):
		ContentStore.splitBlockBeforeItemAtKeyPathInDocumentSection(documentID, sectionID, editedTextItemKeyPath);
		break;
	
	case (documentSectionEventIDs.editedItem.joinWithPreviousItem):
		ContentStore.joinItemAtKeyPathWithPreviousInDocumentSection(documentID, sectionID, editedTextItemKeyPath);
		break;
	
	case (documentSectionEventIDs.editedItem.remove):
		ContentStore.joinItemAtKeyPathWithPreviousInDocumentSection(documentID, sectionID, editedTextItemKeyPath);
		break;
	
	case (documentSectionEventIDs.editedItem.splitTextInRange):
		ContentStore.splitTextInRangeOfItemAtKeyPathInDocumentSection(documentID, sectionID, payload.textRange, editedTextItemKeyPath);
		break;
	
	case (documentSectionEventIDs.focusedBlockForReordering.moveToBeforeBlockAtIndex):
		let ReorderingStore = require('./ReorderingStore');
		let focusedBlockKeyPath = ReorderingStore.getFocusedBlockKeyPathForDocumentSection(documentID, sectionID);
		ContentStore.moveBlockAtKeyPathToBeforeBlockAtIndexInDocumentSection(documentID, sectionID, focusedBlockKeyPath, payload.beforeBlockAtIndex);
		break;
	
	}
	
	return true;
});

module.exports = ContentStore;