const { Logger }			= require('@whi/weblogger');
const log				= new Logger("dnas");

const { AgentPubKey }			= holohash;
const { load_html }			= require('./common.js');


module.exports = async function ( client ) {
    async function list () {
	return {
	    "template": await load_html("/templates/dnas/list.html"),
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
		    )  + " DNAs";
		},
		agent () {
		    return this.agent_input.length ? this.agent_input : "me";
		},

		dnas () {
		    const dnas		= (
			this.agent_input.length
			    ? this.$store.getters.dnas( this.agent )
			    : this.$store.getters.dnas( "all" )
		    ).filter( entity => {
			const filter	= this.list_filter.trim();

			if ( filter === "" )
			    return true;

			let words	= filter.split(/\s+/);

			for ( let word of words ) {
			    if ( this.compareText( word, entity.name )
				 || this.compareText( word, entity.description ) )
				return 1;

			    if ( entity.tags && entity.tags.some( tag => this.compareText( word, tag ) ) )
				return 1;
			}

			return 0;
		    });

		    dnas.sort( this.sort_by_key( this.order_by, this.reverse_order ) );

		    return dnas;
		},
		$dnas () {
		    return this.agent_input.length
			? this.$store.getters.$dnas( this.agent )
			: this.$store.getters.$dnas( "all" );
		},
	    },
	    "methods": {
		async refresh () {
		    if ( this.dnas.length === 0 )
			await this.fetchDnas();
		},
		async updateAgent ( input ) {
		    if ( input === "" )
			this.agent_filter = null;
		    else if ( this.isAgentPubKey( input ) )
			this.agent_filter	= new AgentPubKey( input );
		    else
			return;

		    PersistentStorage.setItem("LIST_FILTER", this.agent_filter );

		    await this.fetchDnas();
		},
		async fetchDnas () {
		    if ( this.agent_input.length )
			await this.fetchAgentDnas();
		    else
			await this.fetchAllDnas();
		},
		async fetchAgentDnas () {
		    try {
			await this.$store.dispatch("fetchDnas", { "agent": this.agent  });
		    } catch (err) {
			log.error("Failed to get dnas: %s", err.message, err );
		    }
		},
		async fetchAllDnas () {
		    try {
			await this.$store.dispatch("fetchAllDnas");
		    } catch (err) {
			log.error("Failed to get dnas: %s", err.message, err );
		    }
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await load_html("/templates/dnas/create.html"),
	    "data": function() {
		return {
		    "error": null,
		    "input": {
			"name": null,
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
			const dna	= await this.$store.dispatch("createDna", input );

			this.$store.dispatch("fetchAllDnas");
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
	    "template": await load_html("/templates/dnas/update.html"),
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
		form () {
		    return this.$refs["form"];
		},

		dna () {
		    return this.$store.getters.dna( this.id );
		},
		$dna () {
		    return this.$store.getters.$dna( this.id );
		},

		tags () {
		    return this.input.tags || this.dna.tags;
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
		addTag ( tag ) {
		    if ( !this.input.tags )
			this.input.tags			= new Set(this.dna.tags);

		    log.info("Adding tag:", tag );
		    this.input.tags.add( tag );
		    this.tag_search_text		= "";
		},
		removeTag ( tag ) {
		    if ( !this.input.tags )
			this.input.tags			= new Set(this.dna.tags);

		    log.info("Removing tag:", tag );
		    this.input.tags.delete( tag );
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    const input				= Object.assign({}, this.input );

		    if ( input.tags )
			input.tags			= [ ...input.tags ];

		    try {
			await this.$store.dispatch("updateDna", [ this.id, input ] );

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
	    "template": await load_html("/templates/dnas/single.html"),
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
		form () {
		    return this.$refs["form"];
		},

		dna () {
		    return this.$store.getters.dna( this.id );
		},
		$dna () {
		    return this.$store.getters.$dna( this.id );
		},

		versions () {
		    const versions	= this.$store.getters.dna_versions( this.id );
		    versions.sort( this.sort_version( true ) );
		    return versions;
		},
		$versions () {
		    return this.$store.getters.$dna_versions( this.id );
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

		    this.$store.dispatch("fetchAllDnas");
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
