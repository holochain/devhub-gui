const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const crypto				= require('crypto');
const { expect }			= require('chai');

const { store_init,
	common }			= require('./setup.js');

const dna_bundle_bytes			= fs.readFileSync( path.resolve( __dirname, "../../dnas/dnarepo.dna" ) );
const happ_bundle_bytes			= fs.readFileSync( path.resolve( __dirname, "../../bundled/DevHub.happ" ) );
const webhapp_bundle_bytes		= fs.readFileSync( path.resolve( __dirname, "../../bundled/DevHub.webhapp" ) );

// /bundles/dna/<digest>
// /bundles/happ/<digest>
// /bundles/webhapp/<digest>

// - The top level path can be calculated immediately by hashing the zipped bytes.
// - Child paths can be calculated as soon as the bundle is unzipped and decoded.
// - Grandchild paths will not be known by the top level because we want to return as soon as the child paths are ready.


function unpacking_tests () {
    let store;

    before(async function () {
	store				= await store_init();
    });

    beforeEach(async function () {
	// This break between each test makes the timing more consistent on reruns
	this.timeout( 2_000 );
	await common.delay( 1_000 );
    });

    after(async function () {
	await store.state.client.close();
    });

    it("should unpack DNA bundle", async function () {
	this.timeout( 5_000 );

	const [ path, unpack ]		= await store.dispatch("unpack_bundle", dna_bundle_bytes );
	const bundle			= await unpack();

	expect( bundle.type		).to.equal("dna");
	expect( bundle.zomes		).has.length.gt( 0 );

	expect( bundle.dna_digest	).to.be.a("Uint8Array");
	expect( bundle.dna_hash		).to.be.a("string");
	expect( bundle.zome_digests	).has.length.gt( 0 );
    });

    it("should get hApp bundle paths", async function () {
	this.timeout( 5_000 );

	const [ path, unpack ]		= await store.dispatch("unpack_bundle", happ_bundle_bytes );
	const bundle			= await unpack();

	expect( bundle.type		).to.equal("happ");
	expect( bundle.roles		).has.length.gt( 0 );

	for ( let role of bundle.roles ) {
	    const [ role_path, _ ]	= await role.dna.manifest;

	    expect( role_path		).to.be.a("string");
	}
    });

    it("should unpack hApp bundle", async function () {
	this.timeout( 20_000 );

	const [ path, unpack ]		= await store.dispatch("unpack_bundle", happ_bundle_bytes );
	const bundle			= await unpack();

	expect( bundle.type		).to.equal("happ");
	expect( bundle.roles		).has.length.gt( 0 );

	for ( let role of bundle.roles ) {
	    const [ role_path,
		    unpack_dna ]	= await role.dna.manifest;
	    const dna_bundle		= await unpack_dna();

	    expect( dna_bundle.type		).to.equal("dna");
	    expect( dna_bundle.zomes		).has.length.gt( 0 );

	    expect( dna_bundle.dna_digest	).to.be.a("Uint8Array");
	    expect( dna_bundle.dna_hash		).to.be.a("string");
	    expect( dna_bundle.zome_digests	).has.length.gt( 0 );
	}

	expect( await bundle.dna_digests()	).has.length.gt( 0 );
	expect( await bundle.happ_digest()	).to.be.a("Uint8Array");
	expect( await bundle.happ_hash()	).to.be.a("string");

	const [ _, unpack_dna ]		= await bundle.roles[0].dna.manifest;
	const dna			= await unpack_dna();

	expect( dna.type		).to.equal("dna");
	expect( dna.zomes		).has.length.gt( 0 );

	expect( await dna.dna_digest	).to.be.a("Uint8Array");
	expect( await dna.dna_hash	).to.be.a("string");
	expect( await dna.zome_digests	).has.length.gt( 0 );
    });

    it("should unpack hApp bundle", async function () {
	this.timeout( 20_000 );

	const [ path, unpack ]		= await store.dispatch("unpack_bundle", webhapp_bundle_bytes );
	const bundle			= await unpack();

	expect( bundle.type		).to.equal("webhapp");

	const [ happ_path, happ_unpack ] = await bundle.happ_manifest;
	const manifest			= await happ_unpack();

	expect( manifest.type		).to.equal("happ");
	expect( manifest.roles		).has.length.gt( 0 );

	expect( await manifest.dna_digests()	).has.length.gt( 0 );
	expect( await manifest.happ_digest()	).to.be.a("Uint8Array");
	expect( await manifest.happ_hash()	).to.be.a("string");
    });
}

function errors_tests () {
}


describe("DevHub GUI", () => {
    describe("Unpacking", unpacking_tests );
});
