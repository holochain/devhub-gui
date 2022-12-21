const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

global.WebSocket			= require('ws');

const fs				= require('fs');
const { AdminClient,
	ConductorError,
	...hc_client }			= require('@whi/holochain-client');

if ( process.env.LOG_LEVEL )
    hc_client.logging();

const HAPP_PATH				= path.resolve( __dirname, "../bundled/DevHub.happ" );
const PORT				= 35678;

const admin				= new AdminClient( PORT );

function print ( msg, ...args ) {
    console.log(`\x1b[37m${msg}\x1b[0m`, ...args );
}


const CAP_GRANT_CONFIG			= {
    "dnarepo": {
	"dna_library": [
	    "whoami",

	    "create_profile", "get_profile", "update_profile",
	    "follow_developer", "get_following", "unfollow_developer",

	    "create_zome", "get_zome", "update_zome", "deprecate_zome",
	    "get_my_zomes", "get_zomes", "get_all_zomes", "get_zomes_by_filter", "get_zomes_by_tags",

	    "create_zome_version", "get_zome_version", "update_zome_version", "delete_zome_version",
	    "get_zome_versions", "get_zome_versions_by_filter",

	    "create_dna", "get_dna", "update_dna", "deprecate_dna",
	    "get_my_dnas", "get_dnas", "get_all_dnas", "get_dnas_by_filter", "get_dnas_by_tags",

	    "create_dna_version", "get_dna_version", "update_dna_version", "delete_dna_version",
	    "get_dna_versions", "get_dna_versions_by_filter",

	    "get_dna_package",
	    "get_hdk_versions",

	    "get_zome_versions_by_hdk_version",
	    "get_dna_versions_by_hdk_version",
	    "get_zomes_with_an_hdk_version",
	    "get_dnas_with_an_hdk_version",

	    "create_zome_version_review_summary",
	],
	"reviews": [
	    "create_review", "get_review", "update_review", "delete_review",
	    "get_my_reviews", "get_reviews_for_subject",

	    "get_review_summary", "update_review_summary",
	    "get_review_summaries_for_subject",

	    "create_reaction", "update_reaction", "delete_reaction",
	    "get_my_reactions", "get_reactions_for_subject",

	    "create_review_reaction_summary",
	],
    },
    "happs": {
	"happ_library": [
	    "whoami",

	    "create_happ", "get_happ", "update_happ", "deprecate_happ",
	    "get_my_happs", "get_happs", "get_all_happs", "get_happs_by_filter", "get_happs_by_tags",

	    "create_happ_release", "get_happ_release", "update_happ_release", "delete_happ_release",
	    "get_happ_releases", "get_happ_releases_by_filter",

	    "create_gui", "get_gui", "update_gui", "deprecate_gui",
	    "get_my_guis", "get_guis", "get_all_guis", "get_guis_by_filter", "get_guis_by_tags",

	    "create_gui_release", "get_gui_release", "update_gui_release", "delete_gui_release",
	    "get_gui_releases", "get_gui_releases_by_filter",

	    "get_webasset",
	    "get_release_package",
	    "get_webhapp_package",
	],
    },
    "web_assets": {
	"web_assets": [
	    "whoami",

	    "create_file", "get_file",
	],
    },
};

(async function () {
    try {
	try {
	    await admin.attachAppInterface( 44001 );
	} catch (err) {
	    if ( !( err instanceof ConductorError
		    && err.message.includes("Address already in use") ) )
		throw err;
	}

	const AGENT_NICKNAME		= process.argv[2] || null;
	const AGENT_FILENAME		= AGENT_NICKNAME === null
	      ? "AGENT" : `AGENT_${AGENT_NICKNAME}`;
	const APP_ID			= AGENT_NICKNAME === null
	      ? "devhub" : `devhub-${AGENT_NICKNAME}`;

	const agent_file		= path.resolve( __dirname, AGENT_FILENAME );
	let agent_hash;

	if ( fs.existsSync( agent_file ) ) {
	    print("Not creating Agent because `%s` already exists", agent_file );
	    agent_hash			= new hc_client.HoloHash( fs.readFileSync( agent_file, "utf8" ) );
	} else {
	    agent_hash			= await admin.generateAgent();
	    print("Agent hash: %s (%s)", agent_hash.toString(), AGENT_NICKNAME );
	    fs.writeFileSync( agent_file, agent_hash.toString() );
	}
	console.log( agent_hash );

	try {
	    await admin.installApp( APP_ID, agent_hash, HAPP_PATH );
	} catch (err) {
	    if ( err instanceof ConductorError
		 && err.message.includes("AppAlreadyInstalled") )
		print("App '%s' is already installed", APP_ID );
	    else
		throw err;
	}

	try {
	    await admin.enableApp( APP_ID );
	} catch (err) {
	    if ( err instanceof ConductorError
		 && err.message.includes("AppNotInstalled") ) // already active
		print("App '%s' is already activated", APP_ID );
	    else
		throw err;
	}

	const apps			= (await admin.listApps( "enabled" ))
	      .reduce( (acc, info) => {
		  acc[info.installed_app_id] = info;
		  return acc;
	      }, {});
	const app_info			= apps[ APP_ID ];

	print("Creating unrestricted cap grant for testing");
	for ( let role_name in app_info.roles ) {
	    const functions		= [];

	    for ( let zome_name in CAP_GRANT_CONFIG[ role_name ] ) {
		for ( let fn_name of CAP_GRANT_CONFIG[ role_name ][ zome_name ] ) {
		    functions.push( [ zome_name, fn_name ] );
		}
	    }
	    const dna_hash		= app_info.roles[ role_name ].cell_id[0];
	    await admin.grantUnrestrictedCapability( "testing", agent_hash, dna_hash, functions );
	}
    } finally {
	await admin.close();
    }
})();
