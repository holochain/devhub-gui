const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/list-group");

const { load_html }			= require('../common.js');


module.exports = async function ( element_local_name, component_name ) {
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
	},
	"template": await load_html(`/dist/components/${component_name}.html`),
    };
}
