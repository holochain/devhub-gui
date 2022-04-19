const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/happ-card");

const { load_html }			= require('../common.js');
const { EntryHash }			= holohash;
const { Collection }			= CruxPayloadParser.EntityArchitect;


module.exports = async function ( element_local_name, component_name ) {
    return {
	"props": {
	    "entity": {
		"type": Object,
	    },
	    "releases": {
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
	    "fetchReleases": {
		"type": Boolean,
		"default": false,
	    },
	},
	data () {
	    if ( !(this.id || this.entity) )
		throw new Error(`Must provide an ID or the entity for <${element_local_name}>`);

	    if ( !this.entity )
		this.fetchHapp( this.id );

	    if ( this.fetchReleases )
		this.fetchReleasesForHapp( this.id );

	    return {
		"error": null,
		"loading": false,
		"expanded": this.expand || this.expandDepth > 0,

		"happ": this.entity,
	    };
	},
	"computed": {
	    more_release_count () {
		return Math.max( 0, this.releases.length - 5 );
	    },
	    more_release_text () {
		return "more release" + ( this.more_release_count > 1 ? "s" : "" );
	    },
	    recent_releases () {
		return this.releases.items( -5, -1 );
	    },
	    latest_release () {
		return this.releases.items( -1 )[0];
	    },
	    child_expand_depth () {
		return this.expandDepth - 1;
	    },
	},
	"methods": {
	    async fetchHapp ( id ) {
		try {
		    this.loading		= true;
		    this.happ		= await this.$store.dispatch("fetchHapp", id );
		} catch (err) {
		    console.error( err );
		    this.error		= err;
		} finally {
		    this.loading		= false;
		}
	    },
	    async fetchReleasesForHapp ( id ) {
		try {
		    this.loading		= true;
		    await this.$store.dispatch("fetchReleasesForHapp", id );
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
	"template": await load_html(`/dist/components/${component_name}.html`),
    };
}
