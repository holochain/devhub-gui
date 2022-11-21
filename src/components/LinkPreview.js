const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/link-preview");

const common				= require('../common.js');

module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "url": {
		"type": String,
	    },
	    "urlImage": {
		"type": String,
	    },
	    "urlTitle": {
		"type": String,
	    },
	    "urlDescription": {
		"type": String,
	    },
	},
	data () {
	    const url			= new URL( this.url );
	    const id			= this.url.replaceAll("/", "|");

	    return {
		"datapath":	`url/info/${id}`,
		"origin":	url.origin,
	    };
	},
	"computed": {
	    ...common.scopedPathComputed( c => c.datapath, "url_info" ),

	    ready () {
		return this.$url_info.present || (
		    this.urlImage && this.urlTitle && this.urlDescription
		);
	    },
	    title () {
		return this.urlTitle || this.url_info.title;
	    },
	    description () {
		return this.urlDescription || this.url_info.description;
	    },
	    image () {
		const src		= this.urlImage || this.url_info.image;
		return src.startsWith("/") ? this.origin + src : src;
	    },
	},
	created () {
	    if ( !this.$url_info.present )
		this.$openstate.read( this.datapath );
	},
    };
}
