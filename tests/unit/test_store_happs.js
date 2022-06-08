const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const crypto				= require('crypto');
const { expect }			= require('chai');
const { EntryHash }			= require('@whi/holo-hash');

const { store_init }			= require('./setup.js');
const { hash_bytes }			= require('../mock_call.js');



function wrap ( getter, meta, id ) {
    if ( !id )
	id				= new EntryHash( hash_bytes() );
    return [
	id,
	() => getter( id ),
	() => meta( id )
    ];
}


function happ_action_tests () {
    let store;

    before(async () => {
	store				= await store_init();
    });

    after(async () => {
	await store.state.client.close();
    });

    let happ_id, happ_release_id;

    it("should test hApp store actions", async function () {
	{
	    const entity		= await store.dispatch("createHapp", {
		"title": "Test hApp #1",
	    });

	    const [id,get,meta]		= wrap( store.getters.happ, store.getters.$happ, entity.$id );

	    expect( meta().current	).to.be.true;
	    expect( get().title		).to.be.a("string");

	    happ_id			= id;
	}

	{
	    store.dispatch("removeEntity", [ "happ", happ_id ] );
	    const [id,get,meta]		= wrap( store.getters.happ, store.getters.$happ, happ_id );

	    expect( get()		).to.be.null;
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchHapp", id );

	    expect( get().title		).to.be.a("string");
	}

	{
	    const [base,list,meta]	= wrap( store.getters.happs, store.getters.$happs, "me" );

	    expect( list()		).to.have.length( 0 );
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchHapps", { "agent": "me" } );

	    expect( list()		).to.have.length.gt( 0 );
	}
    });

    it("should test hApp Release store actions", async function () {
	let hdk_version;
	{
	    const entity		= await store.dispatch("createHappRelease", [ happ_id, {
		"name": "v0.1.0",
	    } ] );

	    const [id,get,meta]		= wrap( store.getters.happ_release, store.getters.$happ_release, entity.$id );

	    expect( meta().current	).to.be.true;
	    expect( get().name		).to.be.a("string");

	    hdk_version			= get().hdk_version;
	    happ_release_id		= id;
	}

	await store.dispatch("createHappRelease", [ happ_id, {
	    "name": "v0.2.0",
	} ] );

	{
	    store.dispatch("removeEntity", [ "happRelease", happ_release_id ] );
	    const [id,get,meta]		= wrap( store.getters.happ_release, store.getters.$happ_release, happ_release_id );

	    expect( get()		).to.be.null;
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchHappRelease", id );

	    expect( get().name		).to.be.a("string");
	}

	{
	    const [base,list,meta]		= wrap( store.getters.happ_releases, store.getters.$happ_releases, happ_id );

	    expect( list()		).to.have.length( 0 );
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchReleasesForHapp", base );

	    expect( list()		).to.have.length.gt( 0 );
	}

	{
	    const happ_release		= await store.dispatch("getLatestReleaseForHapp", [ happ_id, null ] );

	    for ( let release of store.getters.happ_releases( happ_id ) ) {
		expect( happ_release.published_at	).to.be.gte( release.published_at );
	    }
	}

	{
	    const happ_release		= await store.dispatch("getLatestReleaseForHapp", [ happ_id, hdk_version ] );

	    expect( happ_release.$id	).to.deep.equal( happ_release_id );
	}
    });
}

function errors_tests () {
}


describe("DevHub 'happs' DNA", () => {
    describe("'happ_library' actions", happ_action_tests );
});
