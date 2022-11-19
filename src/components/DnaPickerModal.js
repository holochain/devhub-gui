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
	"watch": {
	    "hdkVersion" ( new_hdk_version, old_hdk_version ) {
		if ( new_hdk_version )
		    this.$openstate.get(`hdk/${new_hdk_version}/dnas`);
	    },
	},
	data () {
	    return {
		"multi_select": [],
	    };
	},
	"computed": {
	    hdkdnas_datapath () {
		return this.hdkVersion
		    ? `hdk/${this.hdkVersion}/dnas`
		    : this.$openstate.DEADEND;
	    },
	    ...common.scopedPathComputed( c => c.hdkdnas_datapath, "dnas", {
		"default": [],
	    }),
	    modal () {
		return this.$refs["picker"].modal;
	    },
	},
    };
}
