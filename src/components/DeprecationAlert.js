const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/deprecation-alert");

const { load_html }			= require('../common.js');


module.exports = async function ( element_local_name ) {
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
	"template": await load_html(`/dist/components/DeprecationAlert.html`),
    };
}
