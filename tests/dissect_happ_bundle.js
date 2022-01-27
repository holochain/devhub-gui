const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'silly',
});

const { Client,
	HoloHashes,
	logging }			= require('@holochain/devhub-entities');
const { DnaHash,
	AgentPubKey }			= HoloHashes;

const fs				= require('fs');
const crypto				= require('crypto');
const json				= require('@whi/json');
const msgpack				= require('@msgpack/msgpack');
const { ungzip }			= require('node-gzip');

global.WebSocket			= require('ws');


const APP_PORT				= 44001;
const AGENT_B64				= fs.readFileSync( path.resolve(__dirname, 'AGENT'), "utf8" );
const DNAREPO_B64			= fs.readFileSync( path.resolve(__dirname, 'DNAREPO_HASH'), "utf8" );
const HAPPS_B64				= fs.readFileSync( path.resolve(__dirname, 'HAPPS_HASH'), "utf8" );
const WEBASSETS_B64			= fs.readFileSync( path.resolve(__dirname, 'WEBASSETS_HASH'), "utf8" );

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
const client				= new Client( AGENT_HASH, dnas, APP_PORT );


function print( msg, ...args ) {
    console.log(`\x1b[37m${msg}\x1b[0m`, ...args );
}

function sha256_digest ( ...inputs ) {
    const hash				= crypto.createHash("sha256");

    inputs.sort(Buffer.compare);

    for ( let input of inputs ) {
	hash.update( input );
    }

    return hash.digest();
}

async function unpack_bundle ( zipped_bytes ) {
    let msgpack_bytes			= await ungzip( zipped_bytes );
    let bundle				= msgpack.decode( msgpack_bytes );

    for ( let path in bundle.resources ) {
	bundle.resources[path]		= Buffer.from( bundle.resources[path] );
    }

    return bundle;
}

// {
//     "manifest": {
//         "manifest_version": "1",
//         "name": "dnarepo",
//         "uid": null,
//         "properties": null,
//         "zomes": [
//             {
//                 "name": "dna_library",
//                 "hash": null,
//                 "bundled": "../../zomes/dna_library.wasm"
//             },
//             ...
//         ]
//     },
//     "resources": {
//         "../../zomes/dna_library.wasm": <Buffer 00 61 73 6d  ... 5553511 more bytes>
//     }
// }
async function restructure_dna_package ( dna_pack_bytes ) {
    const bundle			= await unpack_bundle( dna_pack_bytes );
    const manifest			= bundle.manifest;
    manifest.wasm_resources		= {};

    const zomes				= {};

    for ( let zome of manifest.zomes ) {
	const wasm_bytes		= bundle.resources[ zome.bundled ];
	const digest			= sha256_digest( wasm_bytes );
	const hash			= digest.toString("hex");

	zomes[ zome.name ]		= {
	    "wasm_resource_hash": hash,
	};
	manifest.wasm_resources[ hash ]	= wasm_bytes;
    }

    manifest.zomes			= zomes;

    return manifest;
}

async function open_package ( bundle_path ) {
    const zipped_bytes 			= fs.readFileSync( bundle_path );
    print("Opened file with %s bytes", zipped_bytes.length );

    const bundle			= await unpack_bundle( zipped_bytes );
    const manifest			= bundle.manifest;
    const happ_resource_hash		= crypto.createHash("sha256");
    const dna_resource_digests		= [];

    manifest.dna_resources		= {};
    manifest.wasm_resources		= {};

    for ( let slot of manifest.slots ) {
	const dna_pack_bytes		= bundle.resources[ slot.dna.bundled ];
	const dna_pack			= await restructure_dna_package( dna_pack_bytes );

	Object.assign( manifest.wasm_resources, dna_pack.wasm_resources );

	delete dna_pack.wasm_resources;

	const dna_resource_digest	= sha256_digest( ...Object.values( dna_pack.zomes ).map(zome => {
	    return Buffer.from( zome.wasm_resource_hash, "hex" );
	}) );

	slot.dna.zomes			= dna_pack.zomes;
	slot.dna.resource_hash		= dna_resource_digest.toString("hex");

	delete slot.dna.bundled;

	manifest.dna_resources[ slot.dna.resource_hash ] = dna_pack_bytes;

	dna_resource_digests.push( dna_resource_digest );
    }

    const happ_resource_digest		= sha256_digest( ...dna_resource_digests );

    bundle.manifest.resource_hash	= happ_resource_digest.toString("hex");

    return manifest;
}

(async function main ( happ_file ) {
    print("Dissecting hApp package: %s", happ_file );
    if ( happ_file === undefined )
	throw new TypeError(`First argument must be a path to the hApp file; not 'undefined'`);

    const bundle			= await open_package( happ_file );

    console.log( json.debug(bundle) );

    // {
    // 	print("Scan my DNAs");
    // 	const dnas			= await client.call( "dnarepo", "dna_library", "get_my_dnas", null );

    // 	for ( let summary of dnas ) {
    // 	    const dna			= await client.call( "dnarepo", "dna_library", "get_dna", { "id": summary.$id } );

    // 	    dna.versions		= await client.call( "dnarepo", "dna_library", "get_dna_versions", {
    // 		"for_dna": dna.$id,
    // 	    });

    // 	    for ( let version_summary of dna.versions ) {
    // 		const version		= await client.call( "dnarepo", "dna_library", "get_dna_version", { "id": version_summary.$id } );

    // 		// console.log( version );
    // 	    }

    // 	    // console.log( dna );
    // 	}
    // }

    {
	print("Searching for Releases with: %s", bundle.resource_hash );
	const versions			= await client.call( "happs", "happ_library", "get_happ_releases_by_filter", {
	    "filter": "uniqueness_hash",
	    "keyword": bundle.resource_hash,
	});

	console.log( versions );

	if ( versions.length > 0 ) {
	    const version_id		= versions[0].$id;

	    print("Get the hApp release info: %s", version_id );
	    const version		= await client.call( "happs", "happ_library", "get_happ_release", {
		"id": version_id,
	    });

	    console.log( version );
	}
    }

    {
	print("Searching for DNAs with: %s", bundle.slots[0].dna.resource_hash );
	const versions			= await client.call( "dnarepo", "dna_library", "get_dna_versions_by_filter", {
	    "filter": "uniqueness_hash",
	    "keyword": bundle.slots[0].dna.resource_hash,
	});

	console.log( versions );

	if ( versions.length > 0 ) {
	    const version_id		= versions[0].$id;

	    print("Get the dna version info: %s", version_id );
	    const version		= await client.call( "dnarepo", "dna_library", "get_dna_version", {
		"id": version_id,
	    });

	    console.log( version );
	}
    }

    {
	print("Searching for Zomes with: %s", bundle.slots[0].dna.zomes.dna_library.wasm_resource_hash );
	const versions			= await client.call( "dnarepo", "dna_library", "get_zome_versions_by_filter", {
	    "filter": "wasm_hash",
	    "keyword": bundle.slots[0].dna.zomes.mere_memory.wasm_resource_hash,
	});

	console.log( versions );

	if ( versions.length > 0 ) {
	    const version_id		= versions[0].$id;

	    print("Get the zome version info: %s", version_id );
	    const version		= await client.call( "dnarepo", "dna_library", "get_zome_version", {
		"id": version_id,
	    });

	    console.log( version );
	}
    }

    client.destroy();
})( ...process.argv.slice(2) );
