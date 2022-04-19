const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/dna-card");

const { load_html }			= require('../common.js');
const { EntryHash }			= holohash;
const { Entity, Collection }		= CruxPayloadParser.EntityArchitect;


module.exports = async function ( element_local_name, component_name ) {
    return {
	"props": {
	    "entity": {
		"type": Entity,
	    },
	    "versions": {
		"type": Array,
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
		this.fetchDna( this.id );

	    if ( this.fetchVersions )
		this.fetchVersionsForDna( this.id );

	    return {
		"error": null,
		"expanded": this.expand || this.expandDepth > 0,

		// "dna": this.entity,
	    };
	},
	"computed": {
	    dna_id () {
		console.log("compute dna_id:", this.entity );
		return this.entity
		    ? this.entity.$id
		    : this.id;
	    },
	    dna () {
		return this.$store.getters.dna( this.dna_id ).entity;
	    },
	    $dna () {
		return this.$store.getters.dna( this.dna_id ).metadata;
	    },
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
	    async fetchDna ( id ) {
		try {
		    await this.$store.dispatch("fetchDna", id );
		} catch (err) {
		    console.error( err );
		    this.error		= err;
		}
	    },
	    async fetchVersionsForDna ( id ) {
		try {
		    await this.$store.dispatch("fetchVersionsForDna", id );
		} catch (err) {
		    console.error( err );
		    this.error		= err;
		}
	    },
	    toggle_expansion () {
		this.expanded		= !this.expanded;
	    },
	},
	"template": await load_html(`/dist/components/${component_name}.html`),
    };
}
