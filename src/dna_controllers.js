const { Logger }			= require('@whi/weblogger');
const log				= new Logger("dnas");

const { HoloHashes }			= require('@holochain/devhub-entities');
const { AgentPubKey }			= HoloHashes;


module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": (await import("./templates/dnas/list.html")).default,
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
		    return this.agent === "me" ? "My DNAs" : "DNAs found";
		},
		agent () {
		    return this.agent_filter || "me";
		},
		dnas () {
		    const dnas		= this.$store.getters.dnas( this.agent ).collection;
		    return this.sort_by_object_key( dnas, this.order_by );
		},
		$dnas () {
		    return this.$store.getters.dnas( this.agent ).metadata;
		},
	    },
	    "methods": {
		refresh () {
		    if ( this.dnas.length === 0 )
			this.fetchDnas();
		},
		updateAgent ( input ) {
		    if ( input === "" )
			this.agent_filter = null;
		    else if ( this.isAgentPubKey( input ) )
			this.agent_filter	= new AgentPubKey( input );
		    else
			return;

		    PersistentStorage.setItem("LIST_FILTER", this.agent_filter );

		    if ( !this.dnas.length )
			this.fetchDnas();
		},
		async fetchDnas () {
		    try {
			await this.$store.dispatch("fetchDnas", { "agent": this.agent  });
		    } catch (err) {
			log.error("Failed to get dnas: %s", err.message, err );
		    }
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": (await import("./templates/dnas/create.html")).default,
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
			const dna	= await this.$store.dispatch("createDna", this.input );

			this.$store.dispatch("fetchDnas", { "agent": "me" });
			this.$router.push( "/dnas/" + dna.$id );
		    } catch ( err ) {
			log.error("Failed to create DNA:", err );
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
	    "template": (await import("./templates/dnas/update.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {},
		    "validated": false,
		};
	    },
	    "computed": {
		dna () {
		    return this.$store.getters.dna( this.id ).entity;
		},
		$dna () {
		    return this.$store.getters.dna( this.id ).metadata;
		},
		form () {
		    return this.$refs["form"];
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		if ( !this.dna )
		    this.fetchDna();
	    },
	    "methods": {
		async fetchDna () {
		    try {
			await this.$store.dispatch("fetchDna", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get dna (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$store.dispatch("updateDna", [ this.id, this.input ] );

			this.$router.push( "/dnas/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update DNA (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": (await import("./templates/dnas/single.html")).default,
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
		dna () {
		    return this.$store.getters.dna( this.id ).entity;
		},
		$dna () {
		    return this.$store.getters.dna( this.id ).metadata;
		},
		versions () {
		    return this.$store.getters.dna_versions( this.id ).collection;
		},
		$versions () {
		    return this.$store.getters.dna_versions( this.id ).metadata;
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
		    return !!( this.dna && this.dna.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    if ( !this.dna )
			this.fetchDna();

		    if ( this.versions.length === 0 )
			this.fetchDnaVersions();
		},
		async fetchDna () {
		    try {
			await this.$store.dispatch("fetchDna", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get dna (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchDnaVersions () {
		    try {
			await this.$store.dispatch("fetchVersionsForDna", this.id );
		    } catch (err) {
			log.error("Failed to get versions for dna (%s): %s", String(this.id), err.message, err );
		    }
		},
		async deprecate () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    await this.$store.dispatch("deprecateDna", [ this.id, this.deprecation ] );

		    this.deprecation	= {
			"message": null,
		    };

		    this.modal.hide();

		    this.$store.dispatch("fetchDnas", { "agent": "me" });
		},
		promptUnpublish ( version ) {
		    this.version	= version;
		    this.unpublishModal.show();
		},
		async unpublish () {
		    await this.$store.dispatch("unpublishDnaVersion", this.version.$id );

		    this.unpublishModal.hide();
		    this.fetchDnaVersions();
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
