const path			= require('path');
const webpack			= require('webpack');
const fs			= require('fs');

const Copy			= require('copy-webpack-plugin');
const AGENT_HASH		= fs.readFileSync("./tests/AGENT", "utf8");
const DNAREPO_HASH		= fs.readFileSync("./tests/DNAREPO_HASH", "utf8");
const HAPPS_HASH		= fs.readFileSync("./tests/HAPPS_HASH", "utf8");
const WEBASSETS_HASH		= fs.readFileSync("./tests/WEBASSETS_HASH", "utf8");

module.exports = {
    target: 'web',
    mode: 'development', // production | development
    entry: [ '@babel/polyfill', './src/index.js' ],
    resolve: {
	alias: {
	    vue: 'vue/dist/vue.js'
	},
    },
    output: {
	publicPath: '/',
	filename: 'webpacked.app.js'
    },
    module: {
	rules: [
	    {
		test: /\.m?js$/,
		exclude: /(node_modules|bower_components)/,
		use: {
		    loader: 'babel-loader',
		    options: {
			presets: ['@babel/preset-env']
		    }
		}
	    },
	    {
		test: /\.html$/,
		exclude: /node_modules/,
		use: {
		    loader: 'html-loader'
		}
	    }
	],
    },
    plugins: [
	new Copy({
	    patterns: [
		"./src/static/",
		{ from: "./node_modules/notyf/notyf.min.css", to: "notyf" },
	    ],
	}),
	new webpack.DefinePlugin({
	    'process.env': {
		'AGENT_HASH': JSON.stringify( AGENT_HASH ),
		'DNAREPO_HASH': JSON.stringify( DNAREPO_HASH ),
		'HAPPS_HASH': JSON.stringify( HAPPS_HASH ),
		'WEBASSETS_HASH': JSON.stringify( WEBASSETS_HASH ),
	    }
	}),
    ],
    stats: {
	colors: true
    },
    devtool: 'source-map',
};
