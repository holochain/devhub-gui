const { Logger }			= require('@whi/weblogger');
const log				= new Logger("store");

const common				= require('./common.js');
const $filters				= require('./filters.js');

const { HoloHash,
	AgentPubKey }			= holohash;
const { EntityArchitect }		= CruxPayloadParser;
const { Entity, Collection }		= EntityArchitect;


// Data getting scenarios:
//
//   1. Get metadata based on ID
//      - loaded	- true if this entity has ever been loaded
//      - loading	- true if the corresponding "fetch..." method has been dispatched but has not finished
//      - current	- true if 'loaded' is true and not expired
//      - writable	- true if the current agent can commit updates to this entity
//      - stored_at	- used to calculate expiry date
//   2. Get (current) cached info for entity based on ID
//   3. Get (any) cached info for entity based on ID
//   4. Must get entity based on ID
//      - Is it in cache?
//      - Is it expired?
//      - Is it in Holochain?
//
// Vuex solutions:
//
//   state	- (sync) get raw data
//   getters	- (sync) get processed data
//   actions	- (async) exectue a process that can commit mutations
//
// Scenario to Vuex solution map:
//
//   1. (getters) so that there can be a default state for any metadata ID
//   2. (getters) so that the expiry date can be calculated and checked
//   3. (getters) so that it returns 'null' as the default instead of 'undefined'
//   4. (actions) so that async is supported



const DEFAULT_METADATA_STATES		= {
    "loaded": false,
    "loading": false,
    "current": false,
    "writable": false,
    "stored_at": Infinity,
};
const CACHE_EXPIRATION_LIMIT		= 1_000 * 60 * 10; // 10 minutes
const copy				= obj => Object.assign( {}, obj );
const store_path			= ( ...segments ) => segments.join("/");

const dataTypePath			= {
    zomes:		( agent )	=> store_path( "zomes", agent ),
    zomesByName:	( name )	=> store_path( "zomes", name ),
    zome:		( id )		=> store_path( "zome", id ),
    zomeVersions:	( id )		=> store_path( "zome", id, "versions" ),
    zomeVersionsByHash:	( hash )	=> store_path( "zome", "versions", hash ),
    zomeVersion:	( id )		=> store_path( "zome", "version", id ),

    dnas:		( agent )	=> store_path( "dnas", agent ),
    dnasByName:		( name )	=> store_path( "dnas", name ),
    dna:		( id )		=> store_path( "dna", id ),
    dnaVersions:	( id )		=> store_path( "dna", id, "versions" ),
    dnaVersionsByHash:	( hash )	=> store_path( "dna", "versions", hash ),
    dnaVersion:		( id )		=> store_path( "dna", "version", id ),

    happs:		( agent )	=> store_path( "happs", agent ),
    happ:		( id )		=> store_path( "happ", id ),
    happReleases:	( id )		=> store_path( "happ", id, "releases" ),
    happRelease:	( id )		=> store_path( "happ", "release", id ),

    agentReviews:	( agent )	=> store_path( agent, "reviews" ),
    reviews:		( base )	=> store_path( "reviews", base ),
    review:		( id )		=> store_path( "review", id ),
    reviewSummaries:	( base )	=> store_path( "review_summaries", base ),
    reviewSummary:	( id )		=> store_path( "review_summary", id ),

    agentReactions:	( agent )	=> store_path( agent, "reactions" ),
    reactions:		( base )	=> store_path( "reactions", base ),
    reaction:		( id )		=> store_path( "reaction", id ),
    reactionSummaries:	( base )	=> store_path( "reaction_summaries", base ),
    reactionSummary:	( id )		=> store_path( "reaction_summary", id ),

    zomeVersionWasm:	( addr )	=> store_path( "zome", "version", addr, "wasm_bytes" ),
    dnaVersionPackage:	( addr )	=> store_path( "dna",  "version", addr, "package_bytes" ),
    happReleasePackage:	( addr )	=> store_path( "happ", "release", addr, "package_bytes" ),

    hdkVersions:	()		=> store_path( "misc", "hdk_versions" ),
    webAsset:		( id )		=> store_path( "web_assets", id ),
    file:		( id )		=> store_path( "files", id ),
    bundle:		( id )		=> store_path( "bundles", id ),
    url:		( url )		=> store_path( "url", url ),
};


function fmt_client_args ( dna, zome, func, args ) {
    if ( String(args) === "[object Object]" && Object.keys(args).length )
	return `${dna}::${zome}->${func}( ${Object.keys(args).join(", ")} )`;
    else if ( String(args) !== "[object Object]" )
	return `${dna}::${zome}->${func}( ${String(args)} )`;
    else
	return `${dna}::${zome}->${func}()`;
}


// "uhCEk...r1cYf"		- When would we not care about type name/model
// "uhCEk...r1cYf/dna"		- When would we not care about the model
// "uhCEk...r1cYf/dna/summary"	- Does this affect metadata for info?
// "uhCEk...r1cYf/dna/info"	- Does metadata only matter for this?

// Perhaps we want to completely ignore summary models and only car about full info models?


module.exports = async function ( client, app ) {
    return new Vuex.Store({
	state () {
	    return {
		client,
		"entities": {},
		"collections": {},
		"values": {},
		"metadata": {},
	    };
	},
	"getters": {
	    isExpired: ( _, getters ) => ( path ) => {
		return getters.metadata( path ).stored_at + CACHE_EXPIRATION_LIMIT < Date.now();
	    },
	    entity: ( state, getters ) => ( path ) => {
		// Enforcing the cache expiry causes unexpected results unless there was an
		// automated re-fetching of the expired data.

		// if ( getters.isExpired( path ) )
		//     return null;

		return state.entities[ path ] || null;
	    },
	    collection: ( state, getters ) => ( path ) => {
		// Enforcing the cache expiry causes unexpected results unless there was an
		// automated re-fetching of the expired data.

		// if ( getters.isExpired( path ) )
		//     return [];

		return state.collections[ path ] || [];
	    },
	    value: ( state, getters ) => ( path ) => {
		// Enforcing the cache expiry causes unexpected results unless there was an
		// automated re-fetching of the expired data.

		// if ( getters.isExpired( path ) )
		//     return null;

		return state.values[ path ] || null;
	    },
	    metadata: ( state, getters ) => ( path ) => {
		return state.metadata[ path ] || copy( DEFAULT_METADATA_STATES );
	    },

	    //
	    // Agent
	    //
	    agent: ( _, getters ) => {
		return getters.entity("me");
	    },
	    $agent: ( _, getters ) => {
		return getters.metadata("me");
	    },

	    //
	    // Zome
	    //
	    zomes: ( _, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.zomes( agent );
		return getters.collection( path );
	    },
	    $zomes: ( _, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.zomes( agent );
		return getters.metadata( path );
	    },

	    zomes_by_name: ( _, getters ) => ( name ) => {
		const path		= dataTypePath.zomesByName( name );
		return getters.collection( path );
	    },
	    $zomes_by_name: ( _, getters ) => ( name ) => {
		const path		= dataTypePath.zomesByName( name );
		return getters.metadata( path );
	    },

	    zome: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.zome( id );
		return getters.entity( path );
	    },
	    $zome: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.zome( id );
		return getters.metadata( path );
	    },

	    zome_versions: ( _, getters ) => ( zome_id ) =>  {
		const path		= dataTypePath.zomeVersions( zome_id );
		return getters.collection( path );
	    },
	    $zome_versions: ( _, getters ) => ( zome_id ) => {
		const path		= dataTypePath.zomeVersions( zome_id );
		return getters.metadata( path );
	    },

	    zome_versions_by_hash: ( _, getters ) => ( hash ) => {
		const path		= dataTypePath.zomeVersionsByHash( hash );
		return getters.collection( path );
	    },
	    $zome_versions_by_hash: ( _, getters ) => ( hash ) => {
		const path		= dataTypePath.zomeVersionsByHash( hash );
		return getters.metadata( path );
	    },

	    zome_version: ( _, getters ) => ( id ) =>  {
		const path		= dataTypePath.zomeVersion( id );
		return getters.entity( path );
	    },
	    $zome_version: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.zomeVersion( id );
		return getters.metadata( path );
	    },

	    $zome_version_wasm: ( _, getters ) => ( addr ) => {
		const path		= dataTypePath.zomeVersionWasm( addr );
		return getters.metadata( path );
	    },

	    //
	    // DNA
	    //
	    dnas: ( _, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.dnas( agent );
		return getters.collection( path );
	    },
	    $dnas: ( _, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.dnas( agent );
		return getters.metadata( path );
	    },

	    dnas_by_name: ( _, getters ) => ( name ) => {
		const path		= dataTypePath.dnasByName( name );
		return getters.collection( path );
	    },
	    $dnas_by_name: ( _, getters ) => ( name ) => {
		const path		= dataTypePath.dnasByName( name );
		return getters.metadata( path );
	    },

	    dna: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.dna( id );
		return getters.entity( path );
	    },
	    $dna: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.dna( id );
		return getters.metadata( path );
	    },

	    dna_versions: ( _, getters ) => ( dna_id ) =>  {
		const path		= dataTypePath.dnaVersions( dna_id );
		return getters.collection( path );
	    },
	    $dna_versions: ( _, getters ) => ( dna_id ) =>  {
		const path		= dataTypePath.dnaVersions( dna_id );
		return getters.metadata( path );
	    },

	    dna_versions_by_hash: ( _, getters ) => ( hash ) => {
		const path		= dataTypePath.dnaVersionsByHash( hash );
		return getters.collection( path );
	    },
	    $dna_versions_by_hash: ( _, getters ) => ( hash ) => {
		const path		= dataTypePath.dnaVersionsByHash( hash );
		return getters.metadata( path );
	    },

	    dna_version: ( _, getters ) => ( id ) =>  {
		const path		= dataTypePath.dnaVersion( id );
		return getters.entity( path );
	    },
	    $dna_version: ( _, getters ) => ( id ) =>  {
		const path		= dataTypePath.dnaVersion( id );
		return getters.metadata( path );
	    },

	    $dna_version_package: ( _, getters ) => ( addr ) =>  {
		const path		= dataTypePath.dnaVersionPackage( addr );
		return getters.metadata( path );
	    },

	    //
	    // hApp
	    //
	    happs: ( _, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.happs( agent );
		return getters.collection( path );
	    },
	    $happs: ( _, getters ) => ( agent = "me" ) => {
		const path		= dataTypePath.happs( agent );
		return getters.metadata( path );
	    },

	    happ: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.happ( id );
		return getters.entity( path );
	    },
	    $happ: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.happ( id );
		return getters.metadata( path );
	    },

	    happ_releases: ( _, getters ) => ( happ_id ) =>  {
		const path		= dataTypePath.happReleases( happ_id );
		return getters.collection( path );
	    },
	    $happ_releases: ( _, getters ) => ( happ_id ) =>  {
		const path		= dataTypePath.happReleases( happ_id );
		return getters.metadata( path );
	    },

	    happ_release: ( _, getters ) => ( id ) =>  {
		const path		= dataTypePath.happRelease( id );
		return getters.entity( path );
	    },
	    $happ_release: ( _, getters ) => ( id ) =>  {
		const path		= dataTypePath.happRelease( id );
		return getters.metadata( path );
	    },

	    // happ_release_package: ( _, getters ) => ( addr ) =>  {
	    // 	const path		= dataTypePath.happReleasePackage( addr );
	    // 	return getters.entity( path );
	    // },
	    $happ_release_package: ( _, getters ) => ( addr ) =>  {
		const path		= dataTypePath.happReleasePackage( addr );
		return getters.metadata( path );
	    },

	    //
	    // Miscellaneous
	    //
	    hdk_versions: ( _, getters ) => {
		const path		= dataTypePath.hdkVersions();
		return getters.collection( path );
	    },
	    $hdk_versions: ( _, getters ) => {
		const path		= dataTypePath.hdkVersions();
		return getters.metadata( path );
	    },

	    file: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.file( id );
		return getters.value( path );
	    },
	    $file: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.file( id );
		return getters.metadata( path );
	    },

	    bundle: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.bundle( id );
		return getters.value( path );
	    },
	    $bundle: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.bundle( id );
		return getters.metadata( path );
	    },

	    url: ( _, getters ) => ( url ) => {
		const path		= dataTypePath.url( url );
		return getters.value( path );
	    },
	    $url: ( _, getters ) => ( url ) => {
		const path		= dataTypePath.url( url );
		return getters.metadata( path );
	    },

	    //
	    // Review
	    //
	    reviews: ( _, getters ) => ( base_hash ) => {
		const path		= dataTypePath.reviews( base_hash );
		return getters.collection( path );
	    },
	    $reviews: ( _, getters ) => ( base_hash ) => {
		const path		= dataTypePath.reviews( base_hash );
		return getters.metadata( path );
	    },

	    my_reviews: ( _, getters ) => {
		const path		= dataTypePath.agentReviews( "me" );
		return getters.collection( path );
	    },
	    $my_reviews: ( _, getters ) => {
		const path		= dataTypePath.agentReviews( "me" );
		return getters.metadata( path );
	    },
	    reviews_by_subject: ( _, getters ) => {
		const path		= dataTypePath.agentReviews( "me" );
		return getters.value( path );
	    },

	    review: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.review( id );
		return getters.entity( path );
	    },
	    $review: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.review( id );
		return getters.metadata( path );
	    },

	    review_summaries: ( _, getters ) => ( base_hash ) =>  {
		const path		= dataTypePath.reviewSummaries( base_hash );
		return getters.collection( path );
	    },
	    $review_summaries: ( _, getters ) => ( base_hash ) => {
		const path		= dataTypePath.reviewSummaries( base_hash );
		return getters.metadata( path );
	    },

	    review_summary: ( _, getters ) => ( id ) =>  {
		const path		= dataTypePath.reviewSummary( id );
		return getters.entity( path );
	    },
	    $review_summary: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.reviewSummary( id );
		return getters.metadata( path );
	    },

	    //
	    // Reaction
	    //
	    reactions: ( _, getters ) => ( base_hash ) => {
		const path		= dataTypePath.reactions( base_hash );
		return getters.collection( path );
	    },
	    $reactions: ( _, getters ) => ( base_hash ) => {
		const path		= dataTypePath.reactions( base_hash );
		return getters.metadata( path );
	    },

	    my_reactions: ( _, getters ) => {
		const path		= dataTypePath.agentReactions( "me" );
		return getters.collection( path );
	    },
	    $my_reactions: ( _, getters ) => {
		const path		= dataTypePath.agentReactions( "me" );
		return getters.metadata( path );
	    },
	    reactions_by_subject: ( _, getters ) => {
		const path		= dataTypePath.agentReactions( "me" );
		return getters.value( path );
	    },

	    reaction: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.reaction( id );
		return getters.entity( path );
	    },
	    $reaction: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.reaction( id );
		return getters.metadata( path );
	    },

	    reaction_summaries: ( _, getters ) => ( base_hash ) =>  {
		const path		= dataTypePath.reactionSummaries( base_hash );
		return getters.collection( path );
	    },
	    $reaction_summaries: ( _, getters ) => ( base_hash ) => {
		const path		= dataTypePath.reactionSummaries( base_hash );
		return getters.metadata( path );
	    },

	    reaction_summary: ( _, getters ) => ( id ) =>  {
		const path		= dataTypePath.reactionSummary( id );
		return getters.entity( path );
	    },
	    $reaction_summary: ( _, getters ) => ( id ) => {
		const path		= dataTypePath.reactionSummary( id );
		return getters.metadata( path );
	    },
	},
	"mutations": {
	    expireData ( state, path ) {
		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		state.metadata[path].stored_at	= -Infinity;
		state.metadata[path].current	= false;
	    },
	    removeEntity ( state, path ) {
		state.metadata[path]		= copy( DEFAULT_METADATA_STATES );

		delete state.entities[ path ];
	    },
	    removeCollection ( state, path ) {
		state.metadata[path]		= copy( DEFAULT_METADATA_STATES );

		delete state.collections[ path ];
	    },
	    removeValue ( state, path ) {
		state.metadata[path]		= copy( DEFAULT_METADATA_STATES );

		delete state.values[ path ];
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
	    cacheValue ( state, [ path, value ] ) {
		state.values[path]		= value;

		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		state.metadata[path].stored_at	= Date.now();
		state.metadata[path].loaded	= true;
		state.metadata[path].current	= true;
	    },
	    metadata ( state, [ path, metadata ] ) {
		if ( state.metadata[path] === undefined )
		    state.metadata[path]	= copy( DEFAULT_METADATA_STATES );

		const context		= state.metadata[path];
		for ( let k in metadata ) {
		    context[k]		= metadata[k];
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

		log.trace("%s: record loaded", path );
	    },
	    cacheValueInsert ( state, [ path, key, value ] ) {
		if ( state.values[path] === undefined )
		    state.values[path]		= {};

		state.values[path][key]		= value;
	    },
	},
	"actions": {
	    async callClient ( ctx, [ dna, zome, func, args, timeout ]) {
		log.debug("Getting dna %s", () => [
		    fmt_client_args( dna, zome, func, args ), args ]);
		try {
		    const resp		= await client.call( dna, zome, func, args, timeout );
		    log.trace("Received response:", resp );

		    return resp;
		} catch (err) {
		    log.error("Client call raised: %s( %s )", err.name, err.message );

		    throw err;
		}
	    },
	    async fetchResource ({ dispatch, commit }, [ path, dna, zome, func, args, timeout ]) {
		commit("signalLoading", path );

		const resource		= await dispatch("callClient", [ dna, zome, func, args, timeout ]);

		// Should use a different cache because resources are not required to be instance of Entity
		commit("cacheEntity", [ path, resource ] );
		commit("recordLoaded", path );

		return resource;
	    },
	    async fetchEntity ({ dispatch, commit }, [ path, dna, zome, func, args, timeout ]) {
		commit("signalLoading", path );

		const entity		= await dispatch("callClient", [ dna, zome, func, args, timeout ]);

		if ( entity.constructor.name !== "Entity" )
		    log.warn("Expected instance of Entity for request %s; received type '%s'", fmt_client_args( dna, zome, func, args ), typeof entity );

		commit("cacheEntity", [ path, entity ] );
		commit("recordLoaded", path );

		return entity;
	    },
	    async fetchCollection ({ dispatch, commit }, [ path, dna, zome, func, args, timeout ]) {
		commit("signalLoading", path );

		const collection	= await dispatch("callClient", [ dna, zome, func, args, timeout ]);

		if ( collection.constructor.name !== "Collection" )
		    log.warn("Expected instance of Collection for request %s; received type '%s'", fmt_client_args( dna, zome, func, args ), typeof collection );

		commit("cacheCollection", [ path, collection ] );
		commit("recordLoaded", path );

		return collection;
	    },
	    expireData ({ commit }, [ path_fn_name, id ] ) {
		const path		= dataTypePath[ path_fn_name ]( id );

		commit("expireData", path );
	    },
	    removeEntity ({ commit }, [ path_fn_name, id ] ) {
		const path		= dataTypePath[ path_fn_name ]( id );

		commit("removeEntity", path );
	    },
	    removeCollection ({ commit }, [ path_fn_name, id ] ) {
		const path		= dataTypePath[ path_fn_name ]( id );

		commit("removeCollection", path );
	    },
	    removeValue ({ commit }, [ path_fn_name, id ] ) {
		const path		= dataTypePath[ path_fn_name ]( id );

		commit("removeValue", path );
	    },

	    // Caching entities with special computations
	    async cacheHapp ({ dispatch, commit }, happ ) {
		const path		= dataTypePath.happ( happ.$id );

		commit("cacheEntity", [ path, happ ] );
		commit("recordLoaded", path );

		let agent_info		= await dispatch("getAgent");

		commit("metadata", [ path, {
		    "writable": common.hashesAreEqual( happ.designer, agent_info.pubkey.initial ),
		}] );
	    },
	    async cacheHappRelease ({ dispatch, commit }, happ_release ) {
		const path		= dataTypePath.happRelease( happ_release.$id );

		commit("cacheEntity", [ path, happ_release ] );
		commit("recordLoaded", path );

		const agent_info	= await dispatch("getAgent");
		const happ		= await dispatch("getHapp", happ_release.for_happ );

		commit("metadata", [ path, {
		    "writable": common.hashesAreEqual( happ.designer, agent_info.pubkey.initial ),
		}] );
	    },
	    async cacheDna ({ dispatch, commit }, dna ) {
		const path		= dataTypePath.dna( dna.$id );

		commit("cacheEntity", [ path, dna ] );
		commit("recordLoaded", path );

		let agent_info		= await dispatch("getAgent");

		commit("metadata", [ path, {
		    "writable": common.hashesAreEqual( dna.developer, agent_info.pubkey.initial ),
		}] );
	    },
	    async cacheDnaVersion ({ dispatch, commit }, dna_version ) {
		const path		= dataTypePath.dnaVersion( dna_version.$id );

		commit("cacheEntity", [ path, dna_version ] );
		commit("recordLoaded", path );

		const agent_info	= await dispatch("getAgent");
		const dna		= await dispatch("getDna", dna_version.for_dna );

		commit("metadata", [ path, {
		    "writable": common.hashesAreEqual( dna.developer, agent_info.pubkey.initial ),
		}] );
	    },
	    async cacheZome ({ dispatch, commit }, zome ) {
		const path		= dataTypePath.zome( zome.$id );

		commit("cacheEntity", [ path, zome ] );
		commit("recordLoaded", path );

		let agent_info		= await dispatch("getAgent");

		commit("metadata", [ path, {
		    "writable": common.hashesAreEqual( zome.developer, agent_info.pubkey.initial ),
		}] );
	    },
	    async cacheZomeVersion ({ dispatch, commit }, zome_version ) {
		const path		= dataTypePath.zomeVersion( zome_version.$id );

		commit("cacheEntity", [ path, zome_version ] );
		commit("recordLoaded", path );

		const agent_info	= await dispatch("getAgent");
		const zome		= await dispatch("getZome", zome_version.for_zome );

		commit("metadata", [ path, {
		    "writable": common.hashesAreEqual( zome.developer, agent_info.pubkey.initial ),
		}] );
	    },
	    async cacheReview ({ dispatch, commit }, review ) {
		const path		= dataTypePath.review( review.$id );

		const agent_info	= await dispatch("getAgent");
		const author_is_me	= common.hashesAreEqual( review.author, agent_info.pubkey.initial );

		commit("cacheEntity", [ path, review ] );

		if ( author_is_me ) {
		    const agent_path	= dataTypePath.agentReviews( "me" );

		    for ( let [id, _] of review.subject_ids ) {
			commit("cacheValueInsert", [ agent_path, id, review ] );
		    }

		    commit("metadata", [ path, {
			"writable": true,
		    }] );
		}

		commit("recordLoaded", path );
	    },
	    async cacheReviewSummary ({ dispatch, commit }, review_summary ) {
		const path		= dataTypePath.reviewSummary( review_summary.$id );

		commit("cacheEntity", [ path, review_summary ] );
		commit("recordLoaded", path );

		let agent_info		= await dispatch("getAgent");

		commit("metadata", [ path, {
		    "writable": false,
		}] );
	    },
	    async cacheReaction ({ dispatch, commit }, reaction ) {
		const path		= dataTypePath.reaction( reaction.$id );

		const agent_info	= await dispatch("getAgent");
		const author_is_me	= common.hashesAreEqual( reaction.author, agent_info.pubkey.initial );

		commit("cacheEntity", [ path, reaction ] );

		if ( author_is_me ) {
		    const agent_path	= dataTypePath.agentReactions( "me" );

		    for ( let [id, _] of reaction.subject_ids ) {
			commit("cacheValueInsert", [ agent_path, id, reaction ] );
		    }

		    commit("metadata", [ path, {
			"writable": true,
		    }] );
		}

		commit("recordLoaded", path );
	    },
	    async cacheReactionSummary ({ dispatch, commit }, reaction_summary ) {
		const path		= dataTypePath.reactionSummary( reaction_summary.$id );

		commit("cacheEntity", [ path, reaction_summary ] );
		commit("recordLoaded", path );

		let agent_info		= await dispatch("getAgent");

		commit("metadata", [ path, {
		    "writable": false,
		}] );
	    },

	    // Create
	    async createEntity ({ dispatch, commit }, [ path_fn, dna, zome, func, args, timeout ]) {
		const entity		= await dispatch("callClient", [ dna, zome, func, args, timeout ]);
		log.debug("Created Entity with ID: %s", String(entity.$id) );
		const path		= path_fn( entity.$id );

		commit("cacheEntity", [ path, entity ] );
		commit("metadata", [ path, { "writable": true }] );

		return entity;
	    },
	    // Update
	    async updateEntity ({ dispatch, commit }, [ path, dna, zome, func, args, timeout ]) {
		commit("metadata", [ path, { "updating": true }] );

		try {
		    // log.normal("Updating Zome (%s)", String(entity.$addr) );
		    const entity	= await dispatch("callClient", [ dna, zome, func, args, timeout ]);

		    commit("cacheEntity", [ path, entity ] );

		    return entity;
		} finally {
		    commit("metadata", [ path, { "updating": false }] );
		}
	    },
	    // Unpublish
	    async unpublishEntity ({ dispatch, commit }, [ path, dna, zome, func, args, timeout ]) {
		commit("metadata", [ path, { "unpublishing": true }] );

		try {
		    // log.normal("Deleting Zome Version (%s)", String(id) );
		    await dispatch("callClient", [ dna, zome, func, args, timeout ]);

		    commit("expireData", path );
		} finally {
		    commit("metadata", [ path, { "unpublishing": false }] );
		}
	    },
	    // Unpublish
	    async deprecateEntity ({ dispatch, commit }, [ path, dna, zome, func, args, timeout ]) {
		commit("metadata", [ path, { "deprecating": true }] );

		try {
		    // log.normal("Deprecating DNA (%s) because: %s", String(entity.$addr), message );
		    const entity	= await dispatch("callClient", [ dna, zome, func, args, timeout ]);

		    commit("cacheEntity", [ path, entity ] );

		    return entity;
		} finally {
		    commit("metadata", [ path, { "deprecating": false }] );
		}
	    },

	    //
	    // Agent
	    //
	    async getAgent ({ getters, dispatch }) {
		if ( getters.agent )
		    return getters.agent;
		else
		    return await dispatch("fetchAgent");
	    },

	    async fetchAgent ({ dispatch, commit }) {
		const path		= "me";

		commit("signalLoading", path );

		log.debug("Getting agent info (whoami)");
		const info		= await dispatch("callClient", [
		    "dnarepo", "dna_library", "whoami"
		]);

		const resp		= {
		    "pubkey": {
			"initial": new AgentPubKey( info.agent_initial_pubkey ),
			"current": new AgentPubKey( info.agent_latest_pubkey ),
		    },
		};

		commit("cacheEntity", [ path, resp ] );
		commit("recordLoaded", path );

		return resp;
	    },

	    async fetchZomes ({ dispatch }, { agent } ) {
		const path		= dataTypePath.zomes( agent );
		const args		= [ "dnarepo", "dna_library" ];

		if ( agent === "me" )
		    args.push( "get_my_zomes" );
		else
		    args.push( "get_zomes", { agent } );

		const zomes		= await dispatch("fetchCollection", [
		    path, ...args
		]);

		return zomes;
	    },

	    async fetchZomesByName ({ dispatch }, name ) {
		const path		= dataTypePath.zomesByName( name );
		const zomes		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_zomes_by_filter", {
			"filter": "name",
			"keyword": name.toLowerCase(),
		    },
		]);

		for ( let zome of zomes )
		    await dispatch("cacheZome", zome );

		return zomes;
	    },

	    async fetchDnas ({ dispatch }, { agent } ) {
		const path		= dataTypePath.dnas( agent );
		const args		= [ "dnarepo", "dna_library" ];

		if ( agent === "me" )
		    args.push( "get_my_dnas" );
		else
		    args.push( "get_dnas", { agent } );

		const dnas		= await dispatch("fetchCollection", [
		    path, ...args
		]);

		return dnas;
	    },

	    async fetchDnasByName ({ dispatch }, name ) {
		const path		= dataTypePath.dnasByName( name );
		const dnas		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_dnas_by_filter", {
			"filter": "name",
			"keyword": name.toLowerCase(),
		    },
		]);

		for ( let dna of dnas )
		    await dispatch("cacheDna", dna );

		return dnas;
	    },

	    async fetchHapps ({ dispatch }, { agent } ) {
		const path		= dataTypePath.happs( agent );
		const args		= [ "happs", "happ_library" ];

		if ( agent === "me" )
		    args.push( "get_my_happs" );
		else
		    args.push( "get_happs", { agent } );

		const happs		= await dispatch("fetchCollection", [
		    path, ...args
		]);

		for ( let happ of happs )
		    await dispatch("cacheHapp", happ );

		return happs;
	    },

	    async fetchMyReviews ({ dispatch }) {
		const path		= dataTypePath.agentReviews( "me" );
		const reviews		= await dispatch("fetchCollection", [
		    path, "dnarepo", "reviews", "get_my_reviews",
		]);

		for ( let review of reviews )
		    await dispatch("cacheReview", review );

		return reviews;
	    },

	    async fetchMyReactions ({ dispatch }) {
		const path		= dataTypePath.agentReactions( "me" );
		const reactions		= await dispatch("fetchCollection", [
		    path, "dnarepo", "reviews", "get_my_reactions",
		]);

		for ( let reaction of reactions )
		    await dispatch("cacheReaction", reaction );

		return reactions;
	    },


	    //
	    // Zome
	    //
	    async getZome ({ dispatch, getters }, id ) {
		if ( getters.zome( id ) )
		    return getters.zome( id );
		else
		    return await dispatch("fetchZome", id );
	    },

	    async fetchZome ({ dispatch }, id ) {
		const path		= dataTypePath.zome( id );
		const zome		= await dispatch("fetchEntity", [
		    path, "dnarepo", "dna_library", "get_zome", { id }
		]);

		await dispatch("cacheZome", zome );

		return zome;
	    },

	    async fetchVersionsForZome ({ dispatch }, zome_id ) {
		const path		= dataTypePath.zomeVersions( zome_id );
		const versions		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_zome_versions", { "for_zome": zome_id }
		]);

		for ( let version of versions )
		    await dispatch("cacheZomeVersion", version );

		return versions;
	    },

	    async getLatestVersionForZome ({ dispatch, getters }, [ zome_id, hdk_version ] ) {
		const path		= dataTypePath.zomeVersions( zome_id );

		if ( getters.zome_versions( zome_id ).length === 0 )
		    await dispatch("fetchVersionsForZome", zome_id );

		const versions		= getters.zome_versions( zome_id );

		return versions.reduce( (acc, version, i) => {
		    if ( hdk_version && hdk_version !== version.hdk_version )
			return acc;

		    if ( acc === null )
			return version;

		    if ( version.version > acc.version )
			return version;

		    return acc;
		}, null );
	    },

	    async createZome ({ dispatch }, input ) {
		log.normal("Creating Zome: %s", input.name );
		return await dispatch("createEntity", [
		    dataTypePath.zome, "dnarepo", "dna_library", "create_zome", input
		]);
	    },

	    async updateZome ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.zome( id );
		const path		= dataTypePath.zome( id );

		log.normal("Updating Zome (%s)", String(entity.$addr) );
		return await dispatch("updateEntity", [
		    path, "dnarepo", "dna_library", "update_zome", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);
	    },

	    async deprecateZome ({ dispatch, getters }, [ id, { message } ] ) {
		const entity		= getters.zome( id );
		const path		= dataTypePath.zome( id );

		log.normal("Deprecating Zome (%s) because: %s", String(entity.$addr), message );
		return await dispatch("deprecateEntity", [
		    path, "dnarepo", "dna_library", "deprecate_zome", {
			"addr": entity.$action,
			"message": message,
		    }
		]);
	    },

	    async fetchAllZomes ({ dispatch }) {
		const path		= dataTypePath.zomes( "all" );
		const zomes		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_all_zomes"
		]);

		for ( let zome of zomes )
		    await dispatch("cacheZome", zome );

		return zomes;
	    },

	    async fetchZomesWithHDKVersion ({ dispatch }, hdk_version ) {
		const path		= dataTypePath.zomes( hdk_version );
		const zomes		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_zomes_with_an_hdk_version", hdk_version
		]);

		for ( let zome of zomes )
		    await dispatch("cacheZome", zome );

		return zomes;
	    },


	    //
	    // Zome Version
	    //
	    async getZomeVersion ({ dispatch, getters }, id ) {
		if ( getters.zome_version( id ) )
		    return getters.zome_version( id );
		else
		    return await dispatch("fetchZomeVersion", id );
	    },

	    async fetchZomeVersion ({ dispatch }, id ) {
		const path		= dataTypePath.zomeVersion( id );
		const version		= await dispatch("fetchEntity", [
		    path, "dnarepo", "dna_library", "get_zome_version", { id }
		]);

		await dispatch("cacheZomeVersion", version );

		return version;
	    },

	    async fetchZomeVersionsByHash ({ dispatch }, hash ) {
		const path		= dataTypePath.zomeVersionsByHash( hash );
		const versions		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_zome_versions_by_filter", {
			"filter": "uniqueness_hash",
			"keyword": hash,
		    },
		]);

		for ( let version of versions )
		    await dispatch("cacheZomeVersion", version );

		return versions;
	    },

	    async fetchZomeVersionWasm ({ dispatch, commit }, addr ) {
		const path		= dataTypePath.zomeVersionWasm( addr );

		commit("signalLoading", path );

		log.debug("Getting agent info (whoami)");
		const result		= await dispatch("callClient", [
		    "dnarepo", "mere_memory", "retrieve_bytes", addr
		]);
		const wasm_bytes	= new Uint8Array( result );

		commit("cacheEntity", [ path, wasm_bytes ] );
		commit("recordLoaded", path );

		return wasm_bytes;
	    },

	    async createZomeVersion ({ dispatch }, [ zome_id, input ] ) {
		input.for_zome		= zome_id;

		log.normal("Creating Zome Version: #%s", input.version );
		return await dispatch("createEntity", [
		    dataTypePath.zomeVersion, "dnarepo", "dna_library", "create_zome_version", input
		]);
	    },

	    async updateZomeVersion ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.zome_version( id );
		const path		= dataTypePath.zomeVersion( id );

		log.normal("Updating Zome Version (%s)", String(entity.$addr) );
		return await dispatch("updateEntity", [
		    path, "dnarepo", "dna_library", "update_zome_version", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);
	    },

	    async updateZomeVersionReviewSummary ({ dispatch, getters }, id ) {
		const entity		= getters.zome_version( id );
		const path		= dataTypePath.zomeVersion( id );

		const reviews		= await dispatch("fetchReviewsForBase", id );
		for ( let review of reviews ) {
		    try {
			await dispatch("updateReviewReactionSummary", review.$id );
		    }
		    catch (err) {
			if ( err.message.includes("Not updating") || err.message.includes("summary is not better") )
			    console.error("Error is ok...");
			else
			    console.error( err );
		    }
		}

		if ( entity.review_summary ) {
		    const summary		= await dispatch("getReviewSummary", entity.review_summary );

		    // If the review summary report has been updated in the last 24 hours, then do nothing.
		    if ( summary.last_updated > common.pastTime( 24 ) )
			throw new Error(`Not updating review summary for zome version (${id}) because it was updated within the last 24 hours: ${$filters.time(summary.last_updated)}`);
		    else {
			await dispatch("updateReviewSummary", entity.review_summary );
		    }

		    return entity;
		}
		else {
		    log.normal("Updating Zome Version Review Summary (%s)", String(entity.$addr) );
		    const zome_version = await dispatch("updateEntity", [
			path, "dnarepo", "dna_library", "create_zome_version_review_summary", {
			    "subject_action": entity.$action,
			    "addr": entity.$action,
			}
		    ]);

		    await dispatch("cacheZomeVersion", zome_version );

		    return zome_version;
		}
	    },

	    async unpublishZomeVersion ({ dispatch }, id ) {
		const path		= dataTypePath.zomeVersion( id );

		log.normal("Deleting Zome Version (%s)", String(id) );
		return await dispatch("unpublishEntity", [
		    path, "dnarepo", "dna_library", "delete_zome_version", { id }
		]);
	    },


	    //
	    // DNA
	    //
	    async getDna ({ dispatch, getters }, id ) {
		if ( getters.dna( id ) )
		    return getters.dna( id );
		else
		    return await dispatch("fetchDna", id );
	    },

	    async fetchDna ({ dispatch }, id ) {
		const path		= dataTypePath.dna( id );
		const dna		= await dispatch("fetchEntity", [
		    path, "dnarepo", "dna_library", "get_dna", { id }
		]);

		await dispatch("cacheDna", dna );

		return dna;
	    },

	    async fetchVersionsForDna ({ dispatch }, dna_id ) {
		const path		= dataTypePath.dnaVersions( dna_id );
		const versions		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_dna_versions", { "for_dna": dna_id }
		]);

		for ( let version of versions )
		    await dispatch("cacheDnaVersion", version );

		return versions;
	    },

	    async getLatestVersionForDna ({ dispatch, getters }, [ dna_id, hdk_version ] ) {
		const path		= dataTypePath.dnaVersions( dna_id );

		if ( getters.dna_versions( dna_id ).length === 0 )
		    await dispatch("fetchVersionsForDna", dna_id );

		const versions		= getters.dna_versions( dna_id );

		return versions.reduce( (acc, version, i) => {
		    if ( hdk_version && hdk_version !== version.hdk_version )
			return acc;

		    if ( acc === null )
			return version;

		    if ( version.version > acc.version )
			return version;

		    return acc;
		}, null );
	    },

	    async createDna ({ dispatch }, input ) {
		log.normal("Creating DNA: %s", input.name );
		return await dispatch("createEntity", [
		    dataTypePath.dna, "dnarepo", "dna_library", "create_dna", input
		]);
	    },

	    async updateDna ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.dna( id );
		const path		= dataTypePath.dna( id );

		log.normal("Updating DNA (%s)", String(entity.$addr) );
		return await dispatch("updateEntity", [
		    path, "dnarepo", "dna_library", "update_dna", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);
	    },

	    async deprecateDna ({ dispatch, getters }, [ id, { message } ] ) {
		const entity		= getters.dna( id );
		const path		= dataTypePath.dna( id );

		log.normal("Deprecating DNA (%s) because: %s", String(entity.$addr), message );
		return await dispatch("deprecateEntity", [
		    path, "dnarepo", "dna_library", "deprecate_dna", {
			"addr": entity.$action,
			"message": message,
		    }
		]);
	    },

	    async fetchAllDnas ({ dispatch }) {
		const path		= dataTypePath.dnas( "all" );
		const dnas		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_all_dnas"
		]);

		for ( let dna of dnas )
		    await dispatch("cacheDna", dna );

		return dnas;
	    },

	    async fetchDnasWithHDKVersion ({ dispatch }, hdk_version ) {
		const path		= dataTypePath.dnas( hdk_version );
		const dnas		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_dnas_with_an_hdk_version", hdk_version
		]);

		for ( let dna of dnas )
		    await dispatch("cacheDna", dna );

		return dnas;
	    },


	    //
	    // DNA Version
	    //
	    async getDnaVersion ({ dispatch, getters }, id ) {
		if ( getters.dna_version( id ) )
		    return getters.dna_version( id );
		else
		    return await dispatch("fetchDnaVersion", id );
	    },

	    async fetchDnaVersion ({ dispatch }, id ) {
		const path		= dataTypePath.dnaVersion( id );

		const version		= await dispatch("fetchEntity", [
		    path, "dnarepo", "dna_library", "get_dna_version", { id }
		]);

		await dispatch("cacheDnaVersion", version );

		return version;
	    },

	    async fetchDnaVersionsByHash ({ dispatch }, hash ) {
		const path		= dataTypePath.dnaVersionsByHash( hash );
		const versions		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_dna_versions_by_filter", {
			"filter": "uniqueness_hash",
			"keyword": hash,
		    },
		]);

		for ( let version of versions )
		    await dispatch("cacheDnaVersion", version );

		return versions;
	    },

	    async fetchDnaVersionPackage ({ dispatch, commit }, id ) {
		const path		= dataTypePath.dnaVersionPackage( id );

		commit("signalLoading", path );

		log.debug("Getting DNA package %s", String(id) );
		const pack		= await dispatch("callClient", [
		    "dnarepo", "dna_library", "get_dna_package", { id }
		]);

		pack.bytes		= new Uint8Array( pack.bytes );

		commit("cacheEntity", [ path, pack ] );
		commit("recordLoaded", path );

		return pack;
	    },

	    async createDnaVersion ({ dispatch }, [ dna_id, input ] ) {
		input.for_dna		= dna_id;

		log.normal("Creating DNA Version: #%s", input.version );
		return await dispatch("createEntity", [
		    dataTypePath.dnaVersion, "dnarepo", "dna_library", "create_dna_version", input
		]);
	    },

	    async updateDnaVersion ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.dna_version( id );
		const path		= dataTypePath.dnaVersion( id );

		log.normal("Updating DNA Version (%s)", String(entity.$addr) );
		return await dispatch("updateEntity", [
		    path, "dnarepo", "dna_library", "update_dna_version", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);
	    },

	    async unpublishDnaVersion ({ dispatch }, id ) {
		const path		= dataTypePath.dnaVersion( id );

		log.normal("Deleting DNA Version (%s)", String(id) );
		return await dispatch("unpublishEntity", [
		    path, "dnarepo", "dna_library", "delete_dna_version", { id }
		]);
	    },


	    //
	    // Happ
	    //
	    async getHapp ({ dispatch, getters }, id ) {
		if ( getters.happ( id ) )
		    return getters.happ( id );
		else
		    return await dispatch("fetchHapp", id );
	    },

	    async fetchHapp ({ dispatch }, id ) {
		const path		= dataTypePath.happ( id );

		log.debug("Getting happ %s", String(id) );
		const happ		= await dispatch("fetchEntity", [
		    path, "happs", "happ_library", "get_happ", { id }
		]);

		await dispatch("cacheHapp", happ );

		return happ;
	    },

	    async fetchReleasesForHapp ({ dispatch }, happ_id ) {
		const path		= dataTypePath.happReleases( happ_id );
		const releases		= await dispatch("fetchCollection", [
		    path, "happs", "happ_library", "get_happ_releases", { "for_happ": happ_id }
		]);

		for ( let release of releases )
		    await dispatch("cacheHappRelease", release );

		return releases;
	    },

	    async getLatestReleaseForHapp ({ dispatch, getters }, [ happ_id, hdk_version ] ) {
		const path		= dataTypePath.happReleases( happ_id );

		if ( getters.happ_releases( happ_id ).length === 0 )
		    await dispatch("fetchReleasesForHapp", happ_id );

		const releases		= getters.happ_releases( happ_id );

		return releases.reduce( (acc, release, i) => {
		    if ( hdk_version ) {
			if ( hdk_version !== release.hdk_version )
			    return acc;
		    }

		    if ( acc === null )
			return release;

		    if ( release.published_at > acc.published_at )
			return release;

		    return acc;
		}, null );
	    },

	    async createHapp ({ dispatch }, input ) {
		log.normal("Creating Happ: %s", input.title );
		return await dispatch("createEntity", [
		    dataTypePath.happ, "happs", "happ_library", "create_happ", input
		]);
	    },

	    async updateHapp ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.happ( id );
		const path		= dataTypePath.happ( id );

		log.normal("Updating Happ (%s)", String(entity.$addr) );
		return await dispatch("updateEntity", [
		    path, "happs", "happ_library", "update_happ", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);
	    },

	    async deprecateHapp ({ dispatch, getters }, [ id, { message } ] ) {
		const entity		= getters.happ( id );
		const path		= dataTypePath.happ( id );

		log.normal("Deprecating Happ (%s) because: %s", String(entity.$addr), message );
		return await dispatch("deprecateEntity", [
		    path, "happs", "happ_library", "deprecate_happ", {
			"addr": entity.$action,
			"message": message,
		    }
		]);
	    },

	    async fetchAllHapps ({ dispatch }) {
		const path		= dataTypePath.happs( "all" );
		const happs		= await dispatch("fetchCollection", [
		    path, "happs", "happ_library", "get_all_happs"
		]);

		for ( let happ of happs )
		    await dispatch("cacheHapp", happ );

		return happs;
	    },


	    //
	    // Happ Release
	    //
	    async getHappRelease ({ dispatch, getters }, id ) {
		if ( getters.happRelease( id ) )
		    return getters.happRelease( id );
		else
		    return await dispatch("fetchHappRelease", id );
	    },

	    async fetchHappRelease ({ dispatch }, id ) {
		const path		= dataTypePath.happRelease( id );

		log.debug("Getting happ release %s", String(id) );
		const release		= await dispatch("fetchEntity", [
		    path, "happs", "happ_library", "get_happ_release", { id }
		]);

		await dispatch("cacheHappRelease", release );

		return release;
	    },

	    async fetchHappReleasePackage ({ dispatch, commit }, id ) {
		const path		= dataTypePath.happReleasePackage( id );

		commit("signalLoading", path );

		log.debug("Getting hApp package %s", String(id) );
		const result		= await dispatch("callClient", [
		    "happs", "happ_library", "get_release_package", { id }, 300_000
		]);

		const wasm_bytes	= new Uint8Array( result );

		commit("cacheEntity", [ path, wasm_bytes ] );
		commit("recordLoaded", path );

		return wasm_bytes;
	    },

	    async fetchWebhappReleasePackage ({ dispatch, commit }, { name, id } ) {
		const path		= dataTypePath.happReleasePackage( id + "-webhapp" );

		commit("signalLoading", path );

		log.debug("Getting hApp package %s", String(id) );
		const result			= await dispatch("callClient", [
		    "happs", "happ_library", "get_webhapp_package", { name, id }, 300_000
		]);

		const wasm_bytes	= new Uint8Array( result );

		commit("cacheEntity", [ path, wasm_bytes ] );
		commit("recordLoaded", path );

		return wasm_bytes;
	    },

	    async createHappRelease ({ dispatch }, [ happ_id, input ] ) {
		input.for_happ		= happ_id;

		log.normal("Creating hApp Release for hApp (%s): %s", String(happ_id), input.name );
		return await dispatch("createEntity", [
		    dataTypePath.happRelease, "happs", "happ_library", "create_happ_release", input
		]);
	    },

	    async updateHappRelease ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.happ_release( id );
		const path		= dataTypePath.happRelease( id );

		log.normal("Updating Happ Release (%s)", String(entity.$addr) );
		return await dispatch("updateEntity", [
		    path, "happs", "happ_library", "update_happ_release", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);
	    },

	    async unpublishHappRelease ({ dispatch }, id ) {
		const path		= dataTypePath.happRelease( id );

		log.normal("Deleting Happ Release (%s)", String(id) );
		return await dispatch("unpublishEntity", [
		    path, "happs", "happ_library", "delete_happ_release", { id }
		]);
	    },


	    //
	    // Miscellaneous
	    //
	    async fetchHDKVersions ({ dispatch }) {
		const path		= dataTypePath.hdkVersions();

		log.debug("Getting previous HDK versions");
		const hdkvs		= await dispatch("fetchCollection", [
		    path, "dnarepo", "dna_library", "get_hdk_versions"
		]);

		return hdkvs;
	    },

	    async createWebAsset ({ dispatch }, bytes ) {
		log.normal("Creating Web Asset: %s bytes", bytes.length );
		return await dispatch("createEntity", [
		    dataTypePath.webAsset, "webassets", "web_assets", "create_file", {
			"file_bytes": bytes,
		    }
		]);
	    },

	    async saveFile ({ commit }, bytes ) {
		const digest		= common.digest( bytes );
		const hash		= common.toHex( digest );
		const path		= dataTypePath.file( hash );
		const file		= {
		    bytes,
		    digest,
		    hash,
		};

		commit("cacheValue", [ path, file ] );

		return file;
	    },

	    async uploadFile ({ dispatch, commit }, [ id, file ] ) {
		const path		= dataTypePath.file( id );

		commit("signalLoading", path );

		const bytes		= await common.load_file( file );

		try {
		    const file_info	= await dispatch("saveFile", bytes );

		    commit("cacheValue", [ path, file_info ] );

		    return file_info;
		} finally {
		    commit("recordLoaded", path );
		}
	    },

	    async unpackBundle ({ dispatch, commit, getters }, hash ) {
		// Bundle types
		//
		//   - DNA Bundle		Identified by the "zomes" list in the manifest
		//   - hApp Bundle		Identified by the "roles" list in the manifest
		//   - Web hApp Bundle		Identified by the "ui" and/or "happ_manifest" in the manifest
		//
		// Steps
		//
		//   - Unzip
		//   - Decode
		//   - Determine bundle type
		//   - Set promise(s) for unpacking child bundles
		//   - Calculate path
		//   - Return details including path and child bundle promises
		//
		let file;
		if ( typeof hash !== "string" ) {
		    if ( !(hash instanceof Uint8Array) )
			throw new TypeError(`store action 'unpackBundle' expects a hash or Uint8Array; not typeof '${typeof hash}'`);
		    file		= await dispatch("saveFile", hash );
		}
		else {
		    file		= getters.file( hash );
		}

		if ( getters.bundle( file.hash ) )
		    return getters.bundle( file.hash );

		const path		= dataTypePath.bundle( file.hash );

		commit("signalLoading", path );

		await common.delay();

		log.info("Unpacking bundle with %s bytes", file.bytes.length );
		const msgpack_bytes	= gzip.unzip( file.bytes );
		log.debug("Unzipped bundle has %s bytes", msgpack_bytes.length );

		const bundle		= MessagePack.decode( msgpack_bytes );

		for ( let prop of ["manifest", "resources"] )
		    if( !(bundle[prop] instanceof Object) )
			throw new TypeError(`The bundle format is expected to have a '${prop}' property.  Type of '${typeof bundle[prop]}' found`);

		const manifest		= bundle.manifest;
		const resources		= bundle.resources;

		// Copy the original manifest values
		manifest.manifest	= JSON.parse( JSON.stringify( bundle.manifest ) );

		log.debug("Decoded manifest has keys: %s", () => [ Object.keys(manifest).join(", ") ]);
		const resource_keys	= Object.keys( resources );

		log.trace("Bundle has %s resources: %s", resource_keys.length, resource_keys.join(", ") );
		for ( let key of resource_keys ) {
		    resources[ key ]	= new Uint8Array( resources[ key ] );
		}

		if ( manifest.integrity && manifest.coordinator ) {
		    log.trace("Detected a DNA bundle");
		    manifest.type	= "dna";

		    manifest.integrity.zomes.forEach( zome => {
			log.trace("Preparing resource Promises for zome: %s", zome.bundled );

			zome.bytes	= resources[ zome.bundled ];
			zome.digest	= common.digest( zome.bytes );
			zome.hash	= common.toHex( zome.digest );

			delete zome.bundled;
		    });

		    manifest.zome_digests	= manifest.integrity.zomes.map( zome => zome.digest );

		    const hashes	= manifest.zome_digests.slice();
		    hashes.sort( common.array_compare );
		    manifest.dna_digest	= common.digest( ...hashes );
		    manifest.dna_hash	= common.toHex( manifest.dna_digest );

		    manifest.coordinator.zomes.forEach( zome => {
			log.trace("Preparing resource Promises for zome: %s", zome.bundled );

			zome.bytes	= resources[ zome.bundled ];
			zome.digest	= common.digest( zome.bytes );
			zome.hash	= common.toHex( zome.digest );

			delete zome.bundled;
		    });
		}
		else if ( manifest.roles ) {
		    log.trace("Detected a hApp bundle");
		    manifest.type	= "happ";

		    manifest.roles.forEach( role => {
			const dna		= role.dna;
			log.trace("Preparing Promises for role: %s", dna.bundled );
			const bytes		= resources[ dna.bundled ];

			dna.source	= common.once( () => dispatch("saveFile", bytes ) );
			dna.manifest	= common.once( async () => dispatch("unpackBundle", (await dna.source()).hash ) );

			delete dna.bundled;
		    });

		    manifest.dna_digests	= common.once( async () => {
			return await Promise.all(
			    manifest.roles.map( async role => {
				const bundle	= await role.dna.manifest();
				return bundle.dna_digest;
			    })
			);
		    });
		    manifest.happ_digest	= common.once( async () => {
			const hashes		= await manifest.dna_digests();
			hashes.sort( common.array_compare );
			return common.digest( ...hashes );
		    });
		    manifest.happ_hash	= common.once( async () => {
			return common.toHex( await manifest.happ_digest() );
		    });
		}
		else if ( manifest.ui && manifest.happ_manifest ) {
		    log.trace("Detected a Web hApp bundle");
		    manifest.type	= "webhapp";

		    const ui			= resources[ manifest.ui.bundled ];
		    const bytes			= resources[ manifest.happ_manifest.bundled ];

		    manifest.ui			= {
			"name":		manifest.ui.bundled,
			"source":	common.once( () => dispatch("saveFile", ui ) ),
		    };
		    manifest.happ		= {
			"source":	common.once( () => dispatch("saveFile", bytes ) ),
			"bundle":	common.once( async () => dispatch("unpackBundle", (await manifest.happ.source()).hash ) ),
		    };
		    delete manifest.happ_manifest;
		}

		commit("cacheValue", [ path, manifest ] );
		commit("recordLoaded", path );

		return manifest;
	    },

	    async getUrlPreview ({ dispatch, commit }, url ) {
		const path		= dataTypePath.url( url );

		commit("signalLoading", path );

		try {
		    const url_info	= await common.http_info( url );

		    commit("cacheValue", [ path, url_info ] );

		    return url_info;
		} finally {
		    commit("recordLoaded", path );
		}
	    },


	    //
	    // Reviews
	    //
	    async getReview ({ dispatch, getters }, id ) {
		if ( getters.review( id ) )
		    return getters.review( id );
		else
		    return await dispatch("fetchReview", id );
	    },

	    async fetchReview ({ dispatch }, id ) {
		const path		= dataTypePath.review( id );
		const review		= await dispatch("fetchEntity", [
		    path, "dnarepo", "reviews", "get_review", { id }
		]);

		await dispatch("cacheReview", review );

		return review;
	    },

	    async fetchReviewsForBase ({ dispatch }, base_hash ) {
		const path		= dataTypePath.reviews( base_hash );
		const reviews		= await dispatch("fetchCollection", [
		    path, "dnarepo", "reviews", "get_reviews_for_subject", { "id": base_hash }
		]);

		for ( let review of reviews )
		    await dispatch("cacheReview", review );

		return reviews;
	    },

	    async createReview ({ dispatch }, input ) {
		log.normal("Creating Review: %s", input.subject_id );
		return await dispatch("createEntity", [
		    dataTypePath.review, "dnarepo", "reviews", "create_review", input
		]);
	    },

	    async updateReview ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.review( id );
		const path		= dataTypePath.review( id );

		log.normal("Updating Review (%s)", String(entity.$addr) );
		return await dispatch("updateEntity", [
		    path, "dnarepo", "reviews", "update_review", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);
	    },

	    async updateReviewReactionSummary ({ dispatch, getters }, id ) {
		const entity		= getters.review( id );
		const path		= dataTypePath.review( id );

		if ( entity.reaction_summary ) {
		    const summary		= await dispatch("getReactionSummary", entity.reaction_summary );

		    // If the reaction summary report has been updated in the last 24 hours, then do nothing.
		    if ( summary.last_updated > common.pastTime( 24 ) )
			throw new Error(`Not updating reaction summary for zome version (${id}) because it was updated within the last 24 hours: ${$filters.time(summary.last_updated)}`);
		    else
			await dispatch("updateReactionSummary", entity.reaction_summary );

		    return entity;
		}
		else {
		    log.normal("Updating Review Reaction Summary (%s)", String(entity.$addr) );
		    return await dispatch("updateEntity", [
			path, "dnarepo", "reviews", "create_review_reaction_summary", {
			    "subject_action": entity.$action,
			    "addr": entity.$action,
			}
		    ]);
		}
	    },

	    async unpublishReview ({ dispatch }, id ) {
		const path		= dataTypePath.review( id );

		log.normal("Deleting Review (%s)", String(id) );
		return await dispatch("unpublishEntity", [
		    path, "dnarepo", "reviews", "delete_review", { id }
		]);
	    },


	    //
	    // Review Summaries
	    //
	    async getReviewSummary ({ dispatch, getters }, id ) {
		if ( getters.review_summary( id ) )
		    return getters.review_summary( id );
		else
		    return await dispatch("fetchReviewSummary", id );
	    },

	    async fetchReviewSummary ({ dispatch }, id ) {
		const path		= dataTypePath.reviewSummary( id );
		const summary		= await dispatch("fetchEntity", [
		    path, "dnarepo", "reviews", "get_review_summary", { id }
		]);

		await dispatch("cacheReviewSummary", summary );

		return summary;
	    },

	    async fetchReviewSummariesForBase ({ dispatch }, base_hash ) {
		const path		= dataTypePath.reviewSummaries( base_hash );
		const summaries		= await dispatch("fetchCollection", [
		    path, "dnarepo", "reviews", "get_review_summaries_for_subject", { "id": base_hash }
		]);

		for ( let summary of summaries )
		    await dispatch("cacheReviewSummary", summary );

		return summaries;
	    },

	    async updateReviewSummary ({ dispatch, getters }, id ) {
		const entity		= getters.review_summary( id );
		const path		= dataTypePath.reviewSummary( id );

		log.normal("Updating Review Summary (%s)", id );
		return await dispatch("updateEntity", [
		    path, "dnarepo", "reviews", "update_review_summary", { id }
		]);
	    },

	    // async getBestReviewSummaryForBase ({ dispatch, getters }, base_hash ) {
	    // 	const path		= dataTypePath.reviewSummaries( base_hash );

	    // 	if ( getters.review_summaries( base_hash ).length === 0 )
	    // 	    await dispatch("fetchReviewSummariesForBase", base_hash );

	    // 	const summaries		= getters.review_summaries( base_hash );

	    // 	return summaries.reduce( (acc, summary, i) => {
	    // 	    if ( acc === null )
	    // 		return summary;

	    // 	    if ( summary.factored_action_count > acc.factored_action_count )
	    // 		return summary;

	    // 	    return acc;
	    // 	}, null );
	    // },


	    //
	    // Reactions
	    //
	    async getReaction ({ dispatch, getters }, id ) {
		if ( getters.reaction( id ) )
		    return getters.reaction( id );
		else
		    return await dispatch("fetchReaction", id );
	    },

	    async fetchReaction ({ dispatch }, id ) {
		const path		= dataTypePath.reaction( id );
		const reaction		= await dispatch("fetchEntity", [
		    path, "dnarepo", "reviews", "get_reaction", { id }
		]);

		await dispatch("cacheReaction", reaction );

		return reaction;
	    },

	    async fetchReactionsForBase ({ dispatch }, base_hash ) {
		const path		= dataTypePath.reactions( base_hash );
		const reactions		= await dispatch("fetchCollection", [
		    path, "dnarepo", "reviews", "get_reactions_for_subject", { "id": base_hash }
		]);

		for ( let reaction of reactions )
		    await dispatch("cacheReaction", reaction );

		return reactions;
	    },

	    async createReaction ({ dispatch, getters }, [ subject, reaction_type ] ) {
		log.normal("Creating Reaction: %s", reaction_type );

		const reaction		= await dispatch("createEntity", [
		    dataTypePath.reaction, "dnarepo", "reviews", "create_reaction", {
			"subject_ids": [
			    [ subject.$id, subject.$action ],
			],
			"reaction_type": reaction_type,
		    },
		]);

		await dispatch("cacheReaction", reaction );

		return reaction;
	    },

	    async updateReaction ({ dispatch, getters }, [ id, input ] ) {
		const entity		= getters.reaction( id );
		const path		= dataTypePath.reaction( id );

		log.normal("Updating Reaction (%s)", entity.$addr );
		const reaction		= await dispatch("updateEntity", [
		    path, "dnarepo", "reviews", "update_reaction", {
			"addr": entity.$action,
			"properties": input,
		    }
		]);

		await dispatch("cacheReaction", reaction );

		return reaction;
	    },

	    async deleteReaction ({ dispatch, getters }, id ) {
		const entity		= getters.reaction( id );
		const path		= dataTypePath.reaction( id );

		log.normal("Deleting Reaction (%s)", id );
		const reaction		= await dispatch("updateEntity", [
		    path, "dnarepo", "reviews", "delete_reaction", {
			"addr": entity.$action,
		    }
		]);

		await dispatch("cacheReaction", reaction );

		return reaction;
	    },


	    //
	    // Reaction Summaries
	    //
	    async getReactionSummary ({ dispatch, getters }, id ) {
		if ( getters.reaction_summary( id ) )
		    return getters.reaction_summary( id );
		else
		    return await dispatch("fetchReactionSummary", id );
	    },

	    async fetchReactionSummary ({ dispatch }, id ) {
		const path		= dataTypePath.reactionSummary( id );
		const reaction		= await dispatch("fetchEntity", [
		    path, "dnarepo", "reviews", "get_reaction_summary", { id }
		]);

		await dispatch("cacheReactionSummary", reaction );

		return reaction;
	    },

	    async fetchReactionSummariesForBase ({ dispatch }, base_hash ) {
		const path		= dataTypePath.reactionSummaries( base_hash );
		const summaries		= await dispatch("fetchCollection", [
		    path, "dnarepo", "reviews", "get_reaction_summaries_for_subject", { "id": base_hash }
		]);

		for ( let summary of summaries )
		    await dispatch("cacheReactionSummary", summary );

		return summaries;
	    },

	    async updateReactionSummary ({ dispatch, getters }, id ) {
		const entity		= getters.reaction_summary( id );
		const path		= dataTypePath.reactionSummary( id );

		log.normal("Updating Reaction Summary (%s)", id );
		return await dispatch("updateEntity", [
		    path, "dnarepo", "reviews", "update_reaction_summary", { id }
		]);
	    },
	},
    });
};
