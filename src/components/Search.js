const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/page-view");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "modelValue": String,
	},
	"emits": [ "update:modelValue" ],
    };
}
