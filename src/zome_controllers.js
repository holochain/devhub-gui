const { Logger }			= require('@whi/weblogger');
const log				= new Logger("zomes");

const { HoloHashes }			= require('@holochain/devhub-entities');
const { AgentPubKey }			= HoloHashes;


module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": (await import("./templates/zomes/list.html")).default,
	    "data": function() {
		const agent_hash	= PersistentStorage.getItem("LIST_FILTER");
		return {
		    "agent_search": agent_hash || null,
		    "agent_filter": agent_hash || null,
		    "order_by": "published_at",
		};
	    },
	    async created () {
		this.refresh();
	    },
	    "computed": {
		title () {
		    return this.agent === "me" ? "My Zomes" : "Zomes found";
		},
		agent () {
		    return this.agent_filter || "me";
		},
		zomes () {
		    const zomes		= this.$store.getters.zomes( this.agent ).collection;
		    return this.sort_by_object_key( zomes, this.order_by );
		},
		$zomes () {
		    return this.$store.getters.zomes( this.agent ).metadata;
		},
	    },
	    "methods": {
		refresh () {
		    if ( this.zomes.length === 0 )
			this.fetchZomes();
		},
		updateAgent ( input ) {
		    if ( input === "" )
			this.agent_filter = null;
		    else if ( this.isAgentPubKey( input ) )
			this.agent_filter	= new AgentPubKey( input );
		    else
			return;

		    PersistentStorage.setItem("LIST_FILTER", this.agent_filter );

		    if ( !this.zomes.length )
			this.fetchZomes();
		},
		async fetchZomes () {
		    try {
			await this.$store.dispatch("fetchZomes", { "agent": this.agent });
		    } catch (err) {
			log.error("Failed to get zomes: %s", err.message, err );
		    }
		},
	    },
	};
    };

    async function create () {
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
			const zome	= await this.$store.dispatch("createZome", this.input );

			this.$store.dispatch("fetchZomes", { "agent": "me" });
			this.$router.push( "/zomes/" + zome.$id );
		    } catch ( err ) {
			log.error("Failed to create Zome:", err );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": (await import("./templates/zomes/update.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {},
		    "validated": false,
		};
	    },
	    "computed": {
		zome () {
		    return this.$store.getters.zome( this.id ).entity;
		},
		$zome () {
		    return this.$store.getters.zome( this.id ).metadata;
		},
		form () {
		    return this.$refs["form"];
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		if ( !this.zome )
		    this.fetchZome();
	    },
	    "methods": {
		async fetchZome () {
		    try {
			await this.$store.dispatch("fetchZome", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get zome (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$store.dispatch("updateZome", [ this.id, this.input ] );

			this.$router.push( "/zomes/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update Zome (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": (await import("./templates/zomes/single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "deprecation": {
			"message": null,
		    },
		    "validated": false,
		    "version": null,
		};
	    },
	    async created () {
		window.View		= this;
		this.id			= this.getPathId("id");

		this.refresh();
	    },
	    "computed": {
		zome () {
		    return this.$store.getters.zome( this.id ).entity;
		},
		$zome () {
		    return this.$store.getters.zome( this.id ).metadata;
		},
		versions () {
		    return this.$store.getters.zome_versions( this.id ).collection;
		},
		$versions () {
		    return this.$store.getters.zome_versions( this.id ).metadata;
		},
		form () {
		    return this.$refs["form"];
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		unpublishModal () {
		    return this.$refs["unpublishModal"].modal;
		},
		deprecated () {
		    return !!( this.zome && this.zome.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    if ( !this.zome )
			this.fetchZome();

		    if ( this.versions.length === 0 )
			this.fetchZomeVersions();
		},
		async fetchZome () {
		    try {
			await this.$store.dispatch("fetchZome", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get zome (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchZomeVersions () {
		    try {
			await this.$store.dispatch("fetchVersionsForZome", this.id );
		    } catch (err) {
			log.error("Failed to get versions for zome (%s): %s", String(this.id), err.message, err );
		    }
		},
		async deprecate () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    await this.$store.dispatch("deprecateZome", [ this.id, this.deprecation ] );

		    this.deprecation	= {
			"message": null,
		    };

		    this.modal.hide();

		    this.$store.dispatch("fetchZomes", { "agent": "me" });
		},
		promptUnpublish ( version ) {
		    this.version	= version;
		    this.unpublishModal.show();
		},
		async unpublish () {
		    await this.$store.dispatch("unpublishZomeVersion", this.version.$id );

		    this.unpublishModal.hide();
		    this.fetchZomeVersions();
		},
	    },
	};
    };

    return {
	list,
	create,
	update,
	single,
    };
};
