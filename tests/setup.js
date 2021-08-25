const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

global.WebSocket			= require('ws');

const fs				= require('fs');
const { AdminClient,
	ConductorError,
	...hc_client }			= require('@whi/holochain-client');

const DNAREPO				= path.resolve( __dirname, "../dnas/dnarepo.dna" );
const HAPPS				= path.resolve( __dirname, "../dnas/happs.dna" );
const WEBASSETS				= path.resolve( __dirname, "../dnas/webassets.dna" );
const PORT				= 34459;

const admin				= new AdminClient( PORT );

(async function () {
    try {
	try {
	    await admin.attachAppInterface( 44001 );
	} catch (err) {
	    if ( !( err instanceof ConductorError
		    && err.message.includes("Address already in use") ) )
		throw err;
	}

	const agent_hash		= await admin.generateAgent();
	console.log( agent_hash );

	const dnarepo_hash		= await admin.registerDna( DNAREPO );
	console.log( dnarepo_hash );
	fs.writeFileSync( path.resolve( __dirname, "DNAREPO_HASH" ), dnarepo_hash.toString() );

	const happs_hash		= await admin.registerDna( HAPPS );
	console.log( happs_hash );
	fs.writeFileSync( path.resolve( __dirname, "HAPPS_HASH" ), happs_hash.toString() );

	const webassets_hash		= await admin.registerDna( WEBASSETS );
	console.log( webassets_hash );
	fs.writeFileSync( path.resolve( __dirname, "WEBASSETS_HASH" ), webassets_hash.toString() );

	try {
	    const installation		= await admin.installApp( "devhub", agent_hash, {
		"dnarepo":	dnarepo_hash,
		"happs":	happs_hash,
		"webassets":	webassets_hash,
	    });
	    console.log( installation );
	} catch (err) {
	    if ( !( err instanceof ConductorError
		    && err.message.includes("AppAlreadyInstalled") ) )
		throw err;
	}

	try {
	    await admin.activateApp( "devhub" );
	} catch (err) {
	    if ( !( err instanceof ConductorError
		    && err.message.includes("AppNotInstalled") ) ) // already active
		throw err;
	}
    } finally {
	await admin.close();
    }
})();
