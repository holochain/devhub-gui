const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/zome-version-card");

const { EntryHash,
	...HoloHashTypes }		= require('@whi/holo-hash');


const element_local_name		= "zome-version-card";

module.exports = {
    "props": {
	"entity": {
	    "type": Object,
	},

	// Only initial value is used
	"id": {
	    "type": EntryHash,
	},
	"expanded": {
	    "type": Boolean,
	    "default": false,
	},
	"link": {
	    "type": Boolean,
	    "default": true,
	},
	"title": {
	    "type": String,
	},
	"parenRef": {
	    "type": Boolean,
	    "default": true,
	},
    },
    data () {
	if ( !(this.id || this.entity) )
	    throw new Error(`Must provide an 'id' or the 'entity' for <${element_local_name}>`);

	if ( !this.entity )
	    this.fetchZomeVersion( this.id );

	return {
	    "error": null,
	    "loading": false,
	    "extras": this.expanded,
	    "show_parent_ref": this.parentRef,

	    "version": this.entity,
	};
    },
    "computed": {
	name () {
	    return this.title || this.version.version;
	},
	parent_id () {
	    return this.version.for_zome instanceof EntryHash
		? this.version.for_zome
		: this.version.for_zome.$id;
	},
    },
    "methods": {
	async fetchZomeVersion ( id ) {
	    try {
		this.loading		= true;
		this.version		= await this.$store.dispatch("fetchZomeVersion", id );
	    } catch (err) {
		console.error( err );
		this.error		= err;
	    } finally {
		this.loading		= false;
	    }
	},
	toggle_expansion () {
	    this.extras			= !this.extras;
	},
    },
    "template": __template,
};
