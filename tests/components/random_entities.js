const { Logger }			= require('@whi/weblogger');
const log				= new Logger("tests-main");


const { faker }				= require('@faker-js/faker');
const { AgentPubKey,
	EntryHash }			= holohash;
const { Entity }			= CruxPayloadParser.EntityArchitect;


crypto.randomBytes			= function ( num ) {
    return crypto.getRandomValues( new Uint8Array(num) );
}


function RandomEntity ( type, model, content ) {
    return new Entity({
	"id":			crypto.randomBytes( 32 ),
	"address":		crypto.randomBytes( 32 ),
	"header":		crypto.randomBytes( 32 ),
	"type": {
	    "name": type,
	    "model": model,
	},
	content,
    });
}

function ZomeEntry ( opts = {} ) {
    const content			= {
	"name":			faker.commerce.product(),
	"description":		faker.lorem.sentence(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"developer": {
	    "pubkey":		new AgentPubKey( crypto.randomBytes(32) ),
	},
	"metadata":		{},
	"deprecation":		opts.deprecated ? null : {
	    "message":		faker.lorem.sentence(),
	    "recommended_alternatives": [
		new EntryHash( crypto.randomBytes(32) ),
	    ],
	},
    };

    return RandomEntity( "zome", "summary", content );
}

function ZomeVersionEntry ( opts = {} ) {
    const content			= {
	"for_zome":		opts.parent || ZomeEntry(),
	"version":		`v${ faker.datatype.number() }`,
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"changelog":		faker.lorem.sentence() + "..",
	"mere_memory_addr":	new EntryHash( crypto.randomBytes(32) ),
	"mere_memory_hash":	faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	"hdk_version":		"v0.0.132",
	"metadata":		{},
    };

    return RandomEntity( "zome_version", "summary", content );
}

function DnaEntry ( opts = {} ) {
    const content			= {
	"name":			faker.commerce.product(),
	"description":		faker.lorem.sentence(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"developer": {
	    "pubkey":		new AgentPubKey( crypto.randomBytes(32) ),
	},
	"metadata":		{},
	"icon":			crypto.randomBytes( 39223 ),
	"tags":			[ faker.commerce.productAdjective() ],
	"deprecation":		opts.deprecated ? null : {
	    "message":		faker.lorem.sentence(),
	    "recommended_alternatives": [
		new EntryHash( crypto.randomBytes(32) ),
	    ],
	},
    };

    return RandomEntity( "dna", "summary", content );
}

function DnaVersionEntry ( opts = {} ) {
    const content			= {
	"for_dna":		opts.parent || DnaEntry(),
	"version":		`v${ faker.datatype.number() }`,
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"changelog":		faker.lorem.sentence() + "..",
	"wasm_hash":		faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	"hdk_version":		"v0.0.132",
	"zomes": [{
	    "name":		faker.commerce.product(),
	    "zome":		new EntryHash( crypto.randomBytes(32) ),
	    "version":		new EntryHash( crypto.randomBytes(32) ),
	    "resource":		new EntryHash( crypto.randomBytes(32) ),
	    "resource_hash":	faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	},{
	    "name":		faker.commerce.product(),
	    "zome":		new EntryHash( crypto.randomBytes(32) ),
	    "version":		new EntryHash( crypto.randomBytes(32) ),
	    "resource":		new EntryHash( crypto.randomBytes(32) ),
	    "resource_hash":	faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	}],
	"metadata":		{},
    };

    return RandomEntity( "dna_version", "summary", content );
}

function HappEntry ( opts = {} ) {
    const content			= {
	"title":		faker.commerce.product(),
	"subtitle":		faker.lorem.words(3),
	"description":		faker.lorem.sentence(),
	"designer":		new AgentPubKey( crypto.randomBytes(32) ),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"metadata":		{},
	"icon":			crypto.randomBytes( 39223 ),
	"tags":			[ faker.commerce.productAdjective() ],
	"deprecation":		opts.deprecated ? null : {
	    "message":		faker.lorem.sentence(),
	    "recommended_alternatives": [
		new EntryHash( crypto.randomBytes(32) ),
	    ],
	},
    };

    return RandomEntity( "happ", "summary", content );
}

function HappReleaseEntry ( opts = {} ) {
    const role_id_1			= faker.lorem.word().toLowerCase();
    const role_id_2			= faker.lorem.word().toLowerCase();

    const content			= {
	"for_happ":		opts.parent || HappEntry(),
	"name":			`v${ faker.datatype.number() }`,
	"description":		faker.lorem.sentence(),
	"published_at":		faker.date.past(),
	"last_updated":		faker.date.recent(),
	"manifest": {
	    "manifest_version":		`${ faker.datatype.number() }`,
	    "name":			faker.lorem.word(),
	    "description":		faker.lorem.sentence(),
	    "roles": [{
		"id":			role_id_1,
		"dna": {
		    "bundled":		"./resource_1_path.dna",
		    "clone_limit":	0,
		    "uid":		null,
		    "version":		null,
		    "properties":	null,
		},
		"provisioning": {
		    "strategy":		"create",
		    "deferred":		false,
		},
	    },{
		"id":			role_id_2,
		"dna": {
		    "bundled":		"./resource_2_path.dna",
		    "clone_limit":	0,
		    "uid":		null,
		    "version":		null,
		    "properties":	null,
		},
		"provisioning": {
		    "strategy":		"create",
		    "deferred":		false,
		},
	    }],
	},
	"dna_hash":		faker.datatype.hexadecimal( 64 ).slice( 2 ).toLowerCase(),
	"hdk_version":		"v0.0.132",
	"dnas": [{
	    "role_id":		role_id_1,
	    "dna":		new EntryHash( crypto.randomBytes(32) ),
	    "version":		new EntryHash( crypto.randomBytes(32) ),
	    "wasm_hash":	faker.datatype.hexadecimal( 64 ).slice(2).toLowerCase(),
	},{
	    "role_id":		role_id_2,
	    "dna":		new EntryHash( crypto.randomBytes(32) ),
	    "version":		new EntryHash( crypto.randomBytes(32) ),
	    "wasm_hash":	faker.datatype.hexadecimal( 64 ).slice(2).toLowerCase(),
	}],
	"gui": {
	    "asset_group_id":	new EntryHash( crypto.randomBytes(32) ),
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
		new EntryHash( crypto.randomBytes(32) ),
	    ],
	},
    };

    return RandomEntity( "happ_release", "summary", content );
}


module.exports = {
    ZomeEntry,
    ZomeVersionEntry,
    DnaEntry,
    DnaVersionEntry,
    HappEntry,
    HappReleaseEntry,
};
