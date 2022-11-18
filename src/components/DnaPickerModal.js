const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/dna-picker-modal");

const common				= require('../common.js');

module.exports = function ( element_local_name, component_name ) {
    return {
	"emits": [ "update:modelValue" ],
	"props": {
	    "name": {
		"type": String,
		"required": true,
	    },
	    "hdkVersion": {
		"type": String,
	    },
	    "onclose": {
		"type": Function,
		"default": () => null,
	    },

	    // Only initial value is used
	    "multiple": {
		"type": Boolean,
		"default": false,
	    },
	},
	data () {
	    return {
		"multi_select": [],
	    };
	},
	"computed": {
	    ...common.scopedPathComputed( "dnas", "dnas", {
		"default": [],
		"get": true,
		"filter": ( dnas ) => {
		    return dnas.filter( dna => {
			return !this.hdk_version || dna.hdk_version === this.hdk_version;
		    });
		},
	    }),
	    modal () {
		console.log("DNA Picker modal:", this.$refs.picker );
		return this.$refs["picker"].modal;
	    },
	},
    };
}
