const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/dna-version-card");


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
	    log.info("DNA Version Card: %s", String(this.id) );
	    return {
		"not_found": false,
		"error": null,
		"expanded": this.expand || this.expandDepth > 0,
		"show_parent_ref": this.parentRef,
	    };
	},
	"computed": {
	    version () {
		return this.$store.getters.dna_version( this.id );
	    },
	    $version () {
		return this.$store.getters.$dna_version( this.id );
	    },

	    header_prefix () {
		return this.title || "Version";
	    },
	    parent_id () {
		return this.version.for_dna instanceof Uint8Array
		    ? this.version.for_dna
		    : this.version.for_dna.$id;
	    },
	    child_expand_depth () {
		return this.expandDepth - 1;
	    },

	    zomes () {
		const zomes		= {};

		if ( !this.version )
		    return zomes;

		if ( Array.isArray( this.version.zomes ) ) {
		    for ( let ref of this.version.zomes )
			zomes[ref.name]	= ref.version;
		} else {
		    for ( let name in this.version.zomes )
			zomes[name]	= this.version.zomes[name].$id;
		}

		return zomes;
	    },
	    zome_names () {
		return Object.keys( this.zomes );
	    },
	    zome_ids () {
		return Object.values( this.zomes );
	    },
	},
	async created () {
	    try {
		if ( !this.version )
		    await this.$store.dispatch("fetchDnaVersion", this.id );
	    } catch (err) {
		if ( err.name === "EntryNotFoundError" )
		    this.not_found	= true;
	    }
	},
	"methods": {
	    toggle_expansion () {
		this.expanded		= !this.expanded;
	    },
	},
    };
}
