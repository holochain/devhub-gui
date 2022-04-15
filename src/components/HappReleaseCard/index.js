const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/happ-release-card");

const { EntryHash,
	...HoloHashTypes }		= require('@whi/holo-hash');


const element_local_name		= "happ-release-card";

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
	    this.fetchHappRelease( this.id );

	return {
	    "error": null,
	    "loading": false,
	    "expanded": this.expand || this.expandDepth > 0,
	    "show_parent_ref": this.parentRef,

	    "release": this.entity,
	};
    },
    "computed": {
	header_prefix () {
	    return this.title || "Release";
	},
	parent_id () {
	    return this.release.for_happ instanceof EntryHash
		? this.release.for_happ
		: this.release.for_happ.$id;
	},
	child_expand_depth () {
	    return this.expandDepth - 1;
	},
	dnas () {
	    let dnas			= this.release.dnas;

	    if ( Array.isArray( dnas ) ) {
		dnas			= dnas.reduce( (acc, dna_ref) => {
		    acc[dna_ref.role_id]	= dna_ref;
		    return acc;
		}, {});
	    }

	    return this.release
		? dnas
		: {};
	},
	dna_ids () {
	    return Object.keys( this.dnas );
	},
    },
    "methods": {
	async fetchHappRelease ( id ) {
	    try {
		this.loading		= true;
		this.release		= await this.$store.dispatch("fetchHappRelease", id );
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
