const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/deprecation-alert");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "title": {
		"type": String,
		"default": "This has been deprecated",
	    },
	    "message": {
		"type": String,
	    },
	},
    };
}
