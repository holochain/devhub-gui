const path			= require('path');
const webpack			= require('webpack');
const fs			= require('fs');

const Copy			= require('copy-webpack-plugin');

const DNAREPO_HASH		= fs.readFileSync("./tests/DNAREPO_HASH",	"utf8").trim();
const HAPPS_HASH		= fs.readFileSync("./tests/HAPPS_HASH",		"utf8").trim();
const WEBASSETS_HASH		= fs.readFileSync("./tests/WEBASSETS_HASH",	"utf8").trim();
const WEBPACK_MODE		= "development"; // production | development


module.exports = {
    target: "web",
    mode: WEBPACK_MODE,
    entry: [ "./src/index.js" ],
    resolve: {
	// mainFields: ["main"],
	alias: {
	    "vue":		"vue/dist/vue.esm-bundler.js",
	    "vue-router":	"vue-router/dist/vue-router.esm-bundler.js",
	},
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
	    {
		test: /\.html$/,
		exclude: /node_modules/,
		use: {
		    loader: "html-loader",
		    options: {
			sources: false, // prevents 'not found' errors for HTML references
		    },
		}
	    },
	],
    },
    plugins: [
	new Copy({
	    patterns: [
		{
		    from: "./src/static/",
		    globOptions: {
			gitignore: true,
			ignore: ["**/*~"],
		    },
		},
	    ],
	}),
	new webpack.DefinePlugin({
	    // Vue says to do this - https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
	    "WEBPACK_MODE":		JSON.stringify( WEBPACK_MODE ),
	    "__VUE_OPTIONS_API__":	JSON.stringify( true ),
	    "__VUE_PROD_DEVTOOLS__":	JSON.stringify( false ),
	    "process.env": {
		"DNAREPO_HASH":		JSON.stringify( DNAREPO_HASH ),
		"HAPPS_HASH":		JSON.stringify( HAPPS_HASH ),
		"WEBASSETS_HASH":	JSON.stringify( WEBASSETS_HASH ),
	    },
	}),
    ],
    stats: {
	colors: true,
	errorDetails: true,
    },
    devtool: "source-map",
};
