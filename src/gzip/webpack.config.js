const path			= require('path');
const webpack			= require('webpack');
const TerserPlugin		= require("terser-webpack-plugin");

module.exports = {
    target: 'node',
    mode: 'production', // production | development
    entry: [ '../../node_modules/gzip-js/lib/gzip.js' ],
    output: {
	filename:	path.basename( process.env.FILENAME ),
	path:		path.resolve( path.dirname( process.env.FILENAME ) ),
	globalObject: 'this',
	library: {
	    "name": "gzip",
	    "type": "umd",
	},
    },
    stats: {
	colors: true
    },
    devtool: 'source-map',
};
