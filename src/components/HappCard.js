const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/happ-card");

const { EntryHash }			= holohash;
const { Collection }			= CruxPayloadParser.EntityArchitect;


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "id": {
		"type": EntryHash,
		"required": true,
	    },
	    "link": {
		"type": Boolean,
		"default": true,
	    },

	    // Only initial value is used
	    "expand": {
		"type": Boolean,
		"default": false,
	    },
	    "expandDepth": {
		"type": Number,
		"default": 0,
	    },
	},
	data () {
	    log.info("hApp Card: %s", String(this.id) );
	    return {
		"error": null,
		"expanded": this.expand || this.expandDepth > 0,
	    };
	},
	"computed": {
	    happ () {
		return this.$store.getters.happ( this.id );
	    },
	    $happ () {
		return this.$store.getters.$happ( this.id );
	    },

	    releases () {
		return this.$store.getters.happ_releases( this.id );
	    },
	    $releases () {
		return this.$store.getters.$happ_releases( this.id );
	    },

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
	created () {
	    if ( !this.happ )
		this.$store.dispatch("fetchHapp", this.id );

	    if ( !this.releases.length )
		this.$store.dispatch("fetchReleasesForHapp", this.id );
	},
	"methods": {
	    toggle_expansion () {
		this.expanded		= !this.expanded;
	    },
	},
    };
}
