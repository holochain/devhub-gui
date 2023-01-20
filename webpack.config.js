const path			= require('path');
const webpack			= require('webpack');
const TerserPlugin		= require("terser-webpack-plugin");
const fs			= require('fs');
const pack_json			= require('./package.json');

const Copy			= require('copy-webpack-plugin');

const WEBPACK_MODE		= process.env.WEBPACK_MODE || "production";


const MAX_SIZE_KB		= 250;
const MAX_SIZE			= MAX_SIZE_KB * 1_000;


module.exports = {
    target: "web",
    mode: WEBPACK_MODE,
    entry: [ "./src/index.js" ],
    resolve: {
	mainFields: ["browser", "main"],
    },
    output: {
	"publicPath": "/",
	"path": path.resolve("static", "dist"),
	"filename": "webpacked.app.js"
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
	    "WEBPACK_MODE":		JSON.stringify( WEBPACK_MODE ),
	    "__VUE_OPTIONS_API__":	JSON.stringify( true ),
	    "__VUE_PROD_DEVTOOLS__":	JSON.stringify( false ),
	    "DEVHUB_GUI_VERSION":	JSON.stringify( pack_json.version ),
	}),
	new Copy({
	    patterns: [{
		"from":		"src/components/*.html",
		"to":		"components/[name].html",
	    }],
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
    performance: {
	maxEntrypointSize:	MAX_SIZE,
	maxAssetSize:		MAX_SIZE,
    },
};
