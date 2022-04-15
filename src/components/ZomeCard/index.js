const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/zome-card");

const { EntryHash,
	...HoloHashTypes }		= require('@whi/holo-hash');
const { Collection }			= require('@whi/entity-architect');


const element_local_name		= "zome-card";

module.exports = {
    "props": {
	"entity": {
	    "type": Object,
	},
	"versions": {
	    "type": Collection,
	    "default": new Collection(),
	},

	// Only initial value is used
	"id": {
	    "type": EntryHash,
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
	"fetchVersions": {
	    "type": Boolean,
	    "default": false,
	},
    },
    data () {
	if ( !(this.id || this.entity) )
	    throw new Error(`Must provide an ID or the entity for <${element_local_name}>`);

	if ( !this.entity )
	    this.fetchZome( this.id );

	if ( this.fetchVersions )
	    this.fetchVersionsForZome( this.id );

	return {
	    "error": null,
	    "loading": false,
	    "expanded": this.expand || this.expandDepth > 0,

	    "zome": this.entity,
	};
    },
    "computed": {
	more_version_count () {
	    return Math.max( 0, this.versions.length - 5 );
	},
	more_version_text () {
	    return "more version" + ( this.more_version_count > 1 ? "s" : "" );
	},
	recent_versions () {
	    return this.versions.items( -5, -1 );
	},
	latest_version () {
	    return this.versions.items( -1 )[0];
	},
	child_expand_depth () {
	    return this.expandDepth - 1;
	},
    },
    "methods": {
	async fetchZome ( id ) {
	    try {
		this.loading		= true;
		this.zome		= await this.$store.dispatch("fetchZome", id );
	    } catch (err) {
		console.error( err );
		this.error		= err;
	    } finally {
		this.loading		= false;
	    }
	},
	async fetchVersionsForZome ( id ) {
	    try {
		this.loading		= true;
		await this.$store.dispatch("fetchVersionsForZome", id );
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
