const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/rating-stars");

module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "rating": {
		"type": Number,
		"required": true,
	    },
	    "endText": {
		"type": String,
	    },
	},
	data () {
	    return {};
	},
	"computed": {
	    end_text_content () {
		return this.endText === undefined
		    ? this.rating.toFixed(1)
		    : this.endText;
	    },
	},
    };
}
