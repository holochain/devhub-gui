const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/link-preview");

const { http_info }			= require('../common.js');

module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "url": {
		"type": String,
	    },
	    "info": {
		"type": Object,
		"default": {},
	    },
	},
	data () {
	    return {};
	},
	"computed": {
	    url_info () {
		return this.$store.getters.url( this.url );
	    },
	    $url_info () {
		return this.$store.getters.$url( this.url );
	    },
	    ready () {
		return (this.url && this.url_info) || this.info;
	    },
	    title () {
		return this.info.title || this.url_info.title;
	    },
	    description () {
		return this.info.description || this.url_info.description;
	    },
	    image () {
		return this.info.image || this.url_info.image;
	    },
	},
	created () {
	    if ( !this.ready )
		this.$store.dispatch("getUrlPreview", this.url );
	},
    };
}
