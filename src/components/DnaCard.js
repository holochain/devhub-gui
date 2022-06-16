const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/dna-card");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "id": {
		"type": Uint8Array,
		"required": true,
	    },
	    "link": {
		"type": Boolean,
		"default": true,
	    },
	    "actions": {
		validator (value) {
		    if ( !Array.isArray(value) )
			return false;

		    for (let action of value) {
			if ( typeof action !== "object" || action === null )
			    return false;

			if ( typeof action.method !== "function" )
			    return false;
			if ( typeof action.icon !== "string" )
			    return false;

			if ( action.hide && typeof action.hide !== "boolean" )
			    return false;
			if ( action.title && typeof action.title !== "string" )
			    return false;
			if ( action.alt && typeof action.alt !== "string" )
			    return false;
		    }

		    return true;
		},
		"default": [],
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
	    log.info("DNA Card: %s", String(this.id) );
	    return {
		"error": null,
		"expanded": this.expand || this.expandDepth > 0,
	    };
	},
	"computed": {
	    dna () {
		return this.$store.getters.dna( this.id );
	    },
	    $dna () {
		return this.$store.getters.$dna( this.id );
	    },

	    versions () {
		return this.$store.getters.dna_versions( this.id );
	    },
	    $versions () {
		return this.$store.getters.$dna_versions( this.id );
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
	    if ( !this.dna )
		this.$store.dispatch("fetchDna", this.id );

	    if ( !this.versions.length )
		this.$store.dispatch("fetchVersionsForDna", this.id );
	},
	"methods": {
	    toggle_expansion () {
		this.expanded		= !this.expanded;
	    },
	},
    };
}
