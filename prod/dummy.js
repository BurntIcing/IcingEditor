!function e(t,o,r){function i(s,a){if(!o[s]){if(!t[s]){var p="function"==typeof require&&require;if(!a&&p)return p(s,!0);if(n)return n(s,!0);var u=new Error("Cannot find module '"+s+"'");throw u.code="MODULE_NOT_FOUND",u}var l=o[s]={exports:{}};t[s][0].call(l.exports,function(e){var o=t[s][1][e];return i(o?o:e)},l,l.exports,e,t,o,r)}return o[s].exports}for(var n="function"==typeof require&&require,s=0;s<r.length;s++)i(r[s]);return i}({1:[function(e){"use strict";window.burntIcing={settingsJSON:{previewURL:"/-icing/preview/",wantsSaveUI:!1,wantsViewHTMLFunctionality:!0,initialDocumentState:{availableDocuments:[{ID:"dummy",title:"Dummy",sections:[{ID:"main",title:"Main"}]}],documentID:"dummy",documentSectionID:"main",contentJSONByDocumentID:{dummy:{main:e("./dummy-content.json")}}}}}},{"./dummy-content.json":2}],2:[function(e,t){t.exports={type:"textItems",blocks:[{typeGroup:"particular",type:"placeholder",placeholderID:"blik.header"},{typeGroup:"particular",type:"placeholder",placeholderID:"blik.macAppStoreLink"},{textItems:[{text:"Your projects, at a glance.",type:"text"}],typeGroup:"text",type:"subhead2"},{textItems:[{text:"Got those projects you’re working on? ",type:"text"},{text:"And that client from last year who wants some changes? ",type:"text"},{text:"Plus that upcoming pitch? ",type:"text"},{text:"Do you collaborate with other people, sharing many files via a service like Dropbox? Are there files from these different projects you need quick access to all the time?",type:"text"}],typeGroup:"text",type:"body"},{textItems:[{text:"Blik lets you select the key files and folders from projects, organising them as you like. Highlight the essentials so that they are never more than a click away, no matter what folder they live in. And set preferred apps to open files, specific for the project.",type:"text"}],typeGroup:"text",type:"body"},{textItems:[{text:"Blik is simple — purposefully so — to let you focus on just the files you need.",type:"text"}],typeGroup:"text",type:"body"},{textItems:[{attributes:{italic:!0,secondary:!0},text:"Briefs. PSDs. Dev folders. ",type:"text"},{attributes:{bold:!0},text:"Organization for Web Designers & Developers.",type:"text"}],typeGroup:"text",type:"subhead2"}]}},{}]},{},[1]);