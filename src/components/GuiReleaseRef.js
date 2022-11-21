const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/gui-release-ref");

const common				= require('../common.js');


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "id": String,
	},
	data () {
	    return {};
	},
	"computed": {
	    release_path () {
		return `gui/release/${this.id}`;
	    },
	    gui_path () {
		return this.$release.present
		    ? `gui/${this.release.for_gui}`
		    : this.$openstate.DEADEND;
	    },
	    ...common.scopedPathComputed( c => c.release_path,	"release" ),
	    ...common.scopedPathComputed( c => c.gui_path,	"gui" ),
	},
	async created () {
	    await this.$openstate.get( this.release_path );
	    await this.$openstate.get( this.gui_path );
	},
    };
}
