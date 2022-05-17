const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const crypto				= require('crypto');
const { expect }			= require('chai');

require('./setup.js');
const { common }			= require('./setup.js');


function common_tests () {

    it("should run callback later", async function () {
	{
	    const start			= Date.now();
	    new Promise( f => {
		for (let i=0; i<1e7;) i++;
		f();
	    });
	    const delta			= Date.now() - start;

	    expect( delta		).to.be.gt( 2 );
	}

	{
	    const start			= Date.now();
	    const later_p		= common.later( () => {
		for (let i=0; i<1e7;) i++;
	    });
	    const delta			= Date.now() - start;

	    expect( delta		).to.be.lt( 2 );
	}
    });

}

function errors_tests () {
}


describe("DevHub GUI", () => {
    describe("Common", common_tests );
});
