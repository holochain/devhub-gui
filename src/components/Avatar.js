const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/identicon");

const Identicons			= require('@whi/identicons');


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "agentId": {
		"required": true,
	    },
	    "size": {
		"type": Number,
		"default": 25,
	    },
	    "base": {
		"type": Number,
		validator ( value ) {
		    if ( value < 0 )
			return false;
		    if ( value > 1 )
			return false;
		    return true;
		},
	    },
	},
	"computed": {
	    identicon () {
		return Identicons.renderDiscs({
		    "seed": String(this.agentId),
		    "base": this.base,
		    "width": this.size,
		    "height": this.size,
		    "colorRange": 15,
		});
	    },
	    dataURL () {
		return this.identicon.dataURL;
	    },
	    imgSource () {
		return this.dataURL;
	    },
	},
    };
}
