const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'silly',
});

const fs				= require('fs');
const faker				= require('faker');
const { AppWebsocket }			= require('@holochain/conductor-api');
const ORM				= require('../src/api_orm.js');


const b64				= input => typeof input === "string" ? Buffer.from(input, "base64") : input.toString("base64");

const APP_PORT				= 44001;
const AGENT_B64				= fs.readFileSync( path.resolve(__dirname, 'AGENT'), "utf8" );
const DNAREPO_B64			= fs.readFileSync( path.resolve(__dirname, 'DNAREPO_HASH'), "utf8" );
const AGENT_HASH			= b64( AGENT_B64 );
const DNAREPO_HASH			= b64( DNAREPO_B64 );


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

let version_counters = {};
function increment_version ( key ) {
    if ( version_counters[key] === undefined )
	version_counters[key]		= 1;
    return version_counters[key]++;
}
function random_dna_version ( dna_hash ) {
    return {
	"version": increment_version( dna_hash ),
	"changelog": faker.lorem.paragraph(50),
	"bytes": random_dna_bytes(),
    };
}

function random_dna_bytes () {
    return (new Uint8Array( 1024 * 70 )).fill(255);
}


(async function main () {
    const DevHub			= await ORM.connect( APP_PORT, AGENT_HASH, {
	"dnas": DNAREPO_HASH,
    });
    try {
	await DevHub.ready;

	// Show existing data
	let my_dnas			= await DevHub.myDNAs( true );
	for (let hash in my_dnas) {
	    let $dna			= my_dnas[hash];
	    console.log("My DNA:", $dna.toJSON() );
	    let versions		= await $dna.versions();
	    console.log(`Versions for DNA (${hash})`, versions );
	}


	// Create random data
	let profile			= await DevHub.setProfile( random_profile() );
	console.log("My profile:", profile.toJSON() );

	for (let i=0; i < (faker.datatype.number(10) + 10); i++) {
	    let dna			= await DevHub.createDNA( random_dna() );
	    console.log("New DNA:", dna.toJSON() );

	    for (let n=0; n < faker.datatype.number(10); n++) {
		let dna_version		= await dna.createVersion( random_dna_version( dna.hash() ));
		console.log("New DNA version:", dna_version.toJSON() );
	    }
	}
    } catch (err) {
	console.error( err );
    } finally {
	await DevHub.close();
    }
})();
