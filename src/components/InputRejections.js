const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/input-rejections");



module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "path": {
		"type": String,
	    },
	    "rejections": {
		"type": Array,
	    },
	},
	data () {
	    if ( !(this.path || this.rejections) )
		throw new Error(`<input-rejections> requires a 'path' or 'rejections' attribute`);

	    if ( this.path && this.rejections )
		throw new Error(`<input-rejections> cannot have the 'path' and 'rejections' attributes; choose one`);

	    return {};
	},
	"computed": {
	    $rejections () {
		return this.path
		    ? this.$openstate.rejections[ this.path ]
		    : this.rejections;
	    },
	},
	// created () {
	// },
    };
}
