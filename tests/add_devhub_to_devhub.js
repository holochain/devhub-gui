const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'silly',
});

global.WebSocket			= require('ws');

const fs				= require('fs');
// const faker				= require('faker');
// const { xor_digest }			= require('@whi/xor-digest');
const { Client,
	HoloHashes,
	logging }			= require('@holochain/devhub-entities');
const { DnaHash,
	AgentPubKey }			= HoloHashes;


const APP_PORT				= 44001;
const AGENT_B64				= fs.readFileSync( path.resolve(__dirname, 'AGENT'), "utf8" );
const DNAREPO_B64			= fs.readFileSync( path.resolve(__dirname, 'DNAREPO_HASH'), "utf8" );
const HAPPS_B64				= fs.readFileSync( path.resolve(__dirname, 'HAPPS_HASH'), "utf8" );
const WEBASSETS_B64			= fs.readFileSync( path.resolve(__dirname, 'WEBASSETS_HASH'), "utf8" );

console.log( AGENT_B64 );
const AGENT_HASH			= new AgentPubKey( AGENT_B64 );
const DNAREPO_HASH			= new DnaHash( DNAREPO_B64 );
const HAPPS_HASH			= new DnaHash( HAPPS_B64 );
const WEBASSETS_HASH			= new DnaHash( WEBASSETS_B64 );


const DNALIB_WASM			= fs.readFileSync( path.resolve(__dirname, '../zome_wasm/dna_library.wasm') );
const HAPPLIB_WASM			= fs.readFileSync( path.resolve(__dirname, '../zome_wasm/happ_library.wasm') );
const WEBASSETS_WASM			= fs.readFileSync( path.resolve(__dirname, '../zome_wasm/web_assets.wasm') );
const MEMORY_WASM			= fs.readFileSync( path.resolve(__dirname, '../zome_wasm/mere_memory.wasm') );


const dnas				= {
    "dnarepo":		DNAREPO_HASH,
    "happs":		HAPPS_HASH,
    "webassets":	WEBASSETS_HASH,
};

console.log( dnas );
const client				= new Client( AGENT_HASH, dnas, APP_PORT );



function print( msg, ...args ) {
    console.log(`\x1b[37m${msg}\x1b[0m`, ...args );
}


(async function main () {
    try {
	print("Creating zome for DNA Library...");
	const zome1			= await client.call( "dnarepo", "dna_library", "create_zome", {
	    "name": "DNA Library",
	    "description": "",
	});
	const zome1_version1		= await client.call( "dnarepo", "dna_library", "create_zome_version", {
	    "for_zome":		zome1.$id,
	    "version":		1,
	    "changelog":	"...",
	    "zome_bytes":	DNALIB_WASM,
	});

	print("Creating zome for hApp Library...");
	const zome2			= await client.call( "dnarepo", "dna_library", "create_zome", {
	    "name": "hApp Library",
	    "description": "",
	});
	const zome2_version1		= await client.call( "dnarepo", "dna_library", "create_zome_version", {
	    "for_zome":		zome2.$id,
	    "version":		1,
	    "changelog":	"...",
	    "zome_bytes":	HAPPLIB_WASM,
	});

	print("Creating zome for Web Assets...");
	const zome3			= await client.call( "dnarepo", "dna_library", "create_zome", {
	    "name": "Web Assets",
	    "description": "",
	});
	const zome3_version1		= await client.call( "dnarepo", "dna_library", "create_zome_version", {
	    "for_zome":		zome3.$id,
	    "version":		1,
	    "changelog":	"...",
	    "zome_bytes":	WEBASSETS_WASM,
	});

	print("Creating zome for Mere Memory...");
	const zome4			= await client.call( "dnarepo", "dna_library", "create_zome", {
	    "name": "Mere Memory",
	    "description": "",
	});
	const zome4_version1		= await client.call( "dnarepo", "dna_library", "create_zome_version", {
	    "for_zome":		zome4.$id,
	    "version":		1,
	    "changelog":	"...",
	    "zome_bytes":	MEMORY_WASM,
	});


	print("Creating DNA for DNA Repository...");
	const dna1			= await client.call( "dnarepo", "dna_library", "create_dna", {
	    "name": "DNA Repository",
	    "description": "",
	});
	const dna1_version1		= await client.call( "dnarepo", "dna_library", "create_dna_version", {
	    "for_dna":		dna1.$id,
	    "version":		1,
	    "changelog":	"...",
	    "zomes": [{
		"name":		"dna_library",
		"zome":		zome1.$id,
		"version":	zome1_version1.$id,
		"resource":	zome1_version1.mere_memory_addr,
	    }, {
		"name":		"mere_memory",
		"zome":		zome4.$id,
		"version":	zome4_version1.$id,
		"resource":	zome4_version1.mere_memory_addr,
	    }],
	});

	print("Creating DNA for hApp Repository...");
	const dna2			= await client.call( "dnarepo", "dna_library", "create_dna", {
	    "name": "hApp Repository",
	    "description": "",
	});
	const dna2_version1		= await client.call( "dnarepo", "dna_library", "create_dna_version", {
	    "for_dna":		dna2.$id,
	    "version":		1,
	    "changelog":	"...",
	    "zomes": [{
		"name":		"happ_library",
		"zome":		zome2.$id,
		"version":	zome2_version1.$id,
		"resource":	zome2_version1.mere_memory_addr,
	    }],
	});

	print("Creating DNA for Web Assets...");
	const dna3			= await client.call( "dnarepo", "dna_library", "create_dna", {
	    "name": "Web Assets",
	    "description": "",
	});
	const dna3_version1		= await client.call( "dnarepo", "dna_library", "create_dna_version", {
	    "for_dna":		dna3.$id,
	    "version":		1,
	    "changelog":	"...",
	    "zomes": [{
		"name":		"webassets",
		"zome":		zome3.$id,
		"version":	zome3_version1.$id,
		"resource":	zome3_version1.mere_memory_addr,
	    }],
	});


	print("Creating hApp for DevHub...");
	let happ1			= await client.call( "happs", "happ_library", "create_happ", {
	    "title": "DevHub",
	    "subtitle": "",
	    "description": "",
	    "gui": null,
	});
	let happ1_release1		= await client.call( "happs", "happ_library", "create_happ_release", {
	    "name": "v0.1.0",
	    "description": "",
	    "for_happ": happ1.$id,
	    "manifest": {
		"manifest_version": "1",
		"slots": [{
		    "id": "dnarepo",
		    "dna": {
			"path": `./dnarepo.dna`,
		    },
		    "clone_limit": 0,
		}, {
		    "id": "happs",
		    "dna": {
			"path": `./happs.dna`,
		    },
		    "clone_limit": 0,
		}, {
		    "id": "webassets",
		    "dna": {
			"path": `./web_assets.dna`,
		    },
		    "clone_limit": 0,
		}],
	    },
	    "dnas": [{
		"name":		"dnarepo",
		"dna":		dna1.$id,
		"version":	dna1_version1.$id,
	    }, {
		"name":		"happs",
		"dna":		dna2.$id,
		"version":	dna2_version1.$id,
	    }, {
		"name":		"webassets",
		"dna":		dna3.$id,
		"version":	dna3_version1.$id,
	    }],
	});
    } catch (err) {
	console.error("Main failed:", err );
    } finally {
	client.destroy();
    }
})();
