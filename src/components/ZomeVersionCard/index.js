const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/zome-version-card");

const { EntryHash }			= holohash;
const { Entity }			= CruxPayloadParser.EntityArchitect;


const element_local_name		= "zome-version-card";

module.exports = {
    "props": {
	"entity": {
	    "type": Entity,
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
	    this.fetchZomeVersion( this.id );

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
	    this.expanded		= !this.expanded;
	},
    },
    "template": __template,
};
