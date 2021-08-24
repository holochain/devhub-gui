const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'silly',
});

global.WebSocket			= require('ws');
const fs				= require('fs');
const faker				= require('faker');
const { Client, HoloHashes }		= require('@holochain/devhub-entities');

const APP_PORT				= 44001;

const AGENT_HASH			= fs.readFileSync( path.resolve(__dirname, 'AGENT'), "utf8" );
const AGENT_PUBKEY			= new HoloHashes.AgentPubKey( AGENT_HASH, false );

const DNAREPO_B64			= fs.readFileSync( path.resolve(__dirname, 'DNAREPO_HASH'), "utf8" );
const DNAREPO_HASH			= new HoloHashes.DnaHash( DNAREPO_B64, false );

const dnas				= {
    "dnarepo":		DNAREPO_HASH,
    // "happs":		HAPPS_HASH,
    // "webassets":	WEBASSETS_HASH,
};
const client				= new Client( AGENT_PUBKEY, dnas, APP_PORT );

function random_profile () {
    return {
	"name": faker.name.findName(),
	"email": faker.internet.exampleEmail(),
	"website": faker.internet.url(),
    };
}

function random_dna () {
    return {
	"name": faker.commerce.productName(),
	"description": faker.commerce.productDescription(),
	"developer": {
	    "name": faker.name.findName(),
	    "website": faker.internet.url(),
	},
    };
}

function random_zome () {
    return {
	"name": faker.commerce.productName(),
	"description": faker.commerce.productDescription(),
    };
}

(async function main () {
    try {
	await client.call("dnarepo", "dna_library", "create_zome", random_zome() );
    } catch (err) {
	console.error( err );
    } finally {
	await client.destroy();
    }
})();
