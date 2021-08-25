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
const zomes_init			= require('./zome_controllers.js');
const zome_versions_init		= require('./zome_version_controllers.js');


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

    const zome_controllers		= await zomes_init( client );
    const zome_version_controllers	= await zome_versions_init( client );

    const route_components		= [
	[ "/",					zome_controllers.list,			"Dashboard" ],
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
	"history": VueRouter.createWebHistory(),
	routes,
	"linkActiveClass": "parent-active",
	"linkExactActiveClass": "active",
    });

    const app				= Vue.createApp({
	data () {
	    return {
		"status_view_html": null,
	    };
	},
	created () {
	    this.$router.afterEach( (to, from, failure) => {
		log.normal("Navigated to:", to, from, failure );

		if ( to.matched.length === 0 )
		    return this.showStatusView( 404 );

		this.showStatusView( false );
	    });
	},
    });

    app.mixin({
	data () {
	    return {
		"_debounce_timers": {},
	    };
	},
	"methods": {
	    async showStatusView ( status ) {
		if ( !status ) {
		    this.$root.status_view_html = null;
		    return;
		}

		try {
		    this.$root.status_view_html = (await import(`./templates/${status}.html`)).default;
		} catch (err) {
		    log.error("%s", err.message, err );
		    this.$root.status_view_html = (await import(`./templates/500.html`)).default;
		}
	    },
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

	    debounce ( callback, delay = 1_000, id ) {
		if ( id === undefined )
		    id			= String(callback);

		const toid		= this._debounce_timers[id];

		if ( toid ) {
		    clearTimeout( toid );
		    delete this._debounce_timers[id];
		}

		this._debounce_timers[id] = setTimeout( () => {
		    callback.bind(this);
		    delete this._debounce_timers[id];
		}, delay );
	    },

	    load_file ( file ) {
		log.normal("Load file:", file );
		return new Promise((f,r) => {
		    let reader			= new FileReader();

		    reader.readAsArrayBuffer( file );
		    reader.onerror			= function (err) {
			log.error("FileReader error event:", err );

			r( err );
		    };
		    reader.onload			= function (evt) {
			log.info("FileReader load event:", evt );
			let result			= new Uint8Array( evt.target.result );
			log.debug("FileReader result:", result );

			f( result );
		    };
		    reader.onprogress		= function (p) {
			log.trace("progress:", p );
		    };
		});
	    },

	    download ( filename, ...bytes ) {
		log.normal("Downloading bytes (%s bytes) as '%s'", bytes.length, filename );

		const blob		= new Blob( bytes );
		const link		= document.createElement("a");
		link.href		= URL.createObjectURL( blob );
		link.download		= filename;

		link.click();
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
