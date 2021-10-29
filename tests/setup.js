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

const DNAREPO				= path.resolve( __dirname, "../dnas/dnarepo.dna" );
const HAPPS				= path.resolve( __dirname, "../dnas/happs.dna" );
const WEBASSETS				= path.resolve( __dirname, "../dnas/web_assets.dna" );
const PORT				= 35678;

const admin				= new AdminClient( PORT );

function print ( msg, ...args ) {
    console.log(`\x1b[37m${msg}\x1b[0m`, ...args );
}

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

	const dna_resources		= {
	    "dnarepo":		DNAREPO,
	    "happs":		HAPPS,
	    "webassets":	WEBASSETS,
	};
	const dna_hashes		= {};

	for (let [nickname, package_filepath] of Object.entries( dna_resources ) ) {
	    const hash			= await admin.registerDna( package_filepath );

	    const hash_file		= path.resolve( __dirname, `${nickname.toUpperCase()}_HASH` );
	    print("'%s' storing hash @ %s: %s", nickname, hash_file, hash.toString() );
	    console.log(hash);

	    fs.writeFileSync( hash_file, hash.toString() );

	    dna_hashes[nickname]	= hash;
	}

	const agent_file		= path.resolve( __dirname, AGENT_FILENAME );
	if ( fs.existsSync( agent_file ) )
	    return print("Not installing because `%s` already exists", agent_file );

	const agent_hash		= await admin.generateAgent();
	print("Agent hash: %s (%s)", agent_hash.toString(), AGENT_NICKNAME );
	console.log( agent_hash );
	fs.writeFileSync( agent_file, agent_hash.toString() );

	try {
	    const installation		= await admin.installApp( APP_ID, agent_hash, dna_hashes );
	    console.log( installation );
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
    } finally {
	await admin.close();
    }
})();
