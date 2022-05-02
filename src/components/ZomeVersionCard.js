const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/zome-version-card");

const { EntryHash }			= holohash;
const { Entity }			= CruxPayloadParser.EntityArchitect;


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "id": {
		"type": EntryHash,
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
	    log.info("Zome Version Card: %s", String(this.id) );
	    return {
		"error": null,
		"expanded": this.expand || this.expandDepth > 0,
		"show_parent_ref": this.parentRef,
	    };
	},
	"computed": {
	    version () {
		return this.$store.getters.zome_version( this.id );
	    },
	    $version () {
		return this.$store.getters.$zome_version( this.id );
	    },

	    header_prefix () {
		return this.title || "Version";
	    },
	    parent_id () {
		return this.version.for_zome instanceof EntryHash
		    ? this.version.for_zome
		    : this.version.for_zome.$id;
	    },
	},
	created () {
	    if ( !this.version )
		this.$store.dispatch("fetchZomeVersion", this.id );
	},
	"methods": {
	    toggle_expansion () {
		this.expanded		= !this.expanded;
	    },
	},
    };
}
