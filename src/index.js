const { Logger }			= require('@whi/weblogger');
const log				= new Logger("main");

const json				= require('@whi/json');
const { CruxConfig,
	EntityArchitect,
	...crux }			= CruxPayloadParser;
const { AgentClient,
	TimeoutError }			= HolochainClient;
const { DnaHash,
	AgentPubKey }			= holohash;


log.level.trace && crux.log.setLevel("trace");

const store_init			= require('./store.js');
const common				= require('./common.js');
const filters				= require('./filters.js');
const components			= require('./components/index.js');
const entity_types			= require('./entity_architecture.js');

const zomes_init			= require('./zome_controllers.js');
const zome_versions_init		= require('./zome_version_controllers.js');
const dnas_init				= require('./dna_controllers.js');
const dna_versions_init			= require('./dna_version_controllers.js');
const happs_init			= require('./happ_controllers.js');
const happ_releases_init		= require('./happ_release_controllers.js');


const HISTORY_PUSH_STATE		= window.localStorage.getItem("PUSH_STATE");
const AGENT_HASH			= window.localStorage.getItem("AGENT_PUBKEY");
const HOST_VALUE			= window.localStorage.getItem("APP_HOST");
const PORT_VALUE			= window.localStorage.getItem("APP_PORT");
const APP_PORT				= parseInt( PORT_VALUE ) || 44001;
const APP_HOST				= HOST_VALUE || "localhost";
const CONDUCTOR_URI			= `${APP_HOST}:${APP_PORT}`;

if ( isNaN( APP_PORT ) )
    throw new Error(`Invalid 'APP_PORT' (${PORT_VALUE}); run 'localStorage.setItem( "APP_PORT", "<port number>" );`);

const DNAREPO_HASH			= new DnaHash( process.env.DNAREPO_HASH );
const HAPPS_HASH			= new DnaHash( process.env.HAPPS_HASH );
const WEBASSETS_HASH			= new DnaHash( process.env.WEBASSETS_HASH );



window.PersistentStorage		= {
    setItem ( key, input ) {
	const value			= JSON.stringify( input );
	log.trace("Setting locally stored item '%s':", key, value );
	return window.localStorage.setItem( key, value );
    },
    getItem ( key ) {
	const value			= window.localStorage.getItem( key );
	log.trace("Getting locally stored item '%s':", key, value );
	try {
	    return JSON.parse( value );
	} catch (err) {
	    window.localStorage.removeItem( key );
	    return null;
	}
    },
};



(async function(global) {
    // Where do these things come from?
    //
    // Launcher context:
    //
    //   entity_architecture	- ./entity_architecture.js
    //   essence_errors		- Hard-coded
    //   dna_map		- Launcher config
    //   agent			- Launcher config
    //   connection		- Launcher config
    //
    // Hard-coded:
    //
    //   entity_architecture	- ./entity_architecture.js
    //   essence_errors		- Hard-coded
    //   dna_map		- Environment variables
    //   agent			- Local storage
    //   connection		- Local storage
    //
    const crux_config			= new CruxConfig( entity_types, [] );

    let  client;
    try {
	const resp			= await fetch("./.launcher-env.json");
	const launcher_config		= await resp.json();

	client				= await AgentClient.createFromAppInfo(
	    launcher_config.INSTALLED_APP_ID,
	    launcher_config.APP_INTERFACE_PORT
	);
    } catch (err) {
	log.warn("Using hard-coded configuration because launcher config produced error: %s", err.toString() );
    }

    if ( !client ) {
	if ( typeof AGENT_HASH !== "string" )
	    throw new Error(`Missing "AGENT_PUBKEY" in local storage; run 'localStorage.setItem( "AGENT_PUBKEY", "<holo hash>" );`);

	log.warn("Using Agent hash: %s", AGENT_HASH );
	const AGENT_PUBKEY		= new AgentPubKey( AGENT_HASH );

	client				=  new AgentClient( AGENT_PUBKEY, {
	    "dnarepo":         DNAREPO_HASH,
	    "happs":           HAPPS_HASH,
	    "webassets":       WEBASSETS_HASH,
	}, CONDUCTOR_URI );
    }

    log.normal("App schema");
    log.level.normal && Object.entries( client._app_schema._dnas ).forEach( ([nick, schema]) => {
	log.normal("  %s : %s", nick.padStart( 10 ), String( schema._hash ), schema );

	log.level.info && Object.entries( schema._zomes ).forEach( ([name, zome_api]) => {
	    log.info("  %s : %s", name.padStart( 10 ), zome_api._name, zome_api );
	});
    });

    client.addProcessor("input", async function (input) {
	let keys			= input ? ` ${Object.keys( input ).join(", ")} ` : "";
	log.trace("Calling %s::%s->%s(%s)", this.dna, this.zome, this.func, keys );
	return input;
    });
    client.addProcessor("output", async function (output) {
	log.trace("Response for %s::%s->%s(%s)", this.dna, this.zome, this.func, this.input ? " ... " : "", output );
	return output;
    });

    if ( WEBPACK_MODE === "development" ) {
	client.addProcessor("input", async function (input) {
	    await new Promise( f => setTimeout(f, (Math.random() * 1_000) + 500) ); // range 500ms to 1500ms
	    return input;
	});
    }
    crux_config.upgrade( client );

    log.normal("Connecting client for Agent %s to '%s' (mode: %s)", String(client._agent), client._conn._uri, WEBPACK_MODE );

    const store				= await store_init( client, Vue );
    const zome_controllers		= await zomes_init( client );
    const zome_version_controllers	= await zome_versions_init( client );
    const dna_controllers		= await dnas_init( client );
    const dna_version_controllers	= await dna_versions_init( client );
    const happ_controllers		= await happs_init( client );
    const happ_release_controllers	= await happ_releases_init( client );

    const route_components		= [
	[ "/",					happ_controllers.list,			"Dashboard" ],

	[ "/happs",				happ_controllers.list,			"All hApps" ],
	[ "/happs/new",				happ_controllers.create,		"Add hApp" ],
	[ "/happs/:id",				happ_controllers.single,		"hApp Info" ],
	[ "/happs/:id/update",			happ_controllers.update,		"Edit hApp" ],
	[ "/happs/:id/upload",			happ_controllers.upload,		"Upload Bundle" ],
	[ "/happs/:happ/releases/new",		happ_release_controllers.create,	"Add hApp Release" ],
	[ "/happs/:happ/releases/:id",		happ_release_controllers.single,	"hApp Release Info" ],
	[ "/happs/:happ/releases/:id/update",	happ_release_controllers.update,	"Edit Release" ],

	[ "/dnas",				dna_controllers.list,			"DNAs" ],
	[ "/dnas/new",				dna_controllers.create,			"Add DNA" ],
	[ "/dnas/:id",				dna_controllers.single,			"DNA Info" ],
	[ "/dnas/:id/update",			dna_controllers.update,			"Edit DNA" ],
	[ "/dnas/:dna/versions/new",		dna_version_controllers.create,		"Add DNA Version" ],
	[ "/dnas/:dna/versions/:id",		dna_version_controllers.single,		"DNA Version Info" ],
	[ "/dnas/:dna/versions/:id/update",	dna_version_controllers.update,		"Edit Version" ],

	[ "/zomes",				zome_controllers.list,			"Zomes" ],
	[ "/zomes/new",				zome_controllers.create,		"Add Zome" ],
	[ "/zomes/:id",				zome_controllers.single,		"Zome Info" ],
	[ "/zomes/:id/update",			zome_controllers.update,		"Edit Zome" ],
	[ "/zomes/:zome/versions/new",		zome_version_controllers.create,	"Add Zome Version" ],
	[ "/zomes/:zome/versions/:id",		zome_version_controllers.single,	"Zome Version Info" ],
	[ "/zomes/:zome/versions/:id/update",	zome_version_controllers.update,	"Edit Version" ],
    ];

    const breadcrumb_mapping		= {};
    const routes			= [];
    for (let [ path, component, name ] of route_components ) {
	log.trace("Adding route path: %s", path );

	if ( /\/(:[A-Za-z-_+]+)/.test( path ) ) {
	    const re			= "^" + path.replace(/\/(:[A-Za-z-_+]+)/g, "/[A-Za-z0-9-_+]+") + "$";
	    breadcrumb_mapping[ re ]	= name;
	}
	else
	    breadcrumb_mapping[ path ]	= name;

	routes.push({
	    path,
	    component,
	});
    }
    log.normal("Configured %s routes for App", routes.length );

    const router			= VueRouter.createRouter({
	"history": HISTORY_PUSH_STATE === "true"
	    ? VueRouter.createWebHistory()
	    : VueRouter.createWebHashHistory(),
	routes,
	"linkActiveClass": "parent-active",
	"linkExactActiveClass": "active",
    });

    const app				= Vue.createApp({
	data () {
	    return {
		"agent_id": null,
		"show_copied_message": false,
		"status_view_data": null,
		"status_view_html": null,
	    };
	},
	"computed": {
	    agent () {
		return this.$store.getters.agent.entity;
	    },
	    $agent () {
		return this.$store.getters.agent.metadata;
	    },
	},
	async created () {
	    this.$router.afterEach( (to, from, failure) => {
		if ( failure instanceof Error )
		    return log.error("Failed to Navigate:", failure );

		log.normal("Navigated to:", to.path, from.path );

		if ( to.matched.length === 0 )
		    return this.showStatusView( 404 );

		this.showStatusView( false );
	    });

	    try {
		let agent_info		= await this.$store.dispatch("fetchAgent");

		this.agent_id		= agent_info.pubkey.initial;
	    } catch (err) {
		if ( err instanceof TimeoutError )
		    return this.showStatusView( 408, {
			"title": "Connection Timeout",
			"message": `Request Timeout - Client could not connect to the Conductor interface`,
			"details": [
			    `${err.name}: ${err.message}`,
			],
		    });
		else
		    console.error( err );
	    }

	},
	"methods": {
	    copyAgentId () {
		this.copyToClipboard( this.agent_id );
		this.show_copied_message	= true;

		setTimeout( () => {
		    this.show_copied_message	= false;
		}, 5_000 );
	    },
	},
    });

    app.mixin({
	data () {
	    return {
		"json":			json,
		"Entity":		EntityArchitect.Entity,
		"Collection":		EntityArchitect.Collection,

		$debug ( value ) {
		    log.trace("JSON debug for value:", value );
		    return json.debug( value );
		},
		console,
	    };
	},
	"methods": {
	    async catchStatusCodes ( status_codes, err ) {
		if ( !Array.isArray(status_codes) )
		    status_codes	= [ status_codes ];

		status_codes.forEach( (code, i) => {
		    status_codes[i]	= parseInt( code );
		});

		if ( status_codes.includes( 404 ) && err.name === "EntryNotFoundError" )
		    this.$root.showStatusView( 404 );
		else if ( status_codes.includes( 500 ) )
		    this.$root.showStatusView( 500 );
	    },

	    async showStatusView ( status, data = null ) {
		if ( !status ) { // reset status view
		    this.$root.status_view_html = null;
		    return;
		}

		if ( data ) {
		    this.$root.status_view_data = Object.assign( {
			"code": status,
			"title": "It's not me, it's you",
			"message": "Default HTTP Code Name",
			"details": null,
		    }, data );
		    this.$root.status_view_html = true;

		    return;
		}

		try {
		    this.$root.status_view_html = await common.load_html(`/templates/${status}.html`);
		} catch (err) {
		    log.error("%s", err.message, err );
		    this.$root.status_view_html = await common.load_html(`/templates/500.html`);
		}
	    },

	    getPathId ( key ) {
		const path_id		= this.$route.params[key];

		try {
		    return new holohash.EntryHash( path_id );
		} catch (err) {
		    if ( err instanceof holohash.HoloHashError ) {
			this.showStatusView( 400, {
			    "title": "Invalid Identifier",
			    "message": `Invalid Holo Hash in URL path`,
			    "details": [
				`<code>${path_id}</code>`,
				`${err.name}: ${err.message}`,
			    ],
			});
		    }

		    throw err;
		}
	    },

	    ...common,
	},
    });

    Object.assign( app.config.globalProperties, {
	"$client":		client,
	"$filters":		filters,
	breadcrumb_mapping,
    });

    app.config.errorHandler		= function (err, vm, info) {
	log.error("Vue App Error (%s):", info, err, vm );
    };

    for ( let tag in components ) {
	app.component( tag, components[tag] );
    }

    app.use( router );
    app.use( store );
    app.mount("#app");

    global._App				= app;
    global._Router			= router;

    log.info("Finished App configuration and mounting");
})(window);
