
const { AppWebsocket }			= require('@holochain/conductor-api');


function EntryHash (hash) {
    if ( hash === undefined || hash === null )
	throw new Error(`EntryHash input is missing: ${hash}`);

    if ( typeof hash === "string" )
	return Buffer.from(hash, "base64");
    else if ( hash instanceof Uint8Array )
	return hash;
    else
	throw new Error(`Unknown hash input: ${typeof hash} (${hash.constructor.name})`);
}

class ORM {
    constructor( conductor, agent, dna_hashes ) {
	this.conductor			= conductor;
	this.agent			= agent;
	this.cells			= {
	    "dnas":	[ dna_hashes.dnas, agent ],
	};
    }

    async callZome (dna_nick, zome, fname, args = null ) {
	const provenance		= this.agent;
	console.log(`DEBUG callZome '${dna_nick}->${zome}->${fname}':`, args );
	let result			= await this.conductor.callZome({
	    "cap":		null,
	    "provenance":	provenance,
	    "cell_id":		this.cells[dna_nick],
	    "zome_name":	zome,
	    "fn_name":		fname,
	    "payload":		args,
	});
	console.log("DEBUG callZome result:", result );

	return result;
    }

    async myDNAs ( wrapped = false ) {
	let dnas			= await this.callZome("dnas", "storage", "get_my_dnas" );

	return dnas.reduce((result, [hash,dna]) => {
	    let key			= Buffer.from(hash).toString("base64");
	    result[key]			= wrapped === true ? new Dna( this, dna, hash ) : dna;
	    return result;
	}, {});
    }

    async createDNA ( input ) {
	let [dna_hash, dna]		= await this.callZome("dnas", "storage", "create_dna", input );
	return new Dna( this, dna, dna_hash );
    }

    async getDNA ( hash ) {
	hash				= EntryHash(hash);
	let dna_info			= await this.callZome("dnas", "storage", "get_dna", {
	    "addr": hash,
	});
	return new Dna( this, dna_info, hash );
    }

    async createDNAVersion ( input ) {
	let dna_obj			= new Dna( this, {}, input.for_dna );
	let dna_version			= await dna_obj.createVersion( input );
	return dna_version.toJSON();
    }

    async getDNAVersion ( hash ) {
	hash				= EntryHash(hash);
	let version_info		= await this.callZome("dnas", "storage", "get_dna_version", {
	    "addr": hash,
	});
	return new DnaVersion( this, version_info, hash );
    }

    async getDNAChunk ( hash ) {
	hash				= EntryHash(hash);
	let chunk			= await this.callZome("dnas", "storage", "get_dna_chunk", {
	    "addr": hash,
	});
	return new DnaChunk( this, chunk, hash );
    }

    async close () {
	let close_promise		 = this.conductor.client.awaitClose();

	this.conductor.client.close();

	return await close_promise;
    }
}


class Entry {
    constructor ( orm, data, entry_hash ) {
	this.orm			= orm;
	this.entry_hash			= entry_hash;
	this.data			= data;
    }

    hash () {
	return this.entry_hash;
    }

    toJSON () {
	return this.data;
    }
}


class Dna extends Entry {
    constructor ( client, dna_info, entry_hash ) {
	super( client, dna_info, entry_hash );
    }

    async versions ( wrapped = false ) {
	let dna_hash			= this.hash();
	console.log("Get versions for DNA hash:", dna_hash);
	let versions			= await this.orm.callZome("dnas", "storage", "get_dna_versions", {
	    "for_dna": dna_hash,
	});

	return versions.reduce((result, [hash,dna_version]) => {
	    let key			= Buffer.from(hash).toString("base64");
	    result[key]			= wrapped === true ? new DnaVersion( this.orm, dna_version, hash ) : dna_version;
	    return result;
	}, {});
	return versions;
    }

    async createVersion ( input ) {
	let dna_bytes			= input.bytes;

	let chunk_size			= (2**20 /*1 megabyte*/) * 2;
	let chunk_hashes		= [];
	let chunk_count			= Math.ceil( dna_bytes.length / chunk_size );
	for (let i=0; i < chunk_count; i++) {
	    let [chunk_hash, chunk]	= await this.orm.callZome("dnas", "storage", "create_dna_chunk", {
		"sequence": {
		    "position": i+1,
		    "length": chunk_count,
		},
		"bytes": dna_bytes.slice( i*chunk_size, (i+1)*chunk_size ),
	    });
	    console.log("Chunk %s/%s hash", i+1, chunk_count );

	    chunk_hashes.push( chunk_hash );
	}
	console.log("Final chunks:", chunk_hashes );

	let [version_hash, version]	= await this.orm.callZome("dnas", "storage", "create_dna_version", {
	    "for_dna":		this.hash(),
	    "published_at":	input.published_at,
	    "version":		input.version,
	    "changelog":	input.changelog,
	    "file_size":	dna_bytes.length,
	    "chunk_addresses":	chunk_hashes,
	});
	console.log("New DNA version:", version_hash );

	return new DnaVersion( this.orm, version, version_hash );
    }
}


class DnaVersion extends Entry {
    constructor ( client, version_info, entry_hash ) {
	super( client, version_info, entry_hash );
    }
}


class DnaChunk extends Entry {
    constructor ( client, chunk, entry_hash ) {
	super( client, chunk, entry_hash );
    }
}


module.exports				= {
    async connect ( port, agent, dna_hashes ) {
	const conductor			= await AppWebsocket.connect(`ws://localhost:${port}`);
	return new ORM( conductor, agent, dna_hashes );
    },
};
