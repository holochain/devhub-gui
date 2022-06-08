const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/modal");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "title": {
		"type": String,
		"required": true,
	    },
	    "actionText": {
		"type": String,
		"default": "Continue",
	    },
	    "action": {
		"type": Function,
	    },
	    "cancel": {
		"type": Function,
		"default": () => null,
	    },
	    "autoValidationReset": {
		"type": Boolean,
		"default": true,
	    },
	},
	data () {
	    return {
		"running_action": false,
	    };
	},
	mounted () {
	    this.$el.addEventListener('hidden.bs.modal', (event) => {
		log.debug("Modal hidden event");
		if ( this.autoValidationReset )
		    this.resetFormValidation( this.$el );
	    });
	},
	"computed": {
	    modal () {
		if ( !this._modal && typeof bootstrap !== "undefined" )
		    this._modal		= new bootstrap.Modal( this.$el );
		return this._modal;
	    }
	},
	"methods": {
	    resetFormValidation ( $el ) {
		const elements		= $el.querySelectorAll(".was-validated");
		elements.forEach( el => {
		    el.classList.remove("was-validated");
		});
	    },
	    async runAction () {
		this.running_action		= true;
		try {
		    await this.action( this );
		} catch (err) {
		    console.error( err );
		} finally {
		    this.running_action	= false;
		}
	    }
	},
    };
}
