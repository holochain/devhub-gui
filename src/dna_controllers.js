const { Logger }			= require('@whi/weblogger');
const log				= new Logger("dnas");

const common				= require('./common.js');


module.exports = async function ( client ) {
    async function list () {
	return {
	    "template": await common.load_html("/templates/dnas/list.html"),
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
			? await this.$openstate.get( this.agent_datapath )
			: await this.$openstate.get(`dnas`);
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
		    return `${prefix} DNAs`;
		},

		agent_datapath () {
		    return `agent/${this.agent}/dnas`;
		},
		...common.scopedPathComputed( c => c.agent ? c.agent_datapath : "dnas", "dnas", {
		    "default": [],
		    state ( list ) {
			list			= list.filter( entity => {
			    const filter	= this.list_filter.trim();

			    if ( filter === "" )
				return true;

			    let words		= filter.split(/\s+/);

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
			? await this.$openstate.read( this.agent_datapath )
			: await this.$openstate.read(`dnas`);
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await common.load_html("/templates/dnas/create.html"),
	    "data": function() {
		return {
		    "datapath":		`dna/new`,
		    "tag_search_text":	"",
		    "error":		null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "dna" ),
	    },
	    "methods": {
		addTag ( tag ) {
		    if ( !Array.isArray( this.dna$.tags ) )
			this.dna$.tags		= [];
		    if ( this.dna$.tags.indexOf( tag ) !== -1 )
			return;

		    log.info("Adding tag:", tag );
		    this.dna$.tags.push( tag );
		    this.dna$.tags.sort();
		    this.tag_search_text	= "";
		},
		removeTag ( tag ) {
		    log.info("Removing tag:", tag );
		    this.dna$.tags.splice( this.dna$.tags.indexOf( tag ), 1 );
		},
		async write () {
		    try {
			await this.$openstate.write( this.datapath );

			const new_id		= this.dna.$id;
			this.$openstate.purge( this.datapath );

			await this.$openstate.read("dnas");

			this.$router.push( "/dnas/" + new_id );
		    } catch ( err ) {
			log.error("Failed to create DNA:", err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/dnas/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":			`dna/${id}`,
		    "versions_datapath":	`dna/${id}/versions`,
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
		...common.scopedPathComputed( c => c.datapath, "dna" ),
		...common.scopedPathComputed( c => c.versions_datapath, "versions", {
		    "default": [],
		    state ( list ) {
			list		= list.slice();
			list.sort( this.sort_version( true ) );
			return list;
		    },
		}),

		focused_version_datapath () {
		    return this.version ? `dna/version/${this.version.$id}` : this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.focused_version_datapath, "focused_version" ),

		deprecationModal () {
		    return this.$refs["modal"].modal;
		},
		unpublishModal () {
		    return this.$refs["unpublishModal"].modal;
		},
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		    this.$openstate.read( this.versions_datapath );
		},
		async deprecate () {
		    log.normal("Deprecating DNA %s", this.dna.name );
		    await this.$openstate.write( this.datapath, "deprecation" );

		    this.deprecationModal.hide();

		    await this.$openstate.read("dnas");
		    await this.$openstate.read("agent/me/dnas");
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
	    "template": await common.load_html("/templates/dnas/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":		`dna/${id}`,
		    "tag_search_text":	"",
		    "error":		null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "dna" ),
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		});
	    },
	    "methods": {
		addTag ( tag ) {
		    if ( !Array.isArray( this.dna$.tags ) )
			this.dna$.tags		= [];
		    if ( this.dna$.tags.indexOf( tag ) !== -1 )
			return;

		    log.info("Adding tag:", tag );
		    this.dna$.tags.push( tag );
		    this.dna$.tags.sort();
		    this.tag_search_text	= "";
		},
		removeTag ( tag ) {
		    log.info("Removing tag:", tag );
		    this.dna$.tags.splice( this.dna$.tags.indexOf( tag ), 1 );
		},
		async write () {
		    try {
			await this.$openstate.write( this.datapath );

			await this.$openstate.read("dnas");
			await this.$openstate.read("agent/me/dnas");

			this.$router.push( "/dnas/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update DNA (%s):", String(this.id), err );
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
