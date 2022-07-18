const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/list-group");


module.exports = function ( element_local_name, component_name ) {
    return {
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
	    "border": {
		"type": Boolean,
		"default": false,
	    },
	},
    };
}
