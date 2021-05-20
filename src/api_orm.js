
const { AppWebsocket }			= require('@holochain/conductor-api');


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
	return await this.conductor.callZome({
	    "cap":		null,
	    "provenance":	provenance,
	    "cell_id":		this.cells[dna_nick],
	    "zome_name":	zome,
	    "fn_name":		fname,
	    "payload":		args,
	});
    }

    async myDNAs () {
	let dnas			= await this.callZome("dnas", "storage", "get_my_dnas" );

	return dnas.reduce((result, [hash,dna]) => {
	    let key			= hash.toString("base64");
	    result[key]			= new Dna( this, dna, hash );
	    return result;
	}, {});
    }

    async createDNA ( input ) {
	let [dna_hash, dna]		= await this.callZome("dnas", "storage", "create_dna", input );
	return new Dna( this, dna, dna_hash );
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

    async versions () {
	let dna_hash			= this.hash();
	console.log("Get versions for DNA hash:", dna_hash);
	let versions			= await this.orm.callZome("dnas", "storage", "get_dna_versions", {
	    "for_dna": dna_hash,
	});

	return versions.reduce((result, [hash,dna_version]) => {
	    let key			= hash.toString("base64");
	    result[key]			= new DnaVersion( this.orm, dna_version, hash );
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
	    "version":		input.version,
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


module.exports				= {
    async connect ( port, agent, dna_hashes ) {
	const conductor			= await AppWebsocket.connect(`http://localhost:${port}`);
	return new ORM( conductor, agent, dna_hashes );
    },
};
