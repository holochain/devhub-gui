const { Logger }			= require('@whi/weblogger');
const log				= new Logger("zomes");

const { load_html,
	...common }			= require('./common.js');


module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": await load_html("/templates/zomes/list.html"),
	    "data": function() {
		const agent_filter_cache	= PersistentStorage.getItem("LIST_FILTER");
		const agent_filter_query	= this.$route.query.agent;

		if ( agent_filter_cache && agent_filter_query )
		    log.warn("Overriding cached filter (%s) with value from URL search:", agent_filter_cache, agent_filter_query );

		return {
		    agent_filter_cache,
		    agent_filter_query,
		    "order_by":		"last_updated",
		    "reverse_order":	true,
		    "list_filter":	"",
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    this.agent
			? await this.$openstate.get(`agent/${this.agent}/zomes`)
			: await this.$openstate.get(`zomes`);
		});
	    },
	    "computed": {
		agent () {
		    return this.agent_filter_query || this.agent_filter_cache || null;
		},
		title () {
		    const prefix	= this.agent
			  ? (this.agent === "me" ? "My" : "Agent")
			  : "All"
		    return `${prefix} Zomes`;
		},

		agent_datapath () {
		    return `agent/${this.agent}/zomes`;
		},
		...common.scopedPathComputed( c => c.agent ? c.agent_datapath : "zomes", "zomes", {
		    "default": [],
		    state ( list ) {
			list			= list.filter( entity => {
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

			list.sort( this.sort_by_key( this.order_by, this.reverse_order ) );

			return list;
		    },
		}),
	    },
	    "methods": {
		async refresh () {
		    this.agent
			? await this.$openstate.read(`agent/${this.agent}/zomes`)
			: await this.$openstate.read(`zomes`);
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await load_html("/templates/zomes/create.html"),
	    "data": function() {
		return {
		    "datapath":		`zome/new`,
		    "tag_search_text":	"",
		    "error":		null,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},

		...common.scopedPathComputed( c => c.datapath, "zome" ),
	    },
	    "methods": {
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
		async write () {
		    try {
			await this.$openstate.write( this.datapath );

			const new_id		= this.zome.$id;
			this.$openstate.purge( this.datapath );

			await this.$openstate.read("zomes");

			this.$router.push( "/zomes/" + new_id );
		    } catch ( err ) {
			log.error("Failed to create Zome:", err );
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
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":			`zome/${id}`,
		    "versions_datapath":	`zome/${id}/versions`,
		    "version": null,
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		    await this.$openstate.get( this.versions_datapath );
		});
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		deprecationModal () {
		    return this.$refs["modal"].modal;
		},
		unpublishModal () {
		    return this.$refs["unpublishModal"].modal;
		},

		...common.scopedPathComputed( c => c.datapath, "zome" ),
		...common.scopedPathComputed( c => c.versions_datapath, "versions", {
		    "default": [],
		    state ( list ) {
			list		= list.slice();
			list.sort( this.sort_version( true ) );
			return list;
		    },
		}),

		focused_version_datapath () {
		    return this.version ? `zome/version/${this.version.$id}` : this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.focused_version_datapath, "focused_version" ),

		deprecated () {
		    return !!( this.zome && this.zome.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		    this.$openstate.read( this.versions_datapath );
		},
		async deprecate () {
		    log.normal("Deprecating Zome %s", this.zome.name );
		    await this.$openstate.write( this.datapath, "deprecation" );

		    this.deprecationModal.hide();

		    await this.$openstate.read("zomes");
		    await this.$openstate.read("agent/me/zomes");
		},
		promptUnpublish ( version ) {
		    this.version	= version;
		    this.unpublishModal.show();
		},
		async unpublish () {
		    await this.$openstate.delete( this.focused_version_datapath, "unpublish" );

		    this.unpublishModal.hide();
		    await this.refresh();
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
		    return this.$openstate.state[ this.datapath ];
		},
		$zome () {
		    return this.$openstate.metastate[ this.datapath ];
		},
		$errors () {
		    return this.$openstate.errors[ this.datapath ];
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

		this.input		= this.$openstate.mutable[ this.datapath ];
		this.input.tags.sort();
	    },
	    "methods": {
		async fetchZome () {
		    try {
			await this.$openstate.read( this.datapath );
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
			await this.$openstate.write( this.datapath );

			await this.$openstate.read("zomes");
			await this.$openstate.read("agent/me/zomes");

			this.$router.push( "/zomes/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update Zome (%s):", String(this.id), err );
			this.error	= err;
		    }
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
