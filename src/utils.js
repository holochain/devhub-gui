
function b64 ( input ) {
    return typeof input === "string"
	? Buffer.from( input, "base64" )
	: Buffer.from( input ).toString("base64");
}

function object_sorter (key) {
    return (a,b) => {
	if ( a[key] === undefined )
	    return b[key] === undefined ? 0 : -1;
	return a[key] < b[key]
	    ? -1
	    : a[key] > b[key] ? 1 : 0;
    };
}

function load_file ( file ) {
    console.log("Load file:", file );
    return new Promise((f,r) => {
	let reader			= new FileReader();

	reader.readAsArrayBuffer( file );
	reader.onerror			= function (err) {
	    console.log("FileReader error event:", err );

	    r( err );
	};
	reader.onload			= function (evt) {
	    console.log("FileReader load event:", evt );
	    let result			= new Uint8Array( evt.target.result );
	    console.log("FileReader result:", result );

	    f( result );
	};
	reader.onprogress		= function (p) {
	    console.log("progress:", p );
	};
    });
}


module.exports = {
    object_sorter,
    load_file,
    b64,
};
