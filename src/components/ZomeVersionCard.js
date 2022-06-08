const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/zome-version-card");


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
	    "parenRef": {
		"type": Boolean,
		"default": true,
	    },
	},
	data () {
	    log.info("Zome Version Card: %s", String(this.id) );
	    return {
		"not_found": false,
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
		return this.version.for_zome instanceof Uint8Array
		    ? this.version.for_zome
		    : this.version.for_zome.$id;
	    },
	},
	async created () {
	    try {
		if ( !this.version )
		    await this.$store.dispatch("fetchZomeVersion", this.id );
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
