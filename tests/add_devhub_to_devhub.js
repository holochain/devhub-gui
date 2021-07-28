const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'silly',
});

const fs				= require('fs');
const faker				= require('faker');
const Identicon				= require('identicon.js');
const { Client, logging }		= require('@holochain/devhub-entities');
const { xor_digest }			= require('@whi/xor-digest');


const b64				= input => typeof input === "string" ? Buffer.from(input, "base64") : input.toString("base64");

const APP_PORT				= 44001;
const AGENT_B64				= fs.readFileSync( path.resolve(__dirname, 'AGENT'), "utf8" );
const DNAREPO_B64			= fs.readFileSync( path.resolve(__dirname, 'DNAREPO_HASH'), "utf8" );
const HAPPS_B64				= fs.readFileSync( path.resolve(__dirname, 'HAPPS_HASH'), "utf8" );
const WEBASSETS_B64			= fs.readFileSync( path.resolve(__dirname, 'WEBASSETS_HASH'), "utf8" );

const AGENT_HASH			= b64( AGENT_B64 );
const DNAREPO_HASH			= b64( DNAREPO_B64 );
const HAPPS_HASH			= b64( HAPPS_B64 );
const WEBASSETS_HASH			= b64( WEBASSETS_B64 );


const DNAREPO_DNA			= fs.readFileSync( path.resolve(__dirname, '../dnas/dnarepo.dna') );
const HAPPS_DNA				= fs.readFileSync( path.resolve(__dirname, '../dnas/happs.dna') );
const WEBASSETS_DNA			= fs.readFileSync( path.resolve(__dirname, '../dnas/webassets.dna') );


const dnarepo				= new Client( APP_PORT, DNAREPO_HASH,	AGENT_HASH );
const happs				= new Client( APP_PORT, HAPPS_HASH,	AGENT_HASH );
const webassets				= new Client( APP_PORT, WEBASSETS_HASH,	AGENT_HASH );

const manifest_yaml			= `
---
manifest_version: "1"

name: Holochain DevHub
description: A hApp for publishing, searching, and organizing hApp resources
slots:
  - id: dnarepo
    provisioning:
      strategy: create
      deferred: false
    dna:
      path: ./dnarepo/dnarepo.dna
  - id: happs
    provisioning:
      strategy: create
      deferred: false
    dna:
      path: ./happs/happs.dna
  - id: webassets
    provisioning:
      strategy: create
      deferred: false
    dna:
      path: ./web_assets/web_assets.dna
`;


function print( msg, ...args ) {
    console.log(`\x1b[37m${msg}\x1b[0m`, ...args );
}

function dna_icon_bytes ( agent, name ) {
    let input				= Buffer.concat([ agent, Buffer.from(name) ]);
    let unique_input			= xor_digest( input, 8 );
    let idcon				= new Identicon( Buffer.from(unique_input).toString("hex") );

    return Buffer.from( String(idcon), "base64" );
}

const chunk_size			= (2**20 /*1 megabyte*/) * 2;
async function upload_dna ( client, bytes ) {
    let chunk_hashes		= [];
    let chunk_count		= Math.ceil( bytes.length / chunk_size );
    for (let i=0; i < chunk_count; i++) {
	let chunk		= await client.call( "storage", "create_dna_chunk", {
	    "sequence": {
		"position": i+1,
		"length": chunk_count,
	    },
	    "bytes": bytes.slice( i*chunk_size, (i+1)*chunk_size ),
	});
	log.info("Chunk %s/%s hash: %s", i+1, chunk_count, String(chunk.$address) );

	chunk_hashes.push( chunk.$address );
    }
    log.debug("Final chunks: %s", chunk_hashes );

    return chunk_hashes;
}


(async function main () {
    try {
	await Promise.all([
	    dnarepo.connect(),
	    happs.connect(),
	    webassets.connect(),
	]);

	print("Uploading DNArepo DNA...");
	const dna1			= await dnarepo.call( "storage", "create_dna", {
	    "name": "DNArepo",
	    "description": faker.commerce.productDescription(),
	    "icon": dna_icon_bytes( AGENT_HASH, "DNArepo" ),
	    "developer": {
		"name": faker.name.findName(),
		"website": faker.internet.url(),
	    },
	});
	const dnarepo_chunks		= await upload_dna( dnarepo, DNAREPO_DNA );
	const dna1version		= await dnarepo.call( "storage", "create_dna_version", {
	    "for_dna": dna1.$id,
	    "version": 1,
	    "changelog": faker.lorem.paragraph(50),
	    "file_size": DNAREPO_DNA.length,
	    "chunk_addresses": dnarepo_chunks,
	});

	print("Uploading hApps DNA...");
	const dna2			= await dnarepo.call( "storage", "create_dna", {
	    "name": "hApps",
	    "description": faker.commerce.productDescription(),
	    "icon": dna_icon_bytes( AGENT_HASH, "hApps" ),
	    "developer": {
		"name": faker.name.findName(),
		"website": faker.internet.url(),
	    },
	});
	const happs_chunks		= await upload_dna( dnarepo, HAPPS_DNA );
	const dna2version		= await dnarepo.call( "storage", "create_dna_version", {
	    "for_dna": dna2.$id,
	    "version": 1,
	    "changelog": faker.lorem.paragraph(50),
	    "file_size": HAPPS_DNA.length,
	    "chunk_addresses": happs_chunks,
	});

	print("Uploading WebAssets DNA...");
	const dna3			= await dnarepo.call( "storage", "create_dna", {
	    "name": "WebAssets",
	    "description": faker.commerce.productDescription(),
	    "icon": dna_icon_bytes( AGENT_HASH, "WebAssets" ),
	    "developer": {
		"name": faker.name.findName(),
		"website": faker.internet.url(),
	    },
	});
	const webassets_chunks		= await upload_dna( dnarepo, WEBASSETS_DNA );
	const dna3version		= await dnarepo.call( "storage", "create_dna_version", {
	    "for_dna": dna3.$id,
	    "version": 1,
	    "changelog": faker.lorem.paragraph(50),
	    "file_size": WEBASSETS_DNA.length,
	    "chunk_addresses": webassets_chunks,
	});

	print("Creating hApp...");
	let happ			= await happs.call( "store", "create_happ", {
	    "title": "DevHub",
	    "subtitle": "",
	    "description": "",
	    "gui": null,
	});

	print("Creating release...");
	let release			= await happs.call( "store", "create_happ_release", {
	    "name": "v0.1.0",
	    "description": faker.lorem.paragraph(5),
	    "for_happ": happ.$id,
	    manifest_yaml,
	    "resources": {
		"dnarepo":	dna1version.$id,
		"happs":	dna2version.$id,
		"webassets":	dna3version.$id,
	    },
	});
    } catch (err) {
	console.error("Main failed:", err );
    } finally {
	dnarepo.destroy();
	happs.destroy();
	webassets.destroy();
    }
})();
