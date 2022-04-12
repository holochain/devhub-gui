const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/display-error");


module.exports = {
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
    "template": __template,
};
