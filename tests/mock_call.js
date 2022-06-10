
const { EntryHash,
	AgentPubKey }			= require('@whi/holo-hash');
const { Entity, Collection }		= require('@whi/entity-architect');

const { WhoAmI,
	ZomeEntry,
	ZomeVersionEntry,
	DnaEntry,
	DnaVersionEntry,
	HappEntry,
	HappReleaseEntry }		= require('./mock_entities.js');


if ( !crypto.randomBytes ) {
    crypto.randomBytes			= function ( num ) {
	return crypto.getRandomValues( new Uint8Array(num) );
    }
}


function hash_bytes () {
    return crypto.randomBytes( 32 );
}

function RandomEntity ( type, model, content, id, address, header ) {
    return new Entity({
	"id":			id	|| crypto.randomBytes( 32 ),
	"address":		address	|| crypto.randomBytes( 32 ),
	"header":		header	|| crypto.randomBytes( 32 ),
	"type": {
	    "name": type,
	    "model": model,
	},
	content,
    });
}

function RandomCollection ( items, base ) {
    return new Collection({
	"base":			base	|| crypto.randomBytes( 32 ),
	items,
    });
}


function mock_zome ( zome_name, methods ) {
    return new Proxy( methods, {
	get ( obj, func ) {
	    if ( obj[ func ] === undefined )
		throw new Error(`Attempted to call a zome function that doesn't exist: Zome: ${zome_name} Fn ${func}`);

	    return obj[ func ];
	},
    });
}

const cell_state				= {
    "agent": new AgentPubKey( hash_bytes() ),
};

const entities				= {};
const paths				= {
    "all_dnas": {
	"hash": new EntryHash( hash_bytes() ),
	"items": [
	],
    },
};

function put_entity ( hash, entry ) {
    entities[ String(hash) ]		= entry;
}
function get_entity ( hash ) {
    if ( entities[ String(hash) ] === undefined )
	throw new Error(`Entry not found: ${hash}`);

    return entities[ String(hash) ];
}


function put_path ( segments, entity ) {
    const path				= get_path( segments );

    put_entity( entity.$id, entity );
    path.items.push( entity.$id );
}
function get_path ( segments ) {
    const path_key			= segments.map( seg => String(seg) ).join(".");

    if ( paths[ path_key ] === undefined ) {
	paths[ path_key ]		= {
	    "hash": new EntryHash( hash_bytes() ),
	    "items": [],
	};
    }

    return paths[ path_key ];
}
function get_path_items ( segments ) {
    const path				= get_path( segments );

    return {
	"hash": path.hash,
	"items": path.items.map( hash => get_entity( hash ) ),
    };
}


const dna_library			= mock_zome( "dna_library", {
    async whoami () {
	return WhoAmI( cell_state );
    },

    // Zome
    async create_zome ( input ) {
	const entry			= ZomeEntry( cell_state );

	entry.name			= input.name;
	entry.description		= input.description;

	const zome			= RandomEntity( "zome", "info", entry );

	put_path( [ "all_zomes" ],			zome );
	put_path( [ cell_state.agent, "zomes" ],	zome );

	return zome;
    },
    async get_zome ({ id }) {
	return get_entity( id );
    },
    async get_all_zomes () {
	const path			= get_path_items( [ "all_zomes" ] );
	return RandomCollection( path.items, path.hash );
    },
    async get_my_zomes () {
	const path			= get_path_items( [ cell_state.agent, "zomes" ] );
	return RandomCollection( path.items, path.hash );
    },

    // Zome Version
    async create_zome_version ( input ) {
	const entry			= ZomeVersionEntry( cell_state );

	entry.for_zome			= input.for_zome;

	const zome_version		= RandomEntity( "zome_version", "info", entry );

	put_path( [ input.for_zome, "zome_versions" ],		zome_version );

	return zome_version;
    },
    async get_zome_version ({ id }) {
	const zome_version		= get_entity( id );
	zome_version.for_zome		= get_entity( zome_version.for_zome );

	return zome_version;
    },
    async get_zome_versions ({ for_zome }) {
	const path			= get_path_items( [ for_zome, "zome_versions" ] );
	return RandomCollection( path.items, path.hash );
    },

    // DNA
    async create_dna ( input ) {
	const entry			= DnaEntry( cell_state );

	entry.name			= input.name;
	entry.description		= input.description;

	const dna			= RandomEntity( "dna", "info", entry );

	put_path( [ "all_dnas" ],			dna );
	put_path( [ cell_state.agent, "dnas" ],		dna );

	return dna;
    },
    async get_dna ({ id }) {
	return get_entity( id );
    },
    async get_all_dnas () {
	const path			= get_path_items( [ "all_dnas" ] );
	return RandomCollection( path.items, path.hash );
    },
    async get_my_dnas () {
	const path			= get_path_items( [ cell_state.agent, "dnas" ] );
	return RandomCollection( path.items, path.hash );
    },

    // DNA Version
    async create_dna_version ( input ) {
	const entry			= DnaVersionEntry( cell_state, {
	    "zomes": input.zomes,
	});

	entry.for_dna			= input.for_dna;

	const dna_version		= RandomEntity( "dna_version", "info", entry );

	put_path( [ input.for_dna, "dna_versions" ],		dna_version );

	return dna_version;
    },
    async get_dna_version ({ id }) {
	const dna_version		= get_entity( id );
	dna_version.for_dna		= get_entity( dna_version.for_dna );

	return dna_version;
    },
    async get_dna_versions ({ for_dna }) {
	const path			= get_path_items( [ for_dna, "dna_versions" ] );
	return RandomCollection( path.items, path.hash );
    },
});

const happ_library			= mock_zome( "happ_library", {
    async whoami () {
	return WhoAmI();
    },

    // hApp
    async create_happ ( input ) {
	const entry			= HappEntry( cell_state );

	entry.title			= input.title;

	const happ			= RandomEntity( "happ", "info", entry );

	put_path( [ "all_happs" ],			happ );
	put_path( [ cell_state.agent, "happs" ],	happ );

	return happ;
    },
    async get_happ ({ id }) {
	return get_entity( id );
    },
    async get_all_happs () {
	const path			= get_path_items( [ "all_happs" ] );
	return RandomCollection( path.items, path.hash );
    },
    async get_my_happs () {
	const path			= get_path_items( [ cell_state.agent, "happs" ] );
	return RandomCollection( path.items, path.hash );
    },

    // hApp Release
    async create_happ_release ( input ) {
	const entry			= Object.assign( HappReleaseEntry( cell_state, {
	    "dnas": input.dnas,
	}), input );

	entry.for_happ			= input.for_happ;
	entry.name			= input.name;
	entry.hdk_version		= input.name;

	const happ_release		= RandomEntity( "happ_release", "info", entry );

	put_path( [ input.for_happ, "happ_releases" ],		happ_release );

	return happ_release;
    },
    async get_happ_release ({ id }) {
	const happ_release		= get_entity( id );
	happ_release.for_happ		= get_entity( happ_release.for_happ );

	return happ_release;
    },
    async get_happ_releases ({ for_happ }) {
	const path			= get_path_items( [ for_happ, "happ_releases" ] );
	return RandomCollection( path.items, path.hash );
    },
});

const web_assets			= mock_zome( "web_assets", {
    async whoami () {
	return WhoAmI();
    },
});

const mere_memory			= mock_zome( "mere_memory", {
});


async function dnarepo ( zome, func, args ) {
    if ( zome === "dna_library" )
	return await dna_library[ func ]( args );
    if ( zome === "mere_memory" )
	return await mere_memory[ func ]( args );
}

async function happs ( zome, func, args ) {
    if ( zome === "happ_library" )
	return await happ_library[ func ]( args );
}

async function webassets ( zome, func, args ) {
    if ( zome === "web_assets" )
	return await dna_library[ func ]( args );
    if ( zome === "mere_memory" )
	return await mere_memory[ func ]( args );
}

module.exports = {
    hash_bytes,
    async mock_caller ( dna, zome, func, args ) {
	if ( dna === "dnarepo" )
	    return await dnarepo( zome, func, args );
	if ( dna === "happs" )
	    return await happs( zome, func, args );
	if ( dna === "webassets" )
	    return await webassets( zome, func, args );
    },
};
