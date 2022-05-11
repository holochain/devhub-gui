const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/happ-release-card");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "id": {
		"type": Uint8Array,
		"required": true,
	    },
	    "title": {
		"type": String,
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
	    "parenRef": {
		"type": Boolean,
		"default": true,
	    },
	},
	data () {
	    log.info("hApp Card: %s", String(this.id) );
	    return {
		"error": null,
		"expanded": this.expand || this.expandDepth > 0,
		"show_parent_ref": this.parentRef,
	    };
	},
	"computed": {
	    release () {
		return this.$store.getters.happ_release( this.id );
	    },
	    $release () {
		return this.$store.getters.$happ_release( this.id );
	    },

	    header_prefix () {
		return this.title || "Release";
	    },
	    parent_id () {
		return this.release.for_happ instanceof Uint8Array
		    ? this.release.for_happ
		    : this.release.for_happ.$id;
	    },
	    child_expand_depth () {
		return this.expandDepth - 1;
	    },

	    dnas () {
		const dnas		= {};

		if ( !this.release )
		    return dnas;

		if ( Array.isArray( this.release.dnas ) ) {
		    for ( let ref of this.release.dnas )
			dnas[ref.role_id] = ref.version;
		} else {
		    for ( let role_id in this.release.dnas )
			dnas[role_id]	= this.release.dnas[role_id].$id;
		}

		return dnas;
	    },
	    dna_roles () {
		return Object.keys( this.dnas );
	    },
	    dna_ids () {
		return Object.values( this.dnas );
	    },
	},
	created () {
	    if ( !this.release )
		this.$store.dispatch("fetchHappRelease", this.id );
	},
	"methods": {
	    toggle_expansion () {
		this.expanded		= !this.expanded;
	    },
	},
    };
}
