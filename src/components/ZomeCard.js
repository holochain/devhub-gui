const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/zome-card");

const { EntryHash }			= holohash;
const { Collection }			= CruxPayloadParser.EntityArchitect;


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "id": {
		"type": EntryHash,
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
	    log.info("Zome Card: %s", String(this.id) );
	    return {
		"error": null,
		"expanded": this.expand || this.expandDepth > 0,
	    };
	},
	"computed": {
	    zome () {
		return this.$store.getters.zome( this.id );
	    },
	    $zome () {
		return this.$store.getters.$zome( this.id );
	    },

	    versions () {
		return this.$store.getters.zome_versions( this.id );
	    },
	    $versions () {
		return this.$store.getters.$zome_versions( this.id );
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
	created () {
	    if ( !this.zome )
		this.$store.dispatch("fetchZome", this.id );

	    if ( !this.versions.length )
		this.$store.dispatch("fetchVersionsForZome", this.id );
	},
	"methods": {
	    toggle_expansion () {
		this.expanded		= !this.expanded;
	    },
	},
    };
}
