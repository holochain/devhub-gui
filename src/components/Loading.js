const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/loading");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "when": {
		"type": Boolean,
		"required": true,
	    },
	},
    };
}
