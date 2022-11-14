const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/identicon");

const Identicons			= require('@whi/identicons');


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "seed": {
		"required": true,
	    },
	    "size": {
		"type": Number,
		"default": 25,
	    },
	    "color": {
		"type": Boolean,
		"default": false,
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
	// data () {
	//     return {};
	// },
	// created () {
	// },
	"computed": {
	    identicon () {
		if ( this.seed === null ) {
		    return Identicons.renderDiscs({
			"width": this.size,
			"height": this.size,
			"grayscale": true,
		    });
		}

		return Identicons.renderDiscs({
		    "seed": String(this.seed),
		    "base": this.base,
		    "width": this.size,
		    "height": this.size,
		    "colorRange": 15,
		    "grayscale": this.color === false,
		});
	    },
	    dataURL () {
		return this.identicon.dataURL;
	    },
	},
    };
}
