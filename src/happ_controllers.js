const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happs");

const { HoloHashes }			= require('@holochain/devhub-entities');
const { AgentPubKey }			= HoloHashes;


module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": (await import("./templates/happs/list.html")).default,
	    "data": function() {
		const agent_hash	= PersistentStorage.getItem("LIST_FILTER");
		return {
		    "agent_search": agent_hash || null,
		    "agent_filter": agent_hash ? new AgentPubKey( agent_hash ) : null,
		    "order_by": "published_at",
		};
	    },
	    async created () {
		this.refresh();
	    },
	    "computed": {
		title () {
		    return this.agent === "me" ? "My hApps" : "hApps found";
		},
		agent () {
		    return this.agent_filter || "me";
		},
		happs () {
		    const happs		= this.$store.getters.happs( this.agent ).collection;
		    return this.sort_by_object_key( happs, this.order_by );
		},
		$happs () {
		    return this.$store.getters.happs( this.agent ).metadata;
		},
	    },
	    "methods": {
		refresh () {
		    if ( this.happs.length === 0 )
			this.fetchHapps();
		},
		updateAgent ( input ) {
		    if ( input === "" )
			this.agent_filter = null;
		    else if ( this.isAgentPubKey( input ) )
			this.agent_filter	= new AgentPubKey( input );
		    else
			return;

		    PersistentStorage.setItem("LIST_FILTER", this.agent_filter );

		    if ( !this.happs.length )
			this.fetchHapps();
		},
		async fetchHapps () {
		    try {
			await this.$store.dispatch("fetchHapps", { "agent": this.agent });
		    } catch (err) {
			log.error("Failed to get happs: %s", err.message, err );
		    }
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": (await import("./templates/happs/create.html")).default,
	    "data": function() {
		return {
		    "error": null,
		    "input": {
			"title": null,
			"subtitle": null,
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
			const happ	= await this.$store.dispatch("createHapp", this.input );

			this.$store.dispatch("fetchHapps", { "agent": "me" });
			this.$router.push( "/happs/" + happ.$id );
		    } catch ( err ) {
			log.error("Failed to create Happ:", err );
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
	    "template": (await import("./templates/happs/update.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {},
		    "validated": false,
		};
	    },
	    "computed": {
		happ () {
		    return this.$store.getters.happ( this.id ).entity;
		},
		$happ () {
		    return this.$store.getters.happ( this.id ).metadata;
		},
		form () {
		    return this.$refs["form"];
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		if ( !this.happ )
		    this.fetchHapp();
	    },
	    "methods": {
		async fetchHapp () {
		    try {
			await this.$store.dispatch("fetchHapp", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$store.dispatch("updateHapp", [ this.id, this.input ] );

			this.$router.push( "/happs/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update Happ (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": (await import("./templates/happs/single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "deprecation": {
			"message": null,
		    },
		    "validated": false,
		    "release": null,
		};
	    },
	    async created () {
		window.View		= this;
		this.id			= this.getPathId("id");

		this.refresh();
	    },
	    "computed": {
		happ () {
		    return this.$store.getters.happ( this.id ).entity;
		},
		$happ () {
		    return this.$store.getters.happ( this.id ).metadata;
		},
		releases () {
		    return this.$store.getters.happ_releases( this.id ).collection;
		},
		$releases () {
		    return this.$store.getters.happ_releases( this.id ).metadata;
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
		    return !!( this.happ && this.happ.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    if ( !this.happ )
			this.fetchHapp();

		    if ( this.releases.length === 0 )
			this.fetchHappReleases();
		},
		async fetchHapp () {
		    try {
			await this.$store.dispatch("fetchHapp", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchHappReleases () {
		    try {
			await this.$store.dispatch("fetchReleasesForHapp", this.id );
		    } catch (err) {
			log.error("Failed to get releases for happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async deprecate () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    await this.$store.dispatch("deprecateHapp", [ this.id, this.deprecation ] );

		    this.deprecation	= {
			"message": null,
		    };

		    this.modal.hide();

		    this.$store.dispatch("fetchHapps", { "agent": "me" });
		},
		promptUnpublish ( release ) {
		    this.release	= release;
		    this.unpublishModal.show();
		},
		async unpublish () {
		    await this.$store.dispatch("unpublishHappRelease", this.release.$id );

		    this.unpublishModal.hide();
		    this.fetchHappReleases();
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
