/**
	Copyright 2015 Patrick George Wyndham Smith
*/

let React = require('react');
let objectAssign = require('object-assign');
let Immutable = require('immutable');

let {
	findParticularSubsectionOptionsInList,
	findParticularBlockTypeOptionsWithGroupAndTypeInMap,
	findParticularTraitOptionsInList
} = require('../assistants/TypesAssistant');

let HTMLRepresentationAssistant = require('../assistants/HTMLRepresentationAssistant');


var PreviewElementsCreator = {
	
};

function isStringWithContent(object) {
	return (typeof object === 'string' && object.trim().length > 0);
}

function createElementFactoryMergingProps(type, originalProps, children) {
	return function (additionalAttributes) {
		let mergedProps = objectAssign({}, originalProps, additionalAttributes);
		
		// Merge the class name
		delete mergedProps.className;
		let mergedClassNames = [originalProps.className, additionalAttributes.className].filter(isStringWithContent).join(' ').trim();
		if (mergedClassNames != '') {
			mergedProps.className = mergedClassNames;
		}
		
		return React.createElement(type, mergedProps, children);
	}
}

PreviewElementsCreator.reactElementForWrappingChildWithTraits = function(child, traits, traitsSpecs) {
	if (true) {
		traits.forEach(function(traitValue, traitID) {
			if (traitValue == null || traitValue === false) {
				return;
			}
			
			let traitOptions = findParticularTraitOptionsInList(traitID, traitsSpecs);
			
			let valueForRepresentation;
			// Fields
			if (traitOptions.has('fields')) {
				valueForRepresentation = Immutable.Map({
					'originalElement': child,
					'fields': traitValue
				});
			}
			// On/off trait
			else {
				valueForRepresentation = Immutable.Map({
					'originalElement': child
				});
			}
			
			if (traitOptions.has('innerHTMLRepresentation')) {
				let HTMLRepresentation = traitOptions.get('innerHTMLRepresentation');
				if (HTMLRepresentation === false) {
					// For example, hide trait
					child = null;
				}
				else if (HTMLRepresentationAssistant.isValidHTMLRepresentationType(HTMLRepresentation)) {					
					child = HTMLRepresentationAssistant.createReactElementsForHTMLRepresentationAndValue(
						HTMLRepresentation, valueForRepresentation
					);
				}
			}
			
			if (child != null && traitOptions.has('afterHTMLRepresentation')) {
				let HTMLRepresentation = traitOptions.get('afterHTMLRepresentation');
				if (HTMLRepresentationAssistant.isValidHTMLRepresentationType(HTMLRepresentation)) {
					let afterElements = HTMLRepresentationAssistant.createReactElementsForHTMLRepresentationAndValue(
						HTMLRepresentation, valueForRepresentation
					);
					
					if (afterElements) {
						if (!Array.isArray(child)) {
							child = [child];
						}
					
						child = child.concat(afterElements);
					}
				}
			}
		});
		
		return child;
	}
	else {
		// Factory for child, tries to keep as is if not attributes passed.
		let elementFactory = (additionalAttributes) => {
			if (additionalAttributes && Object.keys(additionalAttributes).length > 0) {
				return createElementFactoryMergingProps('span', {key: 'span'}, child)(additionalAttributes);
			}
			else {
				return child;
			}
		};
	
		if (traits.has('italic')) {
			elementFactory = createElementFactoryMergingProps('em', {key: 'italic'}, elementFactory());
		}
	
		if (traits.has('bold')) {
			elementFactory = createElementFactoryMergingProps('strong', {key: 'bold'}, elementFactory());
		}
	
		if (traits.has('link')) {
			var link = traits.get('link');
			var linkTypeChoice = link.get('typeChoice');
			var linkType = linkTypeChoice.get('selectedChoiceID');
			var values = linkTypeChoice.get('selectedChoiceValues');
		
			if (linkType === 'URL') {
				elementFactory = createElementFactoryMergingProps('a', {
					key: 'link/URL',
					href: values.get('URL')
				}, elementFactory());
			}
			else if (linkType === 'email') {
				elementFactory = createElementFactoryMergingProps('a', {
					key: 'link/email',
					href: 'mailto:' + values.get('emailAddress')
				}, elementFactory());
			}
		}
	
		let additionalAttributes = {};
		let additionalClassNames = [];
	
		if (traits.has('class')) {
			var classNames = traits.getIn(['class', 'classNames']);
			if (classNames && classNames !== '') {
				additionalClassNames.push(classNames);
			}
		}
	
		if (additionalClassNames.length) {
			additionalAttributes.className = additionalClassNames.join(' ');
		}
	
		return elementFactory(additionalAttributes);
	}
};


PreviewElementsCreator.reactElementsForWrappingSubsectionChildren = function(subsectionType, subsectionElements, subsectionsSpecs, index) {
	let subsectionInfo = findParticularSubsectionOptionsInList(subsectionType, subsectionsSpecs);
	
	let outerTagName = subsectionInfo.get('outerHTMLTagName');
	if (outerTagName) {
		// Wrap elements in holder element. Return type is array, so wrap in an array too.
		return [
			React.createElement(outerTagName, {
				key: `outerElement-${index}`,
			}, subsectionElements)
		];
	}
	else {
		return subsectionElements;
	}
};

PreviewElementsCreator.reactElementsForSubsectionChild = function(
	subsectionType, blockTypeGroup, blockType, contentElements, traits, blockTypeOptions, blockIndex, subsectionsSpecs
) {
	let subsectionInfo = findParticularSubsectionOptionsInList(subsectionType, subsectionsSpecs);
	
	let blockCreationOptions = subsectionInfo.get('blockHTMLOptions');
	let subsectionChildHTMLRepresentation = subsectionInfo.get('childHTMLRepresentation');
	
	var tagNameForBlock = blockTypeOptions.get('outerHTMLTagName', 'div');
	if (blockCreationOptions) {
		if (blockCreationOptions.get('noParagraph', false) && tagNameForBlock === 'p') {
			tagNameForBlock = null;	
		}
	}
	
	var innerElements;
	if (tagNameForBlock) {
		// Nest inside, e.g. <li><h2>
		innerElements = [
			React.createElement(tagNameForBlock, {
				key: `block-${blockIndex}`
			}, contentElements)
		];
	}
	else {
		innerElements = contentElements;
	}
	
	/*
	if (traits) {
		innerElements = [
			PreviewElementsCreator.reactElementForWrappingChildWithTraits(innerElements, traits)
		];
	}
	*/
	
	if (subsectionChildHTMLRepresentation) {
		let valueForRepresentation = Immutable.Map({
			'originalElement': innerElements
		});
		
		return HTMLRepresentationAssistant.createReactElementsForHTMLRepresentationAndValue(
			subsectionChildHTMLRepresentation, valueForRepresentation, `portionChild-${blockIndex}`
		);
		/*
		return [
			React.createElement(tagNameForSubsectionChild, {
				key: `subsectionChild-${blockIndex}`
			},
				innerElements
			)
		];
		*/
	}
	else {
		return innerElements;
	}
};
	
PreviewElementsCreator.reactElementsWithBlocks = function(blocksImmutable, specsImmutable) {
	let subsectionsSpecs = specsImmutable.get('subsectionTypes', Immutable.List());
	let traitsSpecs = specsImmutable.get('traitTypes', Immutable.List());
	let blockGroupIDsToTypesMap = specsImmutable.get('blockTypesByGroup', Immutable.Map());
	
	var mainElements = [];
	var currentSubsectionType = specsImmutable.get('defaultSubsectionType', 'normal');
	var currentSubsectionElements = [];
	
	let processCurrentSubsectionChildren = function() {
		if (currentSubsectionElements.length > 0) {
			mainElements = mainElements.concat(
				PreviewElementsCreator.reactElementsForWrappingSubsectionChildren(
					currentSubsectionType, currentSubsectionElements, subsectionsSpecs, mainElements.length
				)
			);
			currentSubsectionElements = [];
		}
	};
	
	blocksImmutable.forEach(function(block, blockIndex) {
		var typeGroup = block.get('typeGroup');
		var type = block.get('type');
		
		if (typeGroup === 'subsection') {
			// Wrap last elements.
			processCurrentSubsectionChildren();
			
			currentSubsectionType = type;
		}
		else {
			var blockTypeOptions = findParticularBlockTypeOptionsWithGroupAndTypeInMap(
				typeGroup, type, blockGroupIDsToTypesMap
			);
		
			var elements;
		
			if (typeGroup === 'particular' || typeGroup === 'media') {
				var value = block.get('value', Immutable.Map());
				var valueForRepresentation = Immutable.Map({
					'fields': value
				});
				var HTMLRepresentation = blockTypeOptions.get('innerHTMLRepresentation');
				if (HTMLRepresentation) {
					elements = HTMLRepresentationAssistant.createReactElementsForHTMLRepresentationAndValue(
						HTMLRepresentation, valueForRepresentation
					);
				}
			}
			else if (typeGroup === 'text') {
				elements = block.get('textItems').map(function(textItem) {
					let itemType = textItem.get('type');
					if (itemType === 'text') {
						let element = textItem.get('text');
						let traits = textItem.get('traits');
					
						if (traits) {
							element = PreviewElementsCreator.reactElementForWrappingChildWithTraits(element, traits, traitsSpecs);
						}
				
						return element;
					}
					else if (itemType === 'lineBreak') {
						return React.createElement('br');
					}
					else if (itemType === 'catalogItem') {
						return null; // TODO
					}
					else if (itemType === 'placeholder') {
						return null; // TODO
					}
				}).toJS();
			}
			
			
			let traits = block.get('traits');
			if (traits) {
				let blockElementWithTraits = PreviewElementsCreator.reactElementForWrappingChildWithTraits(elements, traits, traitsSpecs);
				if (blockElementWithTraits) {
					elements = [
						blockElementWithTraits
					];
				}
				else {
					// For example, 'hide' trait was on.
					elements = null;
				}
			}
			
			if (elements) {
				currentSubsectionElements = currentSubsectionElements.concat(
					PreviewElementsCreator.reactElementsForSubsectionChild(
						currentSubsectionType, typeGroup, type, elements, traits, blockTypeOptions, blockIndex, subsectionsSpecs
					)
				);
			}
		}
	});
	
	processCurrentSubsectionChildren();
	
	return mainElements;
};

PreviewElementsCreator.MainElement = React.createClass({
	getDefaultProps: function() {
		return {
			contentImmutable: null,
			specsImmutable: null,
			actions: {}
		};
	},
	
	render: function() {
		var props = this.props;
		var contentImmutable = props.contentImmutable;
		var specsImmutable = props.specsImmutable;
		
		var classNames = ['blocks'];
		
		if (!contentImmutable) {
			return React.createElement('div', {
				key: 'noContent'
			}, '(Content Is Null)');
		}
		
		var content = contentImmutable.toJS();
		var blocks = content.blocks;
		var blocksImmutable = contentImmutable.get('blocks');

		let elements = PreviewElementsCreator.reactElementsWithBlocks(blocksImmutable, specsImmutable);
	
		return React.createElement('div', {
			key: 'blocks',
			className: classNames.join(' ')
		}, elements);
	}
});

PreviewElementsCreator.previewHTMLWithContent = function(contentImmutable, specsImmutable, {pretty = true} = {}) {
	var previewElement = React.createElement(PreviewElementsCreator.MainElement, {
		key: 'main',
		contentImmutable: contentImmutable,
		specsImmutable: specsImmutable
	});
	
	var previewHTML = React.renderToStaticMarkup(previewElement);
	
	// Strip wrapping div.
	previewHTML = previewHTML.replace(/^<div class="blocks">|<\/div>$/gm, '');
	
	if (pretty) {
		var inlineTagNames = {
			"span": true,
			"strong": true,
			"em": true,
			"a": true,
			"img": true,
			"small": true
		};
	
		var holdingTagNames = {
			"ul": true,
			"ol": true,
			"blockquote": true
		};
		
		// Add new lines for presentation
		previewHTML = previewHTML.replace(/<(\/?)([^>]+)>/gm, function(match, optionalClosingSlash, tagName, offset, string) {
			// Inline elements are kept as-is
			if (inlineTagNames[tagName]) {
				return match;
			}
			// Block elements are given line breaks for nicer presentation.
			else {
				if (optionalClosingSlash.length > 0) {
					return '<' + optionalClosingSlash + tagName + '>' + "\n";
					//return "\n" + '<' + optionalClosingSlash + tagName + '>' + "\n";
				}
				else {
					if (holdingTagNames[tagName]) {
						return '<' + tagName + '>' + "\n";
					}
					else {
						return '<' + tagName + '>';
					}
				}
			}
		});
	}
	
	return previewHTML;
}
	
PreviewElementsCreator.reactElementWithContentAndActions = function(contentImmutable, specsImmutable, actions) {
	return React.createElement(PreviewElementsCreator.MainElement, {
		key: 'main',
		contentImmutable: contentImmutable,
		specsImmutable: specsImmutable,
		actions: actions
	});
};

var PreviewHTMLCode = React.createClass({
	componentDidMount() {
		// Syntax highlighting
		if (window.hljs) {
			let codeElement = this.refs.code.getDOMNode();
			window.hljs.highlightBlock(codeElement);
		}
	},
	
	render() {
		let {
			previewHTML
		} = this.props;
		
		return React.createElement('code', {
			className: 'language-html',
			ref: 'code'
		}, previewHTML);
	}
});

PreviewElementsCreator.ViewHTMLElement = React.createClass({
	render() {
		var {
			documentID,
			sectionID,
			content,
			specs,
			actions
		} = this.props;
		
		var previewHTML = PreviewElementsCreator.previewHTMLWithContent(content, specs);
		
		return React.createElement('pre', {
			key: 'pre',
			className: 'previewHTMLHolder'
		}, React.createElement(PreviewHTMLCode, {
			previewHTML: previewHTML
		}));
	}
});

module.exports = PreviewElementsCreator;