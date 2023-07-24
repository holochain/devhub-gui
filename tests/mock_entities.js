
const repr				= require('@whi/repr');
const { faker }				= require('@faker-js/faker');
const { AgentPubKey,
	ActionHash, EntryHash }		= require('@whi/holo-hash');


if ( !crypto.randomBytes ) {
    crypto.randomBytes			= function ( num ) {
	return crypto.getRandomValues( new Uint8Array(num) );
    }
}


function WhoAmI ( cell_state = {}, opts = {} ) {
    if ( String(cell_state) !== "[object Object]" )
	throw new Error(`State must be an object; not typeof '${repr( cell_state )}'`);

    return {
	"agent_initial_pubkey":		cell_state.agent || crypto.randomBytes( 32 ),
	"agent_latest_pubkey":		cell_state.agent || crypto.randomBytes( 32 ),
    };
}

function ZomeEntry ( cell_state = {}, opts = {} ) {
    if ( String(cell_state) !== "[object Object]" )
	throw new Error(`State must be an object; not typeof '${repr( cell_state )}'`);

    return {
	"name":			faker.commerce.product(),
	"description":		faker.lorem.sentence(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"developer": {
	    "pubkey":		cell_state.agent || new AgentPubKey( crypto.randomBytes(32) ),
	},
	"metadata":		{},
	"deprecation":		opts.deprecated ? null : {
	    "message":		faker.lorem.sentence(),
	    "recommended_alternatives": [
		new ActionHash( crypto.randomBytes(32) ),
	    ],
	},
    };
}

function ZomeVersionEntry ( cell_state = {}, opts = {} ) {
    if ( String(cell_state) !== "[object Object]" )
	throw new Error(`State must be an object; not typeof '${repr( cell_state )}'`);

    return {
	"for_zome":		opts.parent || ZomeEntry(),
	"version":		faker.datatype.number(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"changelog":		faker.lorem.sentence() + "..",
	"mere_memory_addr":	new EntryHash( crypto.randomBytes(32) ),
	"mere_memory_hash":	faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	"hdk_version":		`v0.0.${faker.datatype.number({ min: 100, max: 132 })}`,
	"metadata":		{},
    };
}

function DnaEntry ( cell_state = {}, opts = {} ) {
    if ( String(cell_state) !== "[object Object]" )
	throw new Error(`State must be an object; not typeof '${repr( cell_state )}'`);

    return {
	"name":			faker.commerce.product(),
	"description":		faker.lorem.sentence(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"developer": {
	    "pubkey":		cell_state.agent || new AgentPubKey( crypto.randomBytes(32) ),
	},
	"metadata":		{},
	"icon":			crypto.randomBytes( 39223 ),
	"tags":			[ faker.commerce.productAdjective() ],
	"deprecation":		opts.deprecated ? null : {
	    "message":		faker.lorem.sentence(),
	    "recommended_alternatives": [
		new ActionHash( crypto.randomBytes(32) ),
	    ],
	},
    };
}

function RandomZomeRef () {
    return {
	"name":			faker.commerce.product(),
	"zome":			new ActionHash( crypto.randomBytes(32) ),
	"version":		new ActionHash( crypto.randomBytes(32) ),
	"resource":		new EntryHash( crypto.randomBytes(32) ),
	"resource_hash":	faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
    };
}

function DnaVersionEntry ( cell_state = {}, opts = {} ) {
    if ( String(cell_state) !== "[object Object]" )
	throw new Error(`State must be an object; not typeof '${repr( cell_state )}'`);

    const zomes				= [];

    if ( !opts.zomes )
	opts.zomes			= Array( opts.zome_count || 2 ).fill({});

    for ( let zome of opts.zomes ) {
	zomes.push( Object.assign( RandomZomeRef(), zome ) );
    }

    return {
	"for_dna":		opts.parent || DnaEntry( cell_state ),
	"version":		faker.datatype.number(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"changelog":		faker.lorem.sentence() + "..",
	"wasm_hash":		faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	"hdk_version":		"v0.0.132",
	"zomes":		zomes,
	"metadata":		{},
    };
}

function HappEntry ( cell_state = {}, opts = {} ) {
    if ( String(cell_state) !== "[object Object]" )
	throw new Error(`State must be an object; not typeof '${repr( cell_state )}'`);

    return {
	"title":		faker.commerce.product(),
	"subtitle":		faker.lorem.words(3),
	"description":		faker.lorem.sentence(),
	"designer":		cell_state.agent || new AgentPubKey( crypto.randomBytes(32) ),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"metadata":		{},
	"icon":			crypto.randomBytes( 39223 ),
	"tags":			[ faker.commerce.productAdjective() ],
	"deprecation":		opts.deprecated ? null : {
	    "message":		faker.lorem.sentence(),
	    "recommended_alternatives": [
		new ActionHash( crypto.randomBytes(32) ),
	    ],
	},
    };
}

function RandomDnaRef () {
    return {
	"role_name":		faker.lorem.word().toLowerCase(),
	"dna":			new ActionHash( crypto.randomBytes(32) ),
	"version":		new ActionHash( crypto.randomBytes(32) ),
	"wasm_hash":		faker.datatype.hexadecimal( 64 ).slice(2).toLowerCase(),
    };
}

function HappReleaseEntry ( cell_state = {}, opts = {} ) {
    if ( String(cell_state) !== "[object Object]" )
	throw new Error(`State must be an object; not typeof '${repr( cell_state )}'`);

    const role_name_1			= faker.lorem.word().toLowerCase();
    const role_name_2			= faker.lorem.word().toLowerCase();
    const roles				= [];
    const dnas				= [];

    if ( !opts.dnas )
	opts.dnas			= Array( opts.dna_count || 2 ).fill({});

    for ( let i in opts.dnas ) {
	const dna			= opts.dnas[i];
	const dna_ref			= Object.assign( RandomDnaRef(), dna );

	roles.push({
	    "id":			dna_ref.role_name,
	    "dna": {
		"bundled":		`./resource_${i}_path.dna`,
		"clone_limit":		0,
		"uid":			null,
		"version":		null,
		"properties":		null,
	    },
	    "provisioning": {
		"strategy":		"create",
		"deferred":		false,
	    },
	});
	dnas.push( dna_ref );
    }

    return {
	"for_happ":		opts.parent || HappEntry( cell_state ),
	"name":			`v${ faker.datatype.number() }`,
	"description":		faker.lorem.sentence(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"manifest": {
	    "manifest_version":		`${ faker.datatype.number() }`,
	    "name":			faker.lorem.word(),
	    "description":		faker.lorem.sentence(),
	    "roles":			roles,
	},
	"dna_hash":		faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	"hdk_version":		"v0.0.132",
	"dnas":			dnas,
	"gui": {
	    "asset_group_id":	new ActionHash( crypto.randomBytes(32) ),
	    "holo_hosting_settings": {
		"uses_web_sdk":	false,
	    },
	},
	"metadata":		{},
	"icon":			crypto.randomBytes( 39223 ),
	"tags":			[ faker.commerce.productAdjective() ],
	"deprecation":		opts.deprecated ? null : {
	    "message":		faker.lorem.sentence(),
	    "recommended_alternatives": [
		new ActionHash( crypto.randomBytes(32) ),
	    ],
	},
    };
}


module.exports = {
    WhoAmI,
    ZomeEntry,
    ZomeVersionEntry,
    DnaEntry,
    DnaVersionEntry,
    HappEntry,
    HappReleaseEntry,
};
