const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/display-error");

const { load_html }			= require('../common.js');


module.exports = async function ( element_local_name, component_name ) {
    return {
	"props": {
	    "error": {
		"validator": ( value ) => {
		    return [ null, undefined ].includes( value ) || (
			value.name && value.message
		    );
		},
		"required": true,
	    },
	    "debug": {
		"type": Boolean,
		"default": false,
	    },
	},
	"template": await load_html(`/dist/components/${component_name}.html`),
    };
}
