const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/list-group");


module.exports = {
    "props": {
	"noResultText": {
	    "type": String,
	    "default": "No Results",
	},
	"list": {
	    "type": Array,
	    "required": true,
	},
	"loading": {
	    "type": Boolean,
	    "default": false,
	},
    },
    "template": __template,
};
