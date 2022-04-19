const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/holo-hash");

const { load_html }			= require('../common.js');
const { EntryHash,
	HeaderHash,
	DnaHash,
	AgentPubKey }			= holohash;


module.exports = async function ( element_local_name, component_name ) {
    return {
	"props": {
	    "hash": {
		"required": true,
		validator (value) {
		    if ( value instanceof holohash.HoloHash )
			return true;

		    try {
			new holohash.HoloHash(value);
			return true;
		    } catch (err) {
			return false;
		    }
		}
	    },
	    "chars": {
		"type": Number,
		"default": 5,
	    },
	    "expanded": {
		"type": Boolean,
		"default": false,
	    },
	},
	data () {
	    return {
		"holohash": new holohash.HoloHash( this.hash ),
		"hash_str": String( this.hash ),
		"full_hash": this.expanded,
	    };
	},
	"computed": {
	    hash_repr () {
		return this.snip( this.hash_str, 5 );
	    },
	},
	"methods": {
	    appearance_cls () {
		return {
		    "bg-primary":	this.holohash instanceof AgentPubKey,
		    "bg-light":	this.holohash instanceof EntryHash,
		    "bg-secondary":	this.holohash instanceof HeaderHash,
		    "bg-danger":	this.holohash instanceof DnaHash,
		    "text-dark":	this.holohash instanceof EntryHash,
		};
	    },
	    toggleFullHash () {
		this.full_hash	= !this.full_hash;
	    },
	},
	"template": await load_html(`/dist/components/${component_name}.html`),
    };
}
