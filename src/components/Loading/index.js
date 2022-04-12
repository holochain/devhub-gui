const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/loading");


module.exports = {
    "props": {
	"when": {
	    "type": Boolean,
	    "required": true,
	},
    },
    "template": __template,
};
