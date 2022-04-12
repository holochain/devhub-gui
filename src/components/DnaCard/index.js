const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/dna-card");

const { EntryHash,
	...HoloHashTypes }		= require('@whi/holo-hash');
const { Collection }			= require('@whi/entity-architect');


const element_local_name		= "dna-card";

module.exports = {
    "props": {
	"entity": {
	    "type": Object,
	},
	"versions": {
	    "type": Array,
	    "default": new Collection(),
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
	"fetchVersions": {
	    "type": Boolean,
	    "default": false,
	},
    },
    data () {
	if ( !(this.id || this.entity) )
	    throw new Error(`Must provide an ID or the entity for <${element_local_name}>`);

	if ( !this.entity )
	    this.fetchDna( this.id );

	if ( this.fetchVersions )
	    this.fetchVersionsForDna( this.id );

	return {
	    "error": null,
	    "loading": false,
	    "extras": this.expanded,

	    "dna": this.entity,
	};
    },
    "computed": {
	more_version_count () {
	    return Math.max( 0, this.versions.items.length - 5 );
	},
	recent_versions () {
	    return this.versions.items( -5, -1 );
	},
	latest_version () {
	    return this.versions.items( -1 )[0];
	},
    },
    "methods": {
	async fetchDna ( id ) {
	    try {
		this.loading		= true;
		this.dna		= await this.$store.dispatch("fetchDna", id );
	    } catch (err) {
		console.error( err );
		this.error		= err;
	    } finally {
		this.loading		= false;
	    }
	},
	async fetchVersionsForDna ( id ) {
	    try {
		this.loading		= true;
		await this.$store.dispatch("fetchVersionsForDna", id );
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
