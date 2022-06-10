const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/placeholder");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "when": {
		"default": false,
	    },
	    "size": {
		"default": "100%",
	    },
	    "minSize": {
		"default": "6em", // for elements that don't respond to 100%
	    },
	},
	"computed": {
	    styles () {
		const styles		= {
		    "width":		this.size,
		};

		if ( styles.width === "fill" )
		    styles.width		= "100%";
		else if ( styles.width === "p" )
		    styles.width		= "100%";

		if ( this.when )
		    styles['min-width']	= this.minSize;

		return styles;
	    },
	    classes () {
		const classes		= {};

		if ( this.size === "p" )
		    classes["ph-p"]		= true;

		if ( this.size === "fill" )
		    classes["ph-fill"]	= true;

		return classes;
	    },
	},
    };
}
