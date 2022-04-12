const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/page-view");


module.exports = {
    "props": {
	"modelValue": String,
    },
    "emits": [ "update:modelValue" ],
    "template": __template,
};
