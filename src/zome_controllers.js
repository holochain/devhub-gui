const { Logger }			= require('@whi/weblogger');
const log				= new Logger("zomes");

const { AgentPubKey }			= holohash;
const { load_html }			= require('./common.js');


module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": await load_html("/templates/zomes/list.html"),
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
		    )  + " Zomes";
		},
		agent () {
		    return this.agent_input.length ? this.agent_input : "me";
		},
		zomes () {
		    const zomes		= (
			this.agent_input.length
			    ? this.$store.getters.zomes( this.agent )
			    : this.$store.getters.zomes( "all" )
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

		    zomes.sort( this.sort_by_key( this.order_by, this.reverse_order ) );

		    return zomes;
		},
		$zomes () {
		    return this.agent_input.length
			? this.$store.getters.$zomes( this.agent )
			: this.$store.getters.$zomes( "all" );
		},
	    },
	    "methods": {
		async refresh () {
		    if ( this.zomes.length === 0 )
			await this.fetchZomes();
		},
		async updateAgent ( input ) {
		    if ( input === "" )
			this.agent_filter = null;
		    else if ( this.isAgentPubKey( input ) )
			this.agent_filter	= new AgentPubKey( input );
		    else
			return;

		    PersistentStorage.setItem("LIST_FILTER", this.agent_filter );

		    await this.fetchZomes();
		},
		async fetchZomes () {
		    if ( this.agent_input.length )
			await this.fetchAgentZomes();
		    else
			await this.fetchAllZomes();
		},
		async fetchAgentZomes () {
		    try {
			await this.$store.dispatch("fetchZomes", { "agent": this.agent });
		    } catch (err) {
			log.error("Failed to get zomes: %s", err.message, err );
		    }
		},
		async fetchAllZomes () {
		    try {
			await this.$store.dispatch("fetchAllZomes");
		    } catch (err) {
			log.error("Failed to get zomes: %s", err.message, err );
		    }
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await load_html("/templates/zomes/create.html"),
	    "data": function() {
		return {
		    "error": null,
		    "input": {
			"name": null,
			"description": null,
			"zome_type": null,
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
			const zome	= await this.$store.dispatch("createZome", input );

			this.$store.dispatch("fetchAllZomes");
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
	    "template": await load_html("/templates/zomes/update.html"),
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
		zome () {
		    return this.$modwc.state[ this.datapath ];
		},
		$zome () {
		    return this.$modwc.metastate[ this.datapath ];
		},
		$errors () {
		    return this.$modwc.errors[ this.datapath ];
		},
		form () {
		    return this.$refs["form"];
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");
		this.datapath		= `zome/${this.id}`;

		if ( !this.zome )
		    await this.fetchZome();

		this.input		= this.$modwc.mutable[ this.datapath ];
		this.input.tags.sort();

		window.$input		= this.input;
	    },
	    "methods": {
		async fetchZome () {
		    try {
			await this.$modwc.read( this.datapath );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get zome (%s): %s", String(this.id), err.message, err );
		    }
		},
		addTag ( tag ) {
		    if ( this.input.tags.indexOf( tag ) !== -1 )
			return;

		    log.info("Adding tag:", tag );
		    this.input.tags.push( tag );
		    this.input.tags.sort();
		    this.tag_search_text	= "";
		},
		removeTag ( tag ) {
		    log.info("Removing tag:", tag );
		    this.input.tags.splice( this.input.tags.indexOf( tag ), 1 );
		},
		async update () {
		    this.validated		= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$modwc.write( this.datapath );

			// this.$store.dispatch("fetchZomes", { "agent": "me" });
			// this.$store.dispatch("fetchAllZomes");

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
	    "template": await load_html("/templates/zomes/single.html"),
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
		this.datapath		= `zome/${this.id}`;
		this.versions_datapath	= `zome/${this.id}/versions`;

		if ( !this.zome )
		    this.fetchZome();
		if ( !this.versions.length )
		    this.fetchZomeVersions();
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		unpublishModal () {
		    return this.$refs["unpublishModal"].modal;
		},

		zome () {
		    return this.$modwc.state[ this.datapath ];
		},
		$zome () {
		    return this.$modwc.metastate[ this.datapath ];
		},

		versions () {
		    if ( !this.$modwc.state[ this.versions_datapath ] )
			return [];
		    const versions	= this.$modwc.state[ this.versions_datapath ].slice();
		    versions.sort( this.sort_version( true ) );
		    return versions;
		},
		$versions () {
		    return this.$modwc.metastate[ this.versions_datapath ];
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
		    try {
			await this.$modwc.read( this.datapath );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get zome (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchZomeVersions () {
		    try {
			await this.$modwc.read( this.versions_datapath );
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

		    this.$store.dispatch("fetchAllZomes");
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
