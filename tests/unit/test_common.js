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

    it("should run async once", async function () {
	const long_process		= common.once( () => {
	    for (let i=0; i<1e7;) i++;
	});

	{
	    const start			= Date.now();
	    const lp1			= long_process();
	    const lp2			= long_process();

	    // First await should take more than 2ms
	    await lp1;
	    const delta			= Date.now() - start;
	    expect( delta		).to.be.gt( 2 );

	    // Second await should fulfill instantly even though they started at the same time
	    const start_2		= Date.now();
	    await lp2;
	    const delta_2		= Date.now() - start_2;
	    expect( delta_2		).to.be.lt( 2 );
	}

	{
	    // Later runs should also fulfill instantly
	    const start			= Date.now();
	    await long_process();
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
