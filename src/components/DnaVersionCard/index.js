const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/dna-version-card");

const { EntryHash,
	...HoloHashTypes }		= require('@whi/holo-hash');


const element_local_name		= "dna-version-card";

module.exports = {
    "props": {
	"entity": {
	    "type": Object,
	},

	// Only initial value is used
	"id": {
	    "type": EntryHash,
	},
	"expanded": {
	    "type": Boolean,
	    "default": false,
	},
	"link": {
	    "type": Boolean,
	    "default": true,
	},
	"title": {
	    "type": String,
	},
	"parenRef": {
	    "type": Boolean,
	    "default": true,
	},
    },
    data () {
	if ( !(this.id || this.entity) )
	    throw new Error(`Must provide an 'id' or the 'entity' for <${element_local_name}>`);

	if ( !this.entity )
	    this.fetchDnaVersion( this.id );

	return {
	    "error": null,
	    "loading": false,
	    "extras": this.expanded,
	    "show_parent_ref": this.parentRef,

	    "version": this.entity,
	};
    },
    "computed": {
	name () {
	    return this.title || this.version.version;
	},
	parent_id () {
	    return this.version.for_dna instanceof EntryHash
		? this.version.for_dna
		: this.version.for_dna.$id;
	},
	zomes () {
	    let zomes			= this.version.zomes;

	    if ( Array.isArray( zomes ) ) {
		zomes			= zomes.reduce( (acc, zome_ref) => {
		    acc[zome_ref.name]	= zome_ref;
		    return acc;
		}, {});
	    }

	    return this.version
		? zomes
		: {};
	},
	zome_ids () {
	    console.log("Zomes for", this.version, this.zomes );
	    return Object.keys( this.zomes );
	},
    },
    "methods": {
	async fetchDnaVersion ( id ) {
	    try {
		this.loading		= true;
		this.version		= await this.$store.dispatch("fetchDnaVersion", id );
	    } catch (err) {
		console.error( err );
		this.error		= err;
	    } finally {
		this.loading		= false;
	    }
	},
	toggle_expansion () {
	    this.extras			= !this.extras;
	},
    },
    "template": __template,
};
