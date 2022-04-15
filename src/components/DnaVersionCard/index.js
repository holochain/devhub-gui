const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/dna-version-card");

const { EntryHash,
	...HoloHashTypes }		= require('@whi/holo-hash');


const element_local_name		= "dna-version-card";

module.exports = {
    "props": {
	"entity": {
	    "type": Object,
	},

	// Only initial value is used
	"id": {
	    "type": EntryHash,
	},
	"title": {
	    "type": String,
	},
	"expand": {
	    "type": Boolean,
	    "default": false,
	},
	"expandDepth": {
	    "type": Number,
	    "default": 0,
	},
	"link": {
	    "type": Boolean,
	    "default": true,
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
	    this.fetchDnaVersion( this.id );

	return {
	    "error": null,
	    "loading": false,
	    "expanded": this.expand || this.expandDepth > 0,
	    "show_parent_ref": this.parentRef,

	    "version": this.entity,
	};
    },
    "computed": {
	header_prefix () {
	    return this.title || "Version";
	},
	parent_id () {
	    return this.version.for_dna instanceof EntryHash
		? this.version.for_dna
		: this.version.for_dna.$id;
	},
	child_expand_depth () {
	    return this.expandDepth - 1;
	},
	zomes () {
	    let zomes			= this.version.zomes;

	    if ( Array.isArray( zomes ) ) {
		zomes			= zomes.reduce( (acc, zome_ref) => {
		    acc[zome_ref.name]	= zome_ref;
		    return acc;
		}, {});
	    }

	    return this.version
		? zomes
		: {};
	},
	zome_ids () {
	    return Object.keys( this.zomes );
	},
    },
    "methods": {
	async fetchDnaVersion ( id ) {
	    try {
		this.loading		= true;
		this.version		= await this.$store.dispatch("fetchDnaVersion", id );
	    } catch (err) {
		console.error( err );
		this.error		= err;
	    } finally {
		this.loading		= false;
	    }
	},
	toggle_expansion () {
	    this.expanded		= !this.expanded;
	},
    },
    "template": __template,
};
