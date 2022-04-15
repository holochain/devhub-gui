const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/list-group");


module.exports = {
    "props": {
	"list": {
	    "type": Array,
	    "required": true,
	},
	"loading": {
	    "type": Boolean,
	    "default": false,
	},
	"noResultText": {
	    "type": String,
	    "default": "No Results",
	},
    },
    "template": __template,
};
