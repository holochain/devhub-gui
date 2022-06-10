const { Logger }			= require('@whi/weblogger');
const log				= new Logger("tests-main");
localStorage.setItem("LOG_LEVEL", "trace" );

const common				= require('../../src/common.js');
const filters				= require('../../src/filters.js');
const client_init			= require('../../src/client.js');
const store_init			= require('../../src/store.js');
const { mock_caller }			= require('../mock_call.js');

const { HoloHash,
	AgentPubKey,
	EntryHash,
	...HoloHashTypes }		= require('@whi/holo-hash');
const { Entity,
	Collection,
	...EntityArchitect }		= require('@whi/entity-architect');


const $router				= { currentRoute: { value: {
    path: "/zomes/uhCEkd8MAdqR1Ruop1Qq5dvrXzR567hvzaT-x4x_jBZsFvZ8WDLP-/versions/uhCEkKWPMb2jv-DvR8Lfhs9FIocIOR9P4Cael86_epHUZTnVfC8mh",
} } };


async function create_collection ( amount, create_fn ) {
    return new Collection( ...await Promise.all( Array(10).fill().map( async () => await create_fn() ) ) );
}


(async function(global) {
    const client			= await client_init();
    client.call				= mock_caller;

    const store				= await store_init( client );

    const zome				= await store.dispatch("createZome", { "name": "Zome #1" });
    const zome_versions			= await create_collection( 10, async () => await store.dispatch("createZomeVersion", [ zome.$id, {
	"version": "v1",
    }]) );

    const dna				= await store.dispatch("createDna", { "name": "DNA #1" });
    const dna_versions			= await create_collection( 6, async () => await store.dispatch("createDnaVersion", [ dna.$id, {
	"version": "v1",
	"zomes": [{
	    "zome":		zome.$id,
	    "version":		zome_versions[0].$id,
	    "resource":		zome_versions[0].mere_memory_addr,
	    "resource_hash":	zome_versions[0].mere_memory_hash,
	}],
    }]) );

    const happ				= await store.dispatch("createHapp", { "title": "hApp #1" });
    const happ_releases			= await create_collection( 3, async () => await store.dispatch("createHappRelease", [ happ.$id, {
	"name": "v0.1.0",
	"dnas": [{
	    "dna":		dna.$id,
	    "version":		dna_versions[0].$id,
	    "wasm_hash":	dna_versions[0].wasm_hash,
	}],
    }]) );

    const breadcrumb_mapping		= {
	"/":							"Home",
	"/zomes":						"Zomes",
	"^/zomes/[A-Za-z0-9-_+]+$":				"Details",
	"^/zomes/[A-Za-z0-9-_+]+/versions$":			"Versions",
	"^/zomes/[A-Za-z0-9-_+]+/versions/[A-Za-z0-9-_+]+$":	"Zome Version Info",
    };

    const app				= Vue.createApp({
	data () {
	    return {
		breadcrumb_mapping,
		"zome":			zome,
		"zome_versions":	zome_versions,
		"dna":			dna,
		"dna_versions":		dna_versions,
		"happ":			happ,
		"happ_releases":	happ_releases,
		"error":		new TypeError(`This is not the right type`),
		"entry_hash":		new HoloHash("uhCEkKWPMb2jv-DvR8Lfhs9FIocIOR9P4Cael86_epHUZTnVfC8mh"),
	    };
	},
    });

    log.debug("Adding global property: [faux] $router", $router );
    Object.assign( app.config.globalProperties, {
	$router,
	"$filters":			filters,
    });

    log.debug("Defining mixins...");
    app.mixin({
	data () {
	    return {
		Entity,
		Collection,
	    };
	},
	"methods": {
	    ...common,
	},
    });

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
	    const component		= await require(`../../src/components/${name}.js`)( tag, name );
	    component.template		= await common.load_html(`/src/components/${name}.html`);
	    component.errorCaptured	= function (err, vm, info) {
		console.error("Error in %s <%s>:", name, tag, err, vm, info );
		this.error = `${err.stack}\n\nfound in ${info} of component`
		return false
	    };
	    app.component( tag, component );

	    log.normal("Loaded and/or added component: %s (%sms)", tag, Date.now() - start );
	})
    );
    log.normal("Configured %s components for App", components.length );

    app.use( store );

    log.debug("Mount Vue app on: %s", "#app" );
    app.mount("#app");
})(window);
