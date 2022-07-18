const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happs");

const { AgentPubKey }			= holohash;
const { load_html }			= require('./common.js');



module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": await load_html("/templates/happs/list.html"),
	    "data": function() {
		const input_cache	= PersistentStorage.getItem("LIST_FILTER");
		let agent_input		= input_cache;

		if ( this.$route.query.agent ) {
		    log.warn("Overriding stored filter (%s) with filter from URL search:", input_cache, this.$route.query.agent );
		    agent_input		= this.$route.query.agent;
		}

		return {
		    "agent_input_cache": input_cache,
		    "agent_input": this.$route.query.agent || input_cache || "",
		    "agent_hash": null,
		    "order_by": "last_updated",
		    "reverse_order": true,
		    "list_filter": "",
		};
	    },
	    async created () {
		this.refresh();
	    },
	    "computed": {
		title () {
		    return (
			this.agent_input.length
			    ? ( this.agent_input === "me" ? "My" : "Agent" )
			    : "All"
		    )  + " hApps";
		},
		agent () {
		    return this.agent_input.length ? this.agent_input : "me";
		},
		happs () {
		    const happs		= (
			this.agent_input.length
			    ? this.$store.getters.happs( this.agent )
			    : this.$store.getters.happs( "all" )
		    ).filter( entity => {
			const filter	= this.list_filter.trim();

			if ( filter === "" )
			    return true;

			let words	= filter.split(/\s+/);

			for ( let word of words ) {
			    if ( this.compareText( word, entity.title )
				 || this.compareText( word, entity.subtitle )
				 || this.compareText( word, entity.description ) )
				return 1;

			    if ( entity.tags && entity.tags.some( tag => this.compareText( word, tag ) ) )
				return 1;
			}

			return 0;
		    });

		    happs.sort( this.sort_by_key( this.order_by, this.reverse_order ) );

		    return happs;
		},
		$happs () {
		    return this.agent_input.length
			? this.$store.getters.$happs( this.agent )
			: this.$store.getters.$happs( "all" );
		},
	    },
	    "methods": {
		async refresh () {
		    if ( this.happs.length === 0 ) {
			await this.fetchHapps();
		    }
		},
		async updateAgent ( input ) {
		    if ( input === "" )
			this.agent_input	= "";
		    else if ( this.isAgentPubKey( input ) )
			this.agent_hash		= new AgentPubKey( input );
		    else
			return;

		    PersistentStorage.setItem("LIST_FILTER", this.agent_input );

		    await this.fetchHapps();
		},
		async fetchHapps () {
		    if ( this.agent_input.length )
			await this.fetchAgentHapps();
		    else
			await this.fetchAllHapps();
		},
		async fetchAgentHapps () {
		    try {
			await this.$store.dispatch("fetchHapps", { "agent": this.agent });
		    } catch (err) {
			log.error("Failed to get happs: %s", err.message, err );
		    }
		},
		async fetchAllHapps () {
		    try {
			await this.$store.dispatch("fetchAllHapps");
		    } catch (err) {
			log.error("Failed to get happs: %s", err.message, err );
		    }
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await load_html("/templates/happs/create.html"),
	    "data": function() {
		return {
		    "error": null,
		    "input": {
			"title": null,
			"subtitle": null,
			"description": null,
			"tags": new Set(),
		    },
		    "validated": false,
		    "saving": false,
		    "tag_search_text": "",
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
	    },
	    "methods": {
		addTag ( tag ) {
		    log.info("Adding tag:", tag );
		    this.input.tags.add( tag );
		    this.tag_search_text		= "";
		},
		removeTag ( tag ) {
		    log.info("Removing tag:", tag );
		    this.input.tags.delete( tag );
		},
		async create () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    const input				= Object.assign({}, this.input );
		    input.tags				= [ ...input.tags ];

		    this.saving		= true;
		    try {
			const happ	= await this.$store.dispatch("createHapp", input );

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
	    "template": await load_html("/templates/happs/update.html"),
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {},
		    "validated": false,
		    "tag_search_text": "",
		};
	    },
	    "computed": {
		happ () {
		    return this.$store.getters.happ( this.id );
		},
		$happ () {
		    return this.$store.getters.$happ( this.id );
		},
		form () {
		    return this.$refs["form"];
		},
		tags () {
		    return this.input.tags || this.happ.tags;
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		if ( !this.happ )
		    this.fetchHapp();
	    },
	    "methods": {
		addTag ( tag ) {
		    if ( !this.input.tags )
			this.input.tags			= new Set(this.happ.tags);

		    log.info("Adding tag:", tag );
		    this.input.tags.add( tag );
		    this.tag_search_text		= "";
		},
		removeTag ( tag ) {
		    if ( !this.input.tags )
			this.input.tags			= new Set(this.happ.tags);

		    log.info("Removing tag:", tag );
		    this.input.tags.delete( tag );
		},
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

		    const input				= Object.assign({}, this.input );

		    if ( input.tags )
			input.tags			= [ ...input.tags ];

		    try {
			await this.$store.dispatch("updateHapp", [ this.id, input ] );

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
	    "template": await load_html("/templates/happs/single.html"),
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
		    return this.$store.getters.happ( this.id );
		},
		$happ () {
		    return this.$store.getters.$happ( this.id );
		},
		releases () {
		    const releases	= this.$store.getters.happ_releases( this.id );
		    releases.sort( this.sort_version( true ) );
		    return releases;
		},
		$releases () {
		    return this.$store.getters.$happ_releases( this.id );
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

		    this.$store.dispatch("fetchAllHapps");
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
