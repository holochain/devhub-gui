const { Logger }			= require('@whi/weblogger');
const log				= new Logger("tests-main");
localStorage.setItem("LOG_LEVEL", "trace" );

const common				= require('../../src/common.js');
const filters				= require('../../src/filters.js');
const components			= require('../../src/components/index.js');
const random_entities			= require('./random_entities.js');
const { ZomeEntry,
	ZomeVersionEntry,
	DnaEntry,
	DnaVersionEntry,
        HappEntry,
	HappReleaseEntry }		= random_entities;

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


(async function(global) {
    const breadcrumb_mapping		= {
	"/":							"Home",
	"/zomes":						"Zomes",
	"^/zomes/[A-Za-z0-9-_+]+$":				"Details",
	"^/zomes/[A-Za-z0-9-_+]+/versions$":			"Versions",
	"^/zomes/[A-Za-z0-9-_+]+/versions/[A-Za-z0-9-_+]+$":	"Zome Version Info",
    };

    const app				= Vue.createApp({
	data () {
	    const zome			= ZomeEntry();
	    const zome_versions		= new Collection( ...Array(10).fill().map( () => ZomeVersionEntry({ "parent": zome }) ) );

	    const dna			= DnaEntry();
	    const dna_versions		= new Collection( ...Array(10).fill().map( () => DnaVersionEntry({ "parent": dna }) ) );

	    const happ			= HappEntry();
	    const happ_releases		= new Collection( ...Array(10).fill().map( () => HappReleaseEntry({ "parent": happ }) ) );

	    global.zome_versions	= zome_versions;
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
	"$store":			{
	    async dispatch ( method, input ) {
		if ( method.startsWith("fetch") ) {
		    return random_entities[ method.slice(5) + "Entry" ]();
		}
	    },
	},
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

    for ( let tag in components ) {
	log.debug("Adding component: %s", tag );
	app.component( tag, components[tag] );
    }

    log.debug("Mount Vue app on: %s", "#app" );
    app.mount("#app");
})(window);
