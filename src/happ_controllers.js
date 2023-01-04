const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happs");

const common				= require('./common.js');


module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": await common.load_html("/templates/happs/list.html"),
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
			: await this.$openstate.get(`happs`);
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
		    return `${prefix} hApps`;
		},

		agent_datapath () {
		    return `agent/${this.agent}/happs`;
		},
		...common.scopedPathComputed( c => c.agent ? c.agent_datapath : "happs", "happs", {
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
			: await this.$openstate.read(`happs`);
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await common.load_html("/templates/happs/create.html"),
	    "data": function() {
		return {
		    "datapath":		`happ/new`,
		    "tag_search_text":	"",
		    "error":		null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "happ" ),
	    },
	    "methods": {
		addTag ( tag ) {
		    if ( !Array.isArray( this.happ$.tags ) )
			this.happ$.tags		= [];

		    // Tag is empty or exists
		    if ( tag.trim() === "" || this.happ$.tags.indexOf( tag ) !== -1 )
			return;

		    log.info("Adding tag:", tag );
		    this.happ$.tags.push( tag );
		    this.happ$.tags.sort();
		    this.tag_search_text	= "";
		},
		removeTag ( tag ) {
		    log.info("Removing tag:", tag );
		    this.happ$.tags.splice( this.happ$.tags.indexOf( tag ), 1 );
		},
		async create () {
		    await this.$openstate.write( this.datapath );

		    const new_id		= this.happ.$id;
		    this.$openstate.purge( this.datapath );

		    await this.$openstate.read("happs");

		    this.$router.push( "/happs/" + new_id );
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/happs/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":			`happ/${id}`,
		    "releases_datapath":	`happ/${id}/releases`,
		    "release": null,
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		    await this.$openstate.get( this.releases_datapath );
		});
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "happ" ),
		...common.scopedPathComputed( c => c.releases_datapath, "releases", {
		    "default": [],
		    state ( list ) {
			list		= list.slice();
			list.sort( this.sort_version( true ) );
			return list;
		    },
		}),

		focused_release_datapath () {
		    return this.release ? `happ/release/${this.release.$id}` : this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.focused_release_datapath, "focused_release" ),

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
		    this.$openstate.read( this.releases_datapath );
		},
		async deprecate () {
		    log.normal("Deprecating hApp %s", this.happ.name );
		    await this.$openstate.write( this.datapath, "deprecation" );

		    this.deprecationModal.hide();

		    await this.$openstate.read("happs");
		    await this.$openstate.read("agent/me/happs");
		},
		promptUnpublish ( release ) {
		    this.release	= release;
		    this.unpublishModal.show();
		},
		async unpublish () {
		    await this.$openstate.delete( this.focused_release_datapath, "unpublish" );

		    this.unpublishModal.hide();
		    await this.refresh();
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/happs/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":		`happ/${id}`,
		    "tag_search_text":	"",
		    "error":		null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "happ" ),
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		});
	    },
	    "methods": {
		addTag ( tag ) {
		    if ( !Array.isArray( this.happ$.tags ) )
			this.happ$.tags		= [];

		    // Tag is empty or exists
		    if ( tag.trim() === "" || this.happ$.tags.indexOf( tag ) !== -1 )
			return;

		    log.info("Adding tag:", tag );
		    this.happ$.tags.push( tag );
		    this.happ$.tags.sort();
		    this.tag_search_text	= "";
		},
		removeTag ( tag ) {
		    log.info("Removing tag:", tag );
		    this.happ$.tags.splice( this.happ$.tags.indexOf( tag ), 1 );
		},
		async update () {
		    try {
			await this.$openstate.write( this.datapath );

			await this.$openstate.read("happs");
			await this.$openstate.read("agent/me/happs");

			this.$router.push( "/happs/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update hApp (%s):", String(this.id), err );
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
