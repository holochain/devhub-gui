const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const HoloHashes			= require('@whi/holo-hash');
const { LocalStorage }			= require('node-localstorage');


global.Vuex				= require('vuex');
global.fetch				= require('node-fetch');
global.HolochainClient			= require('@whi/holochain-client');
global.CruxPayloadParser		= require('@whi/crux-payload-parser');

global.holohash				= HoloHashes
global.localStorage			= new LocalStorage("./scratch");

function readfile ( relative_path ) {
    return fs.readFileSync( path.resolve( __dirname, relative_path ), "utf8" );
}


// Things that require the 'window' variable
global.window				= { localStorage };
global.WEBPACK_MODE			= "development";

localStorage.setItem( "AGENT_PUBKEY", 	readfile("../AGENT").trim() );
localStorage.setItem( "LOG_LEVEL", 	process.env.LOG_LEVEL ? process.env.LOG_LEVEL.replace("silly", "trace") : "fatal" );

const DNAREPO_HASH			= readfile("../DNAREPO_HASH"	).trim();
const HAPPS_HASH			= readfile("../HAPPS_HASH"	).trim();
const WEBASSETS_HASH			= readfile("../WEBASSETS_HASH"	).trim();

Object.assign( global.process.env, {
    DNAREPO_HASH,
    HAPPS_HASH,
    WEBASSETS_HASH,
});

global.gzip				= require('../../static/dependencies/gzip.js');
global.sha256				= require('../../static/dependencies/sha256.js');
global.MessagePack			= require('../../static/dependencies/msgpack.js');

const client_init			= require('../../src/client.js');
const store_init			= require('../../src/store.js');
const common				= require('../../src/common.js');

global.window				= undefined;
// END 'window' global


// Required by: ../mock_call.js
global.crypto				= require('crypto');

const { mock_caller }			= require('../mock_call.js');


module.exports				= {
    async store_init () {
	const client			= await client_init();

	client.call			= mock_caller;

	return await store_init( client );
    },
    common,
};
