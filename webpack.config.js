const path			= require('path');
const webpack			= require('webpack');
const fs			= require('fs');

const Copy			= require('copy-webpack-plugin');
const DNAREPO_HASH		= fs.readFileSync("./tests/DNAREPO_HASH", "utf8");

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
		'DNAREPO_HASH': JSON.stringify( DNAREPO_HASH ),
	    }
	}),
    ],
    stats: {
	colors: true
    },
    devtool: 'source-map',
};
