
const Identicon				= require('identicon.js');
const { AppWebsocket }			= require('@holochain/conductor-api');
const { Schema }			= require('@holochain/devhub-entities');
const { Translator }			= require('@whi/essence');
const { HoloHash }			= require('@whi/holo-hash');
const { xor_digest }			= require('@whi/xor-digest');


function identicon_jpg_bytes ( input ) {
    if ( input === "string" )
	throw new Error(`Creating identicon JPG bytes expects a byte array, not '${typeof input}'`);

    let unique_input			= xor_digest( input, 8 );
    let idcon				= new Identicon( Buffer.from(unique_input).toString("hex") );

    return Buffer.from( String(idcon), "base64" );
}

const Interpreter			= new Translator(["AppError", "UtilsError", "DNAError", "UserError"], {
    "rm_stack_lines": 2,
});

class ORM {
    constructor( conductor, agent, dna_hashes ) {
	this.conductor			= conductor;
	this.agent			= agent;
	this.profile			= null;
	this.cells			= {
	    "dnas":	[ dna_hashes.dnas, agent ],
	};
	this.ready			= this.fetchProfile();
    }

    async callZome (dna_nick, zome, fname, args = null ) {
	const provenance		= this.agent;
	console.log(`DEBUG callZome '${dna_nick}->${zome}->${fname}':`, args );
	let pack;
	try {
	    let response		= await this.conductor.callZome({
		"cap":		null,
		"provenance":	provenance,
		"cell_id":	this.cells[dna_nick],
		"zome_name":	zome,
		"fn_name":	fname,
		"payload":	args,
	    });
	    console.log("DEBUG callZome result:", response );

	    pack			= Interpreter.parse( response );
	} catch (err) {
	    console.error("Uncaptured Call Zome Function Error:", err );
	    if ( err instanceof Error ) // Native error
		throw err;
	    else if ( err.type === "error" ) // Holochain error
		throw new Error(`${err.data.type}: ${err.data.data}`);
	    else
		throw new Error(JSON.stringify(err));
	}

	let payload			= pack.value();

	if ( payload instanceof Error )
	    throw payload;

	let composition			= pack.metadata('composition');
	let deconstructed		= Schema.deconstruct( composition, payload );
	console.log("DEBUG callZome deconstructed:", deconstructed );

	return deconstructed;
    }

    async fetchProfile () {
	await this.getProfile();
    }

    async getWhoAmI () {
	let agent_info			= await this.callZome("dnas", "storage", "whoami");
	return {
	    "initial": new HoloHash(agent_info.agent_initial_pubkey),
	    "latest": new HoloHash(agent_info.agent_latest_pubkey),
	};
    }

    async getProfile ( agent_pubkey = null ) {
	console.log("Getting profile for:", agent_pubkey );
	if ( agent_pubkey !== null )
	    agent_pubkey		= (new HoloHash(agent_pubkey, false)).toType("AgentPubKey");

	let profile;
	try {
	    this.profile		= await this.callZome("dnas", "storage", "get_profile", {
		"agent": agent_pubkey,
	    });
	} catch (err) {
	    if ( !err.message.includes("Profile has not been created") )
		throw err;

	    if ( !agent_pubkey )
		agent_pubkey		= (await this.getWhoAmI()).initial;

	    this.profile		= false;
	    profile			= {
		"id": agent_pubkey,
		"email": "",
		"name": "" + agent_pubkey,
		"website": "",
		"avatar_image": identicon_jpg_bytes( agent_pubkey.bytes() ),
		"avatar_image_b64": null,
	    };
	}

	// profile.agent			= agent_pubkey;

	return profile;
    }

    async setProfile ( input ) {
	if ( input.avatar_image === undefined ) {
	    input.avatar_image		= identicon_jpg_bytes( this.agent );
	}

	if ( this.profile === false ) {
	    let profile			= await this.callZome("dnas", "storage", "create_profile", {
		"name": input.name,
		"email": input.email,
		"website": input.website,
		"avatar_image": input.avatar_image,
	    });
	    this.profile		= profile;
	}
	else if ( this.profile === null ) {
	    throw new Error(`Too early to set profile because initial fetch is not complete.`);
	}
	else {
	    let profile			= await this.callZome("dnas", "storage", "update_profile", {
		"addr": this.profile.$addr,
		"properties": {
		    "name": input.name,
		    "email": input.email,
		    "website": input.website,
		    "avatar_image": input.avatar_image,
		},
	    });
	    this.profile		= profile;
	}

	return this.profile;
    }

    async getFollowing () {
	let developers			= await this.callZome("dnas", "storage", "get_following");

	return developers.map((link) => {
	    let $entry_hash		= new HoloHash(link.target);
	    return Object.assign(link, {
		"id": $entry_hash,
		"hash": String( $entry_hash ),
	    })
	});
    }

    async followAgent ( agent_pubkey ) {
	agent_pubkey			= new HoloHash(agent_pubkey, false);
	let hash			= await this.callZome("dnas", "storage", "follow_developer", {
	    "agent": agent_pubkey,
	});
	return hash;
    }

    async myDNAs ( wrapped = false ) {
	let dnas			= await this.callZome("dnas", "storage", "get_my_dnas" );
	return dnas;
    }

    async listDNAs ( agent_pubkey, wrapped = false ) {
	agent_pubkey			= new HoloHash(agent_pubkey, false);
	let dnas			= await this.callZome("dnas", "storage", "get_dnas", {
	    "agent": agent_pubkey,
	});

	console.log("DNAs list:", dnas );
	let dna_dict = dnas.reduce( (result, dna) => {
	    dna.icon_b64		= Buffer.from( dna.icon ).toString("base64");

	    let key			= String(dna.$id);
	    console.log("Reducing to dict:", key, dna );

	    result[key]			= dna;
	    return result;
	}, {});

	console.log("DNA dictionary:", dna_dict );
	return dna_dict;
    }

    async createDNA ( input ) {
	if ( input.icon === undefined ) {
	    let icon_input		= Buffer.concat([ this.agent, Buffer.from(input.name) ]);
	    input.icon			= identicon_jpg_bytes( icon_input );
	}
	let dna				= await this.callZome("dnas", "storage", "create_dna", input );
	return new Dna( this, dna, dna.$id );
    }

    async updateDNA ( hash, input ) {
	hash				= new HoloHash(hash, false);
	let dna				= await this.callZome("dnas", "storage", "update_dna", {
	    "addr": hash,
	    "properties": input,
	});
	return new Dna( this, dna, hash );
    }

    async deprecateDNA ( hash, reason ) {
	hash				= new HoloHash(hash, false);
	let dna				= await this.callZome("dnas", "storage", "deprecate_dna", {
	    "addr": hash,
	    "message": reason,
	});
	return new Dna( this, dna, hash );
    }

    async getDNA ( hash ) {
	hash				= new HoloHash(hash, false);
	let dna_info			= await this.callZome("dnas", "storage", "get_dna", {
	    "id": hash,
	});
	return new Dna( this, dna_info, hash );
    }

    async createDNAVersion ( input ) {
	let dna_obj			= new Dna( this, {}, input.for_dna );
	let dna_version			= await dna_obj.createVersion( input );
	return dna_version.toJSON();
    }

    async updateDNAVersion ( hash, input ) {
	hash				= new HoloHash(hash, false);
	let dna				= await this.callZome("dnas", "storage", "update_dna_version", {
	    "addr": hash,
	    "properties": input,
	});
	return new DnaVersion( this, dna, hash );
    }

    async deleteDNAVersion ( hash ) {
	hash				= new HoloHash(hash, false);
	let dna_version			= await this.callZome("dnas", "storage", "delete_dna_version", {
	    "addr": hash,
	});
	return new DnaVersion( this, dna_version, hash );
    }

    async getDNAVersion ( hash ) {
	hash				= new HoloHash(hash, false);
	let version_info		= await this.callZome("dnas", "storage", "get_dna_version", {
	    "id": hash,
	});
	return new DnaVersion( this, version_info, hash );
    }

    async getDNAChunk ( hash ) {
	hash				= new HoloHash(hash, false);
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


class Profile extends Entry {
    constructor ( client, profile_info, entry_hash ) {
	super( client, profile_info, entry_hash );

	this.data.hash			= String(new HoloHash( profile_info.id ));
	this.data.avatar_image_b64	= Buffer.from( this.data.avatar_image ).toString("base64");
    }
}


class Dna extends Entry {
    constructor ( client, dna_info, entry_hash ) {
	super( client, dna_info, entry_hash );

	this.data.icon_b64		= Buffer.from( this.data.icon ).toString("base64");
    }

    async versions ( wrapped = false ) {
	let dna_hash			= this.hash();
	console.log("Get versions for DNA hash:", dna_hash);
	let versions			= await this.orm.callZome("dnas", "storage", "get_dna_versions", {
	    "for_dna": dna_hash,
	});

	return versions;
    }

    async createVersion ( input ) {
	let dna_bytes			= input.bytes;

	let chunk_size			= (2**20 /*1 megabyte*/) * 2;
	let chunk_hashes		= [];
	let chunk_count			= Math.ceil( dna_bytes.length / chunk_size );
	for (let i=0; i < chunk_count; i++) {
	    let chunk			= await this.orm.callZome("dnas", "storage", "create_dna_chunk", {
		"sequence": {
		    "position": i+1,
		    "length": chunk_count,
		},
		"bytes": dna_bytes.slice( i*chunk_size, (i+1)*chunk_size ),
	    });
	    console.log("Chunk %s/%s hash", i+1, chunk_count );

	    chunk_hashes.push( chunk.$addr );
	}
	console.log("Final chunks:", chunk_hashes );

	let version			= await this.orm.callZome("dnas", "storage", "create_dna_version", {
	    "for_dna":		this.hash(),
	    "published_at":	input.published_at,
	    "version":		input.version,
	    "changelog":	input.changelog,
	    "file_size":	dna_bytes.length,
	    "chunk_addresses":	chunk_hashes,
	});
	console.log("New DNA version:", version.$id );

	return new DnaVersion( this.orm, version, version.$id );
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
