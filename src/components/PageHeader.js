const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/page-header");

const { load_html }			= require('../common.js');


module.exports = async function ( element_local_name, component_name ) {
    return {
	"props": {
	    "controlsCol": {
		"type": String,
		"default": null,
	    },
	},
	data () {
	    return {
		"header_col_classes": {},
		"controls_col_classes": {},
	    };
	},
	mounted () {
	    let header_col_size		= 12;
	    let controls_col_size		= 0;

	    if ( this.$slots["controls"] ) {
		controls_col_size		= this.controlsCol || 6;
		header_col_size		= 12 - controls_col_size;
	    }

	    this.header_col_classes[`col-${header_col_size}`] = true;
	    this.controls_col_classes[`col-${controls_col_size}`] = true;
	},
	"template": await load_html(`/dist/components/${component_name}.html`),
    };
}
