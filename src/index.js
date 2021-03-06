const { Logger }			= require('@whi/weblogger');
const log				= new Logger("main");

const json				= require('@whi/json');
const { EntityArchitect,
	...crux }			= CruxPayloadParser;
const { TimeoutError }			= HolochainClient;
const { AgentPubKey }			= holohash;


log.level.trace && crux.log.setLevel("trace");

const client_init			= require('./client.js');
const store_init			= require('./store.js');
const common				= require('./common.js');
const filters				= require('./filters.js');

const zomes_init			= require('./zome_controllers.js');
const zome_versions_init		= require('./zome_version_controllers.js');
const dnas_init				= require('./dna_controllers.js');
const dna_versions_init			= require('./dna_version_controllers.js');
const happs_init			= require('./happ_controllers.js');
const happ_releases_init		= require('./happ_release_controllers.js');


const HISTORY_PUSH_STATE		= window.localStorage.getItem("PUSH_STATE");



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
    const client			= await client_init();
    log.normal("Connecting client for Agent %s to '%s' (mode: %s)", String(client._agent), client._conn._uri, WEBPACK_MODE );

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
	[ "/happs/:id/upload",			happ_release_controllers.upload,	"Upload Bundle" ],
	[ "/happs/:happ/releases/new",		happ_release_controllers.create,	"Add hApp Release" ],
	[ "/happs/:happ/releases/:id",		happ_release_controllers.single,	"hApp Release Info" ],
	[ "/happs/:happ/releases/:id/update",	happ_release_controllers.update,	"Edit Release" ],

	[ "/dnas",				dna_controllers.list,			"DNAs" ],
	[ "/dnas/new",				dna_controllers.create,			"Add DNA" ],
	[ "/dnas/:id",				dna_controllers.single,			"DNA Info" ],
	[ "/dnas/:id/update",			dna_controllers.update,			"Edit DNA" ],
	[ "/dnas/:id/upload",			dna_version_controllers.upload,		"Upload Bundle" ],
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
		return this.$store.getters.agent;
	    },
	    $agent () {
		return this.$store.getters.$agent;
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

		this.agent_id		= agent_info.pubkey.current;
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

    const store				= await store_init( client );

    app.mixin({
	data () {
	    return {
		"json":			json,
		"Entity":		EntityArchitect.Entity,
		"Collection":		EntityArchitect.Collection,

		console,
	    };
	},
	"methods": {
	    $debug ( value ) {
		log.trace("JSON debug for value:", value );
		return json.debug( value );
	    },

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

    const components			= [
	"Breadcrumbs",
	"DeprecationAlert",
	"DisplayError",
	"HoloHash",
	"InputFeedback",
	"ListGroup",
	"ListGroupItem",
	"Loading",
	"Modal",
	"PageHeader",
	"PageView",
	"Placeholder",
	"Search",

	"ZomeCard",
	"ZomeVersionCard",
	"DnaCard",
	"DnaVersionCard",
	"HappCard",
	"HappReleaseCard",
    ];
    await Promise.all(
	components.map( async name => {
	    const start			= Date.now();

	    const tag			= common.toKebabCase( name );
	    const component		= require(`./components/${name}.js`)( tag, name );
	    component.template		= await common.load_html(`/dist/components/${name}.html`);
	    component.errorCaptured	= function (err, vm, info) {
		console.error("Error in %s <%s>:", name, tag, err, vm, info, err.data );
		this.error = `${err.stack}\n\nfound in ${info} of component`
		return false
	    };
	    app.component( tag, component );

	    log.info("Loaded and/or added component: %s (%sms)", tag, Date.now() - start );
	})
    );
    log.normal("Configured %s components for App", components.length );

    app.use( router );
    app.use( store );
    app.mount("#app");

    global._App				= app;
    global._Router			= router;

    log.info("Finished App configuration and mounting");
})(window);
