const { Logger }			= require('@whi/weblogger');
const log				= new Logger("guis");

const common				= require('./common.js');



module.exports = async function ( client ) {

    async function list () {
	return {
	    "template": await common.load_html("/templates/guis/list.html"),
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
			? await this.$openstate.read(`agent/${this.agent}/guis`)
			: await this.$openstate.read(`guis`);
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
		    return `${prefix} GUIs`;
		},

		agent_datapath () {
		    return `agent/${this.agent}/guis`;
		},
		...common.scopedPathComputed( c => c.agent ? c.agent_datapath : "guis", "guis", {
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
			? await this.$openstate.read(`agent/${this.agent}/guis`)
			: await this.$openstate.read(`guis`);
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await common.load_html("/templates/guis/create.html"),
	    "data": function() {
		return {
		    "datapath":		`gui/new`,
		    "tag_search_text":	"",
		    "error":		null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "gui" ),
	    },
	    "methods": {
		addTag ( tag ) {
		    if ( this.gui$.tags.indexOf( tag ) !== -1 )
			return;

		    log.info("Adding tag:", tag );
		    this.gui$.tags.push( tag );
		    this.gui$.tags.sort();
		    this.tag_search_text	= "";
		},
		removeTag ( tag ) {
		    log.info("Removing tag:", tag );
		    this.gui$.tags.splice( this.gui$.tags.indexOf( tag ), 1 );
		},
		async write () {
		    try {
			await this.$openstate.write( this.datapath );

			const new_id		= this.gui.$id;

			this.$openstate.purge( this.datapath );
			await this.$openstate.read("guis");
			await this.$openstate.read("agent/me/guis");

			this.$router.push( "/guis/" + new_id );
		    } catch ( err ) {
			log.error("Failed to create GUI:", err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/guis/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":			`gui/${id}`,
		    "releases_datapath":	`gui/${id}/releases`,
		    "release": null,
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		    await this.$openstate.read( this.releases_datapath );
		});
	    },
	    "computed": {
		deprecationModal () {
		    return this.$refs["deprecationModal"].modal;
		},
		unpublishModal () {
		    return this.$refs["unpublishModal"].modal;
		},

		...common.scopedPathComputed( c => c.datapath, "gui" ),
		...common.scopedPathComputed( c => c.releases_datapath, "releases", {
		    "default": [],
		    state ( list ) {
			list		= list.slice();
			list.sort( this.sort_version( true ) );
			return list;
		    },
		}),

		hrl () {
		    return `${this.$client._app_schema._dnas.happs._hash}:${this.id}`;
		    // return `${this.$client._app_schema._dnas.happs._hash}:${this.id}@${this.$root.agent_id}`;
		},

		focused_release_datapath () {
		    return this.release ? `gui/release/${this.release.$id}` : this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.focused_release_datapath, "focused_release" ),

		deprecated () {
		    return !!( this.gui && this.gui.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		    this.$openstate.read( this.releases_datapath );
		},
		async deprecate () {
		    log.normal("Deprecating GUI %s", this.gui.name );
		    await this.$openstate.write( this.datapath, "deprecation" );

		    this.deprecationModal.hide();

		    await this.$openstate.read("guis");
		    await this.$openstate.read("agent/me/guis");
		},
		promptUnpublish ( release ) {
		    this.release	= release;
		    this.unpublishModal.show();
		},
		async unpublish () {
		    await this.$openstate.delete( this.focused_release_datapath, "unpublish" );

		    this.unpublishModal.hide();
		    await this.$openstate.read( this.releases_datapath );
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/guis/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":		`gui/${id}`,
		    "tag_search_text":	"",
		    "error": null,
		};
	    },
	    "computed": {
		gui () {
		    return this.$openstate.state[ this.datapath ];
		},
		$gui () {
		    return this.$openstate.metastate[ this.datapath ];
		},
		input () {
		    return this.$openstate.mutable[ this.datapath ];
		},
		$rejections () {
		    return this.$openstate.rejections[ this.datapath ];
		},
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		});
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
		async update () {
		    try {
			await this.$openstate.write( this.datapath );

			this.$router.push( "/guis/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update Gui (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    return {
	list,
	create,
	single,
	update,
    };
};
