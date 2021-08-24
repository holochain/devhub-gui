const { Logger }			= require('@whi/weblogger');
const log				= new Logger("zomes");

const { HoloHashes }			= require('@holochain/devhub-entities');
const { sort_by_object_key }		= require('./common.js');


module.exports = async function ( client ) {

    async function zomes () {
	return {
	    "template": (await import("./templates/zomes/list.html")).default,
	    "data": function() {
		return {
		    "order_by": "published_at",
		    "zomes": [],
		    "loading_zomes": true,
		};
	    },
	    async created () {
		this.refresh();
	    },
	    "methods": {
		refresh () {
		    this.fetchZomes();
		},
		async fetchZomes () {
		    this.loading_zomes	= true;

		    log.debug("Getting zome list...");
		    let zomes		= await client.call(
			"dnarepo", "dna_library", "get_my_zomes"
		    );

		    log.info("Found %s Zomes in Collection for %s", zomes.length, String( zomes.$base ) );
		    this.zomes		= sort_by_object_key( zomes, "created_at" );

		    this.loading_zomes	= false;
		},
	    },
	};
    };

    async function create_zome () {
	return {
	    "template": (await import("./templates/zomes/create.html")).default,
	    "data": function() {
		return {
		    "error": null,
		    "input": {
			"name": null,
			"description": null,
		    },
		    "validated": false,
		    "saving": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
	    },
	    "methods": {
		async create () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			let zome	= await client.call(
			    "dnarepo", "dna_library", "create_zome", this.input
			);
			this.$router.push( "/zomes/" + zome.$id );
		    } catch ( err ) {
			log.error("Failed to create Zome):", err );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
	    },
	};
    };

    async function update_zome () {
	return {
	    "template": (await import("./templates/zomes/update.html")).default,
	    "data": function() {
		return {
		    "error": null,
		    "zome": null,
		    "input": {},
		    "validated": false,
		    "saving": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
	    },
	    async created () {
		this.id			= new HoloHashes.EntryHash( this.$route.params.id );

		this.fetchZome();
	    },
	    "methods": {
		async fetchZome () {
		    log.debug("Getting zome %s", String(this.id) );
		    let zome		= await client.call(
			"dnarepo", "dna_library", "get_zome", { "id": this.id }
		    );
		    delete zome.published_at;
		    delete zome.last_updated;
		    delete zome.developer.pubkey;

		    log.info("Received zome: %s", zome.name, zome );
		    this.zome		= zome;
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			let zome	= await client.call(
			    "dnarepo", "dna_library", "update_zome", {
				"id": this.id,
				"addr": this.zome.$addr,
				"properties": this.input,
			    }
			);
			this.$router.push( "/zomes/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update Zome (%s):", String(this.zome.$id), err );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
	    },
	};
    };

    async function single_zome () {
	return {
	    "template": (await import("./templates/zomes/single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "zome": null,
		    "versions": [],
		    "loading_zome": true,
		    "loading_versions": true,
		    "deprecation": {
			"message": null,
		    },
		    "validated": false,
		};
	    },
	    async created () {
		this.id			= new HoloHashes.EntryHash( this.$route.params.id );

		this.refresh();
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		deprecated () {
		    return !!( this.zome && this.zome.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    this.fetchZome();
		    this.fetchZomeVersions();
		},
		async fetchZome () {
		    this.loading_zome	= true;

		    log.debug("Getting zome %s", String(this.id) );
		    let zome		= await client.call(
			"dnarepo", "dna_library", "get_zome", { "id": this.id }
		    );

		    log.info("Received zome: %s", zome.name, zome );
		    this.zome		= zome;
		    this.loading_zome	= false;
		},
		async fetchZomeVersions () {
		    this.loading_versions	= true;

		    log.debug("Getting zome versions for %s", String(this.id) );
		    let versions	= await client.call(
			"dnarepo", "dna_library", "get_zome_versions", { "for_zome": this.id }
		    );

		    log.info("Received %s versions for %s", versions.length, String(versions.$base) );
		    this.versions		= versions;
		    this.loading_versions	= false;
		},
		async deprecatePrompt () {
		    this.modal.show();
		},
		async deprecate () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    log.normal("Deprecating Zome '%s' (%s)", this.zome.name, String(this.zome.$id) );
		    this.zome		= await client.call(
			"dnarepo", "dna_library", "deprecate_zome", {
			    "addr": this.id,
			    "message": this.deprecation.message,
			}
		    );
		    this.deprecation	= {
			"message": null,
		    };

		    this.modal.hide();
		},
	    },
	};
    };

    return {
	zomes,
	create_zome,
	update_zome,
	single_zome,
    };
};
