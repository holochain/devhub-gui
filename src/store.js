const { Logger }			= require('@whi/weblogger');
const log				= new Logger("store");

const Vuex				= require('vuex');

const DEFAULT_METADATA_STATES		= {
    "loaded": false,
    "loading": false,
    "current": false,
    "stored_at": Infinity,
};
const CACHE_EXPIRATION_LIMIT		= 1_000 * 60 * 10; // 10 minutes
const copy				= obj => Object.assign( {}, obj );
const store_path			= ( ...segments ) => segments.join("/");

const dataTypePath			= {
    zomes:		( agent )	=> store_path( "zomes", agent ),
    zome:		( id )		=> store_path( "zome", id ),
    zomeVersions:	( id )		=> store_path( "zome", id, "versions" ),
    zomeVersion:	( id )		=> store_path( "zome", "version", id ),

    dnas:		( agent )	=> store_path( "dnas", agent ),
    dna:		( id )		=> store_path( "dna", id ),
    dnaVersions:	( id )		=> store_path( "dna", id, "versions" ),
    dnaVersion:		( id )		=> store_path( "dna", "version", id ),

    happs:		( agent )	=> store_path( "happs", agent ),
    happ:		( id )		=> store_path( "happ", id ),
    happReleases:	( id )		=> store_path( "happ", id, "releases" ),
    happRelease:	( id )		=> store_path( "happ", "release", id ),

    zomeVersionWasm:	( addr )	=> store_path( "zome", "version", addr, "wasm_bytes" ),
};

module.exports = async function ( client, Vue ) {
    return new Vuex.Store({
	state () {
	    return {
		"entities": {},
		"collections": {},
		"metadata": {},
	    };
	},
	"getters": {
	    isExpired: ( state, getters ) => ( path ) => {
		return getters.metadata( path ).stored_at + CACHE_EXPIRATION_LIMIT < Date.now();
	    },
	    entity: ( state, getters ) => ( path ) => {
		if ( getters.isExpired( path ) )
		    return null;

		return state.entities[ path ] || null;
	    },
	    collection: ( state, getters ) => ( path ) => {
		if ( getters.isExpired( path ) )
		    return [];

		return state.collections[ path ] || [];
	    },
	    metadata: ( state, getters ) => ( path ) => {
		return state.metadata[ path ] || copy( DEFAULT_METADATA_STATES );
	    },

	    zomes: ( state, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.zomes( agent );
		return {
		    "collection":	getters.collection( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    zome: ( state, getters ) => ( id ) => {
		const path		= dataTypePath.zome( id );
		return {
		    "entity":		getters.entity( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    zome_versions: ( state, getters ) => ( zome_id ) =>  {
		const path		= dataTypePath.zomeVersions( zome_id );
		return {
		    "collection":	getters.collection( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    zome_version: ( state, getters ) => ( id ) =>  {
		const path		= dataTypePath.zomeVersion( id );
		return {
		    "entity":		getters.entity( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },

	    zome_version_wasm: ( state, getters ) => ( addr ) =>  {
		const path		= dataTypePath.zomeVersionWasm( addr );
		return {
		    "metadata":		getters.metadata( path ),
		};
	    },
	},
	"mutations": {
	    expireEntity ( state, path ) {
		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		state.metadata[path].stored_at	= -Infinity;
		state.metadata[path].current	= false;
	    },
	    cacheEntity ( state, [ path, entity ] ) {
		state.entities[path]		= entity;

		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		state.metadata[path].stored_at	= Date.now();
		state.metadata[path].loaded	= true;
		state.metadata[path].current	= true;
	    },
	    cacheCollection ( state, [ path, collection ]) {
		state.collections[path]		= collection;

		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		state.metadata[path].stored_at	= Date.now();
		state.metadata[path].loaded	= true;
		state.metadata[path].current	= true;
	    },
	    metadata ( state, [ path, metadata ] ) {
		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		const entity		= state.metadata[path];
		for ( let k in metadata ) {
		    entity[k]		= metadata[k];
		}
	    },
	    signalLoading ( state, path ) {
		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		state.metadata[path].loading	= true;
		state.metadata[path].current	= false;
	    },
	    recordLoaded ( state, path ) {
		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		state.metadata[path].loaded	= true;
		state.metadata[path].loading	= false;
		state.metadata[path].current	= true;
	    },
	},
	"actions": {
	    //
	    // Agent
	    //
	    async fetchZomes ({ commit }, { agent } ) {
		const path		= dataTypePath.zomes( agent );

		commit("signalLoading", path );

		log.debug("Getting %s zomes", agent );
		let zomes;
		if ( agent === "me" ) {
		    zomes		= await client.call(
			"dnarepo", "dna_library", "get_my_zomes"
		    );
		}
		else {
		    zomes		= await client.call(
			"dnarepo", "dna_library", "get_zomes", { agent }
		    );
		}

		log.info("Found %s Zomes in Collection for %s", zomes.length, String( zomes.$base ) );

		commit("cacheCollection", [ path, zomes ] );
		commit("recordLoaded", path );

		return zomes;
	    },


	    //
	    // Zome
	    //
	    async fetchZome ({ commit }, id ) {
		const path		= dataTypePath.zome( id );

		commit("signalLoading", path );

		log.debug("Getting zome %s", String(id) );
		let zome		= await client.call(
		    "dnarepo", "dna_library", "get_zome", { id }
		);

		log.info("Received zome: %s", zome.name, zome );

		commit("cacheEntity", [ path, zome ] );
		commit("recordLoaded", path );

		return zome;
	    },

	    async fetchVersionsForZome ({ commit }, zome_id ) {
		const path		= dataTypePath.zomeVersions( zome_id );

		commit("signalLoading", path );

		log.debug("Getting versions for zome %s", String(zome_id) );
		let versions		= await client.call(
		    "dnarepo", "dna_library", "get_zome_versions", { "for_zome": zome_id }
		);

		log.info("Received %s versions for %s", versions.length, String(versions.$base) );

		commit("cacheCollection", [ path, versions ] );
		commit("recordLoaded", path );

		return versions;
	    },

	    async createZome ({ commit }, input ) {
		log.normal("Creating Zome: %s", input.name );
		const zome		= await client.call(
		    "dnarepo", "dna_library", "create_zome", input
		);

		const path		= dataTypePath.zome( zome.$id );
		commit("cacheEntity", [ path, zome ] );

		return zome;
	    },

	    async updateZome ({ commit, getters }, [ id, input ] ) {
		const entity		= getters.zome( id ).entity;
		const path		= dataTypePath.zome( id );

		commit("metadata", [ path, { "updating": true }] );

		log.normal("Updating Zome (%s)", String(entity.$addr) );
		try {
		    const zome		= await client.call(
			"dnarepo", "dna_library", "update_zome", {
			    // "id": id,
			    "addr": entity.$addr,
			    "properties": input,
			}
		    );

		    commit("cacheEntity", [ path, zome ] );

		    return zome;
		} finally {
		    commit("metadata", [ path, { "updating": false }] );
		}
	    },

	    async deprecateZome ({ commit, getters }, [ id, { message } ] ) {
		const entity		= getters.zome( id ).entity;
		const path		= dataTypePath.zome( id );

		commit("metadata", [ path, { "deprecating": true }] );

		log.normal("Deprecating Zome (%s) because: %s", String(entity.$addr), message );
		try {
		    const zome		= await client.call(
			"dnarepo", "dna_library", "deprecate_zome", {
			    "addr": entity.$addr,
			    "message": message,
			}
		    );

		    commit("cacheEntity", [ path, zome ] );

		    return zome;
		} finally {
		    commit("metadata", [ path, { "deprecating": false }] );
		}

	    },


	    //
	    // Zome Version
	    //
	    async fetchZomeVersion ({ commit }, id ) {
		const path		= dataTypePath.zomeVersion( id );

		commit("signalLoading", path );

		log.debug("Getting zome version %s", String(id) );
		let version		= await client.call(
		    "dnarepo", "dna_library", "get_zome_version", { id }
		);

		log.info("Received zome version: %s", version.version, version );

		commit("cacheEntity", [ path, version ] );
		commit("recordLoaded", path );

		return version;
	    },

	    async fetchZomeVersionWasm ({ commit }, addr ) {
		const path		= dataTypePath.zomeVersionWasm( addr );

		commit("signalLoading", path );

		log.debug("Getting Wasm bytes %s", String(addr) );
		let wasm_bytes		= await client.call(
		    "dnarepo", "mere_memory", "retrieve_bytes", addr
		);

		log.info("Received wasm_bytes:", wasm_bytes );
		commit("recordLoaded", path );

		return new Uint8Array( wasm_bytes );
	    },

	    async createZomeVersion ({ commit }, [ zome_id, input ] ) {
		log.normal("Creating Zome Version: #%s", input.version );

		input.for_zome		= zome_id;

		const version		= await client.call(
		    "dnarepo", "dna_library", "create_zome_version", input
		);

		const path		= dataTypePath.zomeVersion( version.$id );
		commit("cacheEntity", [ path, version ] );

		return version;
	    },

	    async updateZomeVersion ({ commit, getters }, [ id, input ] ) {
		const entity		= getters.zome_version( id ).entity;
		const path		= dataTypePath.zomeVersion( id );

		commit("metadata", [ path, { "updating": true }] );

		log.normal("Updating Zome Version (%s)", String(entity.$addr) );
		try {
		    const version	= await client.call(
			"dnarepo", "dna_library", "update_zome_version", {
			    // "id": id,
			    "addr": entity.$addr,
			    "properties": input,
			}
		    );

		    commit("cacheEntity", [ path, version ] );

		    return version;
		} finally {
		    commit("metadata", [ path, { "updating": false }] );
		}
	    },

	    async unpublishZomeVersion ({ commit }, id ) {
		const path		= dataTypePath.zomeVersion( id );

		commit("metadata", [ path, { "unpublishing": true }] );

		log.normal("Deleting Zome Version (%s)", String(id) );
		try {
		    await client.call(
			"dnarepo", "dna_library", "delete_zome_version", {
			    "id": id,
			}
		    );

		    commit("expireEntity", path );
		} finally {
		    commit("metadata", [ path, { "unpublishing": false }] );
		}
	    },
	},
    });
};
