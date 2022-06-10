const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/list-group-item");


module.exports = function ( element_local_name, component_name ) {
    return {
	data () {
	    return {
		"action": false,
	    };
	},
	mounted () {
	    this.action			= !!this.$attrs["action"];
	},
    };
}
