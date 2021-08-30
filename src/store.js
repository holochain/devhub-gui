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
    dnaVersionPackage:	( addr )	=> store_path( "dna",  "version", addr, "package_bytes" ),
    happReleasePackage:	( addr )	=> store_path( "happ", "release", addr, "package_bytes" ),
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

	    //
	    // Zome
	    //
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

	    //
	    // DNA
	    //
	    dnas: ( state, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.dnas( agent );
		return {
		    "collection":	getters.collection( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    dna: ( state, getters ) => ( id ) => {
		const path		= dataTypePath.dna( id );
		return {
		    "entity":		getters.entity( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    dna_versions: ( state, getters ) => ( dna_id ) =>  {
		const path		= dataTypePath.dnaVersions( dna_id );
		return {
		    "collection":	getters.collection( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    dna_version: ( state, getters ) => ( id ) =>  {
		const path		= dataTypePath.dnaVersion( id );
		return {
		    "entity":		getters.entity( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    dna_version_package: ( state, getters ) => ( addr ) =>  {
		const path		= dataTypePath.dnaVersionPackage( addr );
		return {
		    "metadata":		getters.metadata( path ),
		};
	    },

	    //
	    // hApp
	    //
	    happs: ( state, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.happs( agent );
		return {
		    "collection":	getters.collection( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    happ: ( state, getters ) => ( id ) => {
		const path		= dataTypePath.happ( id );
		return {
		    "entity":		getters.entity( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    happ_releases: ( state, getters ) => ( happ_id ) =>  {
		const path		= dataTypePath.happReleases( happ_id );
		return {
		    "collection":	getters.collection( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    happ_release: ( state, getters ) => ( id ) =>  {
		const path		= dataTypePath.happRelease( id );
		return {
		    "entity":		getters.entity( path ),
		    "metadata":		getters.metadata( path ),
		};
	    },
	    happ_release_package: ( state, getters ) => ( addr ) =>  {
		const path		= dataTypePath.happReleasePackage( addr );
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

	    async fetchDnas ({ commit }, { agent } ) {
		const path		= dataTypePath.dnas( agent );

		commit("signalLoading", path );

		log.debug("Getting %s dnas", agent );
		let dnas;
		if ( agent === "me" ) {
		    dnas		= await client.call(
			"dnarepo", "dna_library", "get_my_dnas"
		    );
		}
		else {
		    dnas		= await client.call(
			"dnarepo", "dna_library", "get_dnas", { agent }
		    );
		}

		log.info("Found %s DNAs in Collection for %s", dnas.length, String( dnas.$base ) );

		commit("cacheCollection", [ path, dnas ] );
		commit("recordLoaded", path );

		return dnas;
	    },

	    async fetchHapps ({ commit }, { agent } ) {
		const path		= dataTypePath.happs( agent );

		commit("signalLoading", path );

		log.debug("Getting %s happs", agent );
		let happs;
		if ( agent === "me" ) {
		    happs		= await client.call(
			"happs", "happ_library", "get_my_happs"
		    );
		}
		else {
		    happs		= await client.call(
			"happs", "happ_library", "get_happs", { agent }
		    );
		}

		log.info("Found %s hApps in Collection for %s", happs.length, String( happs.$base ) );

		commit("cacheCollection", [ path, happs ] );
		commit("recordLoaded", path );

		return happs;
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


	    //
	    // DNA
	    //
	    async fetchDna ({ commit }, id ) {
		const path		= dataTypePath.dna( id );

		commit("signalLoading", path );

		log.debug("Getting dna %s", String(id) );
		let dna		= await client.call(
		    "dnarepo", "dna_library", "get_dna", { id }
		);

		log.info("Received dna: %s", dna.name, dna );

		commit("cacheEntity", [ path, dna ] );
		commit("recordLoaded", path );

		return dna;
	    },

	    async fetchVersionsForDna ({ commit }, dna_id ) {
		const path		= dataTypePath.dnaVersions( dna_id );

		commit("signalLoading", path );

		log.debug("Getting versions for dna %s", String(dna_id) );
		let versions		= await client.call(
		    "dnarepo", "dna_library", "get_dna_versions", { "for_dna": dna_id }
		);

		log.info("Received %s versions for %s", versions.length, String(versions.$base) );

		commit("cacheCollection", [ path, versions ] );
		commit("recordLoaded", path );

		return versions;
	    },

	    async createDna ({ commit }, input ) {
		log.normal("Creating DNA: %s", input.name );
		const dna		= await client.call(
		    "dnarepo", "dna_library", "create_dna", input
		);

		const path		= dataTypePath.dna( dna.$id );
		commit("cacheEntity", [ path, dna ] );

		return dna;
	    },

	    async updateDna ({ commit, getters }, [ id, input ] ) {
		const entity		= getters.dna( id ).entity;
		const path		= dataTypePath.dna( id );

		commit("metadata", [ path, { "updating": true }] );

		log.normal("Updating DNA (%s)", String(entity.$addr) );
		try {
		    const dna		= await client.call(
			"dnarepo", "dna_library", "update_dna", {
			    // "id": id,
			    "addr": entity.$addr,
			    "properties": input,
			}
		    );

		    commit("cacheEntity", [ path, dna ] );

		    return dna;
		} finally {
		    commit("metadata", [ path, { "updating": false }] );
		}
	    },

	    async deprecateDna ({ commit, getters }, [ id, { message } ] ) {
		const entity		= getters.dna( id ).entity;
		const path		= dataTypePath.dna( id );

		commit("metadata", [ path, { "deprecating": true }] );

		log.normal("Deprecating DNA (%s) because: %s", String(entity.$addr), message );
		try {
		    const dna		= await client.call(
			"dnarepo", "dna_library", "deprecate_dna", {
			    "addr": entity.$addr,
			    "message": message,
			}
		    );

		    commit("cacheEntity", [ path, dna ] );

		    return dna;
		} finally {
		    commit("metadata", [ path, { "deprecating": false }] );
		}

	    },


	    //
	    // DNA Version
	    //
	    async fetchDnaVersion ({ commit }, id ) {
		const path		= dataTypePath.dnaVersion( id );

		commit("signalLoading", path );

		log.debug("Getting dna version %s", String(id) );
		let version		= await client.call(
		    "dnarepo", "dna_library", "get_dna_version", { id }
		);

		log.info("Received dna version: %s", version.version, version );

		commit("cacheEntity", [ path, version ] );
		commit("recordLoaded", path );

		return version;
	    },

	    async fetchDnaVersionPackage ({ commit }, id ) {
		const path		= dataTypePath.dnaVersionPackage( id );

		commit("signalLoading", path );

		log.debug("Getting DNA package %s", String(id) );
		try {
		    let pack		= await client.call(
			"dnarepo", "dna_library", "get_dna_package", { id }
		    );

		    log.info("Received DNA package:", pack );
		    return pack;
		} finally {
		    commit("recordLoaded", path );
		}
	    },

	    async createDnaVersion ({ commit }, [ dna_id, input ] ) {
		log.normal("Creating DNA Version: #%s", input.version );

		input.for_dna		= dna_id;

		const version		= await client.call(
		    "dnarepo", "dna_library", "create_dna_version", input
		);

		const path		= dataTypePath.dnaVersion( version.$id );
		commit("cacheEntity", [ path, version ] );

		return version;
	    },

	    async updateDnaVersion ({ commit, getters }, [ id, input ] ) {
		const entity		= getters.dna_version( id ).entity;
		const path		= dataTypePath.dnaVersion( id );

		commit("metadata", [ path, { "updating": true }] );

		log.normal("Updating DNA Version (%s)", String(entity.$addr) );
		try {
		    const version	= await client.call(
			"dnarepo", "dna_library", "update_dna_version", {
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

	    async unpublishDnaVersion ({ commit }, id ) {
		const path		= dataTypePath.dnaVersion( id );

		commit("metadata", [ path, { "unpublishing": true }] );

		log.normal("Deleting DNA Version (%s)", String(id) );
		try {
		    await client.call(
			"dnarepo", "dna_library", "delete_dna_version", {
			    "id": id,
			}
		    );

		    commit("expireEntity", path );
		} finally {
		    commit("metadata", [ path, { "unpublishing": false }] );
		}
	    },


	    //
	    // Happ
	    //
	    async fetchHapp ({ commit }, id ) {
		const path		= dataTypePath.happ( id );

		commit("signalLoading", path );

		log.debug("Getting happ %s", String(id) );
		let happ		= await client.call(
		    "happs", "happ_library", "get_happ", { id }
		);

		log.info("Received happ: %s", happ.name, happ );

		commit("cacheEntity", [ path, happ ] );
		commit("recordLoaded", path );

		return happ;
	    },

	    async fetchReleasesForHapp ({ commit }, happ_id ) {
		const path		= dataTypePath.happReleases( happ_id );

		commit("signalLoading", path );

		log.debug("Getting releases for happ %s", String(happ_id) );
		let releases		= await client.call(
		    "happs", "happ_library", "get_happ_releases", { "for_happ": happ_id }
		);

		log.info("Received %s releases for %s", releases.length, String(releases.$base) );

		commit("cacheCollection", [ path, releases ] );
		commit("recordLoaded", path );

		return releases;
	    },

	    async createHapp ({ commit }, input ) {
		log.normal("Creating Happ: %s", input.name );
		const happ		= await client.call(
		    "happs", "happ_library", "create_happ", input
		);

		const path		= dataTypePath.happ( happ.$id );
		commit("cacheEntity", [ path, happ ] );

		return happ;
	    },

	    async updateHapp ({ commit, getters }, [ id, input ] ) {
		const entity		= getters.happ( id ).entity;
		const path		= dataTypePath.happ( id );

		commit("metadata", [ path, { "updating": true }] );

		log.normal("Updating Happ (%s)", String(entity.$addr) );
		try {
		    const happ		= await client.call(
			"happs", "happ_library", "update_happ", {
			    // "id": id,
			    "addr": entity.$addr,
			    "properties": input,
			}
		    );

		    commit("cacheEntity", [ path, happ ] );

		    return happ;
		} finally {
		    commit("metadata", [ path, { "updating": false }] );
		}
	    },

	    async deprecateHapp ({ commit, getters }, [ id, { message } ] ) {
		const entity		= getters.happ( id ).entity;
		const path		= dataTypePath.happ( id );

		commit("metadata", [ path, { "deprecating": true }] );

		log.normal("Deprecating Happ (%s) because: %s", String(entity.$addr), message );
		try {
		    const happ		= await client.call(
			"happs", "happ_library", "deprecate_happ", {
			    "addr": entity.$addr,
			    "message": message,
			}
		    );

		    commit("cacheEntity", [ path, happ ] );

		    return happ;
		} finally {
		    commit("metadata", [ path, { "deprecating": false }] );
		}

	    },


	    //
	    // Happ Release
	    //
	    async fetchHappRelease ({ commit }, id ) {
		const path		= dataTypePath.happRelease( id );

		commit("signalLoading", path );

		log.debug("Getting happ release %s", String(id) );
		let release		= await client.call(
		    "happs", "happ_library", "get_happ_release", { id }
		);

		log.info("Received happ release: %s", release.release, release );

		commit("cacheEntity", [ path, release ] );
		commit("recordLoaded", path );

		return release;
	    },

	    async fetchHappReleasePackage ({ commit }, id ) {
		const path		= dataTypePath.happReleasePackage( id );

		commit("signalLoading", path );

		log.debug("Getting hApp package %s", String(id) );
		try {
		    let bytes		= await client.call(
			"happs", "happ_library", "get_release_package", {
			    id,
			    "dnarepo_dna_hash": client._client._app_schema._dnas["dnarepo"]._hash,
			}, {
			    "timeout": 30_000,
			}
		    );

		    log.info("Received hApp package:", bytes );

		    return new Uint8Array( bytes );
		} finally {
		    commit("recordLoaded", path );
		}
	    },

	    async createHappRelease ({ commit }, [ happ_id, input ] ) {
		log.normal("Creating Happ Release: #%s", input.release );

		input.for_happ		= happ_id;

		const release		= await client.call(
		    "happs", "happ_library", "create_happ_release", input
		);

		const path		= dataTypePath.happRelease( release.$id );
		commit("cacheEntity", [ path, release ] );

		return release;
	    },

	    async updateHappRelease ({ commit, getters }, [ id, input ] ) {
		const entity		= getters.happ_release( id ).entity;
		const path		= dataTypePath.happRelease( id );

		commit("metadata", [ path, { "updating": true }] );

		log.normal("Updating Happ Release (%s)", String(entity.$addr) );
		try {
		    const release	= await client.call(
			"happs", "happ_library", "update_happ_release", {
			    // "id": id,
			    "addr": entity.$addr,
			    "properties": input,
			}
		    );

		    commit("cacheEntity", [ path, release ] );

		    return release;
		} finally {
		    commit("metadata", [ path, { "updating": false }] );
		}
	    },

	    async unpublishHappRelease ({ commit }, id ) {
		const path		= dataTypePath.happRelease( id );

		commit("metadata", [ path, { "unpublishing": true }] );

		log.normal("Deleting Happ Release (%s)", String(id) );
		try {
		    await client.call(
			"happs", "happ_library", "delete_happ_release", {
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
