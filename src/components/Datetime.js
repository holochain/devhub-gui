const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/datetime");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "datetime": {
		"type": Date,
		"required": true,
	    },
	    "format": {
		"type": String,
	    },
	    "title": {
		"type": String,
	    },
	},
	data () {
	    return {};
	},
	"computed": {
	    datetime_title () {
		return this.$filters.time( this.datetime, !this.format && "weekday+date+time" );
	    },
	    datetime_str () {
		return this.$filters.time( this.datetime, this.format );
	    },
	},
	"methods": {
	},
    };
}
