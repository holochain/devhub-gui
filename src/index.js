const { Logger }			= require('@whi/weblogger');
const log				= new Logger("main");

const Vue				= require('vue');
const VueRouter				= require('vue-router');

const { Client, HoloHashes,
	logging }			= require('@holochain/devhub-entities');
const { HoloHash,
	DnaHash,
	AgentPubKey }			= HoloHashes;

log.level.trace && logging();

const { sort_by_object_key }		= require('./common.js');
const filters				= require('./filters.js');
const components			= require('./components.js');
const zomes_init			= require('./zomes_controllers.js');


const AGENT_HASH			= window.localStorage.getItem("AGENT_PUBKEY");
const PORT_VALUE			= window.localStorage.getItem("APP_PORT");
const APP_PORT				= parseInt( PORT_VALUE );
const CONDUCTOR_URI			= `devhub.holochain.org:${APP_PORT}`;

if ( isNaN( APP_PORT ) )
    throw new Error(`Invalid 'APP_PORT' (${PORT_VALUE}); run 'localStorage.setItem( "APP_PORT", "<port number>" );`);

if ( typeof AGENT_HASH !== "string" )
    throw new Error(`Missing "AGENT_PUBKEY" in local storage; run 'localStorage.setItem( "AGENT_PUBKEY", "<holo hash>" );`);

log.warn("Using Agent hash: %s", AGENT_HASH );
const AGENT_PUBKEY			= new AgentPubKey( AGENT_HASH );

const DNAREPO_HASH			= new DnaHash( process.env.DNAREPO_HASH );
const HAPPS_HASH			= new DnaHash( process.env.HAPPS_HASH );
const WEBASSETS_HASH			= new DnaHash( process.env.WEBASSETS_HASH );

log.normal("DNA Hashes");
const dnas				= {
    "dnarepo":		DNAREPO_HASH,
    "happs":		HAPPS_HASH,
    "webassets":	WEBASSETS_HASH,
};
log.level.normal && Object.entries( dnas ).forEach( ([nick, hash]) => {
    log.normal("  %s : %s", nick.padStart( 10 ), String( hash ) );
});


window.Vue				= Vue;


(async function(global) {
    log.normal("Connecting client for Agent %s to '%s' (mode: %s)", String(AGENT_PUBKEY), CONDUCTOR_URI, WEBPACK_MODE );
    const client			= new Client( AGENT_PUBKEY, dnas, CONDUCTOR_URI, {
	"simulate_latency": (WEBPACK_MODE === "development"),
    });

    const zomes_controllers		= await zomes_init( client );

    const route_components		= [
	[ "/",					zomes_controllers.zomes,	"Dashboard" ],
	[ "/zomes",				zomes_controllers.zomes,	"Zomes" ],
	[ "/zomes/new",				zomes_controllers.create_zome,	"Add Zome" ],
	[ "/zomes/:id",				zomes_controllers.single_zome,	"Zome Info" ],
	[ "/zomes/:id/update",			zomes_controllers.update_zome,	"Edit Zome" ],
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
	"history": VueRouter.createWebHistory(),
	routes,
	"linkActiveClass": "parent-active",
	"linkExactActiveClass": "active",
    });

    const app				= Vue.createApp({
	data () {
	    return {
	    };
	},
	"methods": {
	},
    });

    app.mixin({
	"methods": {
	    dataImage ( bytes ) {
		return 'data:image/png;base64,' + "TODO: make base64 thing";
	    },

	    sort_by_object_key,

	    copy ( src, dest, ...keys ) {
		let fkey		= keys.pop();

		keys.forEach( key => {
		    if ( src === null || typeof src !== "object" )
			log.error("Source object is type '%s'; must be an object", typeof src );
		    if ( dest === null || typeof dest !== "object" )
			log.error("Destination object is type '%s'; must be an object", typeof dest );

		    src			= src[key];

		    if ( dest[key] === undefined ) // create the path for destination object
			dest[key]	= {};

		    dest		= dest[key];
		});

		dest[fkey]		= src[fkey];
	    },
	},
    });

    app.config.globalProperties.breadcrumb_mapping = breadcrumb_mapping;
    app.config.globalProperties.$filters = filters;
    app.config.errorHandler		= function (err, vm, info) {
	log.error("Vue App Error (%s):", info, err, vm );
    };

    for ( let tag in components ) {
	app.component( tag, components[tag] );
    }

    app.use( router );
    app.mount("#app");

    global.App				= app;
    global.Router			= router;

    log.info("Finished App configuration and mounting");
})(window);
