const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/list-group-item");


module.exports = {
    data () {
	return {
	    "action": false,
	};
    },
    mounted () {
	this.action			= !!this.$attrs["action"];
    },
    "template": __template,
};
