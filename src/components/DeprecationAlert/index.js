const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/deprecation-alert");


module.exports = {
    "props": {
	"title": {
	    "type": String,
	    "default": "This has been deprecated",
	},
	"message": {
	    "type": String,
	},
    },
    "template": __template,
};
