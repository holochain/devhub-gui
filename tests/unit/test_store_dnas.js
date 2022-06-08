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


function dna_action_tests () {
    let store;

    before(async () => {
	store				= await store_init();
    });

    after(async () => {
	await store.state.client.close();
    });

    let zome_id, zome_version_id, dna_id, dna_version_id;

    it("should test Zome store actions", async function () {
	{
	    const entity		= await store.dispatch("createZome", {
		"name": "Test Zome #1",
		"description": "",
	    });

	    const [id,get,meta]		= wrap( store.getters.zome, store.getters.$zome, entity.$id );

	    expect( meta().current	).to.be.true;
	    expect( get().name		).to.be.a("string");

	    zome_id			= id;
	}

	{
	    store.dispatch("removeEntity", [ "zome", zome_id ] );
	    const [id,get,meta]		= wrap( store.getters.zome, store.getters.$zome, zome_id );

	    expect( get()		).to.be.null;
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchZome", id );

	    expect( get().name		).to.be.a("string");
	}

	{
	    const [base,list,meta]	= wrap( store.getters.zomes, store.getters.$zomes, "me" );

	    expect( list()		).to.have.length( 0 );
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchZomes", { "agent": "me" } );

	    expect( list()		).to.have.length.gt( 0 );
	}
    });

    it("should test Zome Version store actions", async function () {
	{
	    const entity		= await store.dispatch("createZomeVersion", [ zome_id, {} ] );

	    const [id,get,meta]		= wrap( store.getters.zome_version, store.getters.$zome_version, entity.$id );

	    expect( meta().current	).to.be.true;
	    expect( get().version	).to.be.a("number");

	    zome_version_id		= id;
	}

	await store.dispatch("createZomeVersion", [ zome_id, {} ] );

	{
	    store.dispatch("removeEntity", [ "zomeVersion", zome_version_id ] );
	    const [id,get,meta]		= wrap( store.getters.zome_version, store.getters.$zome_version, zome_version_id );

	    expect( get()		).to.be.null;
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchZomeVersion", id );

	    expect( get().version	).to.be.a("number");
	}

	{
	    const [base,list,meta]		= wrap( store.getters.zome_versions, store.getters.$zome_versions, zome_id );

	    expect( list()		).to.have.length( 0 );
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchVersionsForZome", base );

	    expect( list()		).to.have.length.gt( 0 );
	}

	{
	    const zome_version		= await store.dispatch("getLatestVersionForZome", [ zome_id, null ] );

	    for ( let version of store.getters.zome_versions( zome_id ) ) {
		expect( zome_version.version	).to.be.gte( version.version );
	    }
	}
    });

    it("should test DNA Version store actions", async function () {
	{
	    const entity		= await store.dispatch("createDna", {
		"name": "Test DNA #1",
		"description": "",
	    });

	    const [id,get,meta]		= wrap( store.getters.dna, store.getters.$dna, entity.$id );

	    expect( meta().current	).to.be.true;
	    expect( get().name		).to.be.a("string");

	    dna_id			= id;
	}

	{
	    store.dispatch("removeEntity", [ "dna", dna_id ] );
	    const [id,get,meta]		= wrap( store.getters.dna, store.getters.$dna, dna_id );

	    expect( get()		).to.be.null;
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchDna", id );

	    expect( get().name		).to.be.a("string");
	}

	{
	    const [base,list,meta]	= wrap( store.getters.dnas, store.getters.$dnas, "me" );

	    expect( list()		).to.have.length( 0 );
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchDnas", { "agent": "me" } );

	    expect( list()		).to.have.length.gt( 0 );
	}
    });

    it("should test DNA Version store actions", async function () {
	{
	    const entity		= await store.dispatch("createDnaVersion", [ dna_id, {} ] );

	    const [id,get,meta]		= wrap( store.getters.dna_version, store.getters.$dna_version, entity.$id );

	    expect( meta().current	).to.be.true;
	    expect( get().version	).to.be.a("number");

	    dna_version_id		= id;
	}

	await store.dispatch("createDnaVersion", [ dna_id, {} ] );

	{
	    store.dispatch("removeEntity", [ "dnaVersion", dna_version_id ] );
	    const [id,get,meta]		= wrap( store.getters.dna_version, store.getters.$dna_version, dna_version_id );

	    expect( get()		).to.be.null;
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchDnaVersion", id );

	    expect( get().version	).to.be.a("number");
	}

	{
	    const [base,list,meta]	= wrap( store.getters.dna_versions, store.getters.$dna_versions, dna_id );

	    expect( list()		).to.have.length( 0 );
	    expect( meta().current	).to.be.false;

	    await store.dispatch("fetchVersionsForDna", base );

	    expect( list()		).to.have.length.gt( 0 );
	}

	{
	    const dna_version		= await store.dispatch("getLatestVersionForDna", [ dna_id, null ] );

	    for ( let version of store.getters.dna_versions( dna_id ) ) {
		expect( dna_version.version	).to.be.gte( version.version );
	    }
	}
    });
}

function errors_tests () {
}


describe("DevHub 'dnarepo' DNA", () => {
    describe("'dna_library' actions", dna_action_tests );
});
