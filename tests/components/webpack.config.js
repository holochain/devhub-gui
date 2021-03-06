const fs			= require('fs');
const path			= require('path');
const crypto			= require('crypto');
const webpack			= require('webpack');
const TerserPlugin		= require("terser-webpack-plugin");
const { DnaHash }		= require('@whi/holo-hash');


module.exports = {
    target: "web",
    mode: "development",
    entry: [ "./index.js" ],
    resolve: {
	mainFields: ["browser", "main"],
    },
    output: {
	publicPath: "/",
	filename: "webpacked.app.js"
    },
    module: {
	rules: [
	    {
		test: /\.m?js$/,
		exclude: /(node_modules|bower_components)/,
		use: {
		    loader: "babel-loader",
		    options: {
			presets: ["@babel/preset-env"],
			plugins: [
			    ["@babel/plugin-transform-runtime", {
				"regenerator": true,
			    }],
			    ["@babel/plugin-transform-modules-commonjs", {
				"allowTopLevelThis": true,
			    }],
			],
		    }
		}
	    },
	],
    },
    plugins: [
	new webpack.DefinePlugin({
	    // Vue says to do this - https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
	    "__VUE_OPTIONS_API__":	JSON.stringify( true ),
	    "__VUE_PROD_DEVTOOLS__":	JSON.stringify( false ),
	    "WEBPACK_MODE":		JSON.stringify( "development" ),
	    "process.env": {
		"DNAREPO_HASH":		JSON.stringify( String(new DnaHash( crypto.randomBytes(32) )) ),
		"HAPPS_HASH":		JSON.stringify( String(new DnaHash( crypto.randomBytes(32) )) ),
		"WEBASSETS_HASH":	JSON.stringify( String(new DnaHash( crypto.randomBytes(32) )) ),
	    },
	}),
    ],
    stats: {
	colors: true,
	errorDetails: true,
    },
    devtool: "source-map",
    optimization: {
	minimizer: [
	    new TerserPlugin({
		terserOptions: {
		    keep_classnames: true,
		},
	    }),
	],
    },
};
