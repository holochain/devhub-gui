const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/input-feedback");

const { load_html }			= require('../common.js');


module.exports = async function ( element_local_name, component_name ) {
    return {
	"props": {
	    "validator": {
		"type": Function,
	    },
	    "validMessage": {
		"type": String,
	    },
	    "debounceDelay": {
		"type": Number,
		"default": 0,
	    },
	    "hideValid": {
		"type": Boolean,
		"default": false,
	    },
	},
	data () {
	    return {
		"input": null,
		"blurred": false,
		"showFeedback": true,
		"invalidMessage": null,
	    };
	},
	mounted () {
	    this.input			= this.$refs.container.children[0];

	    if ( !["INPUT", "TEXTAREA", "SELECT"].includes( this.input.tagName ) )
		this.input			= this.input.querySelector("input, textarea, select");

	    if ( !["INPUT", "TEXTAREA", "SELECT"].includes( this.input.tagName ) )
		throw new Error(`<input-feedback> requires one of the following form inputs; input, textarea, select`);

	    this.invalidMessage		= this.input.validationMessage; // default value
	    log.info("Initial validation message: '%s' for", this.invalidMessage, this.input );

	    this.input.addEventListener("blur", (event) => {
		if ( this.blurred !== true ) {
		    log.debug("Input '%s' has now been touched", this.input.type );
		    this.blurred		= true;
		}
	    });

	    if ( this.validator ) {
		log.info("Validator function:", String(this.validator) );
		let previous_value		= this.input.value;
		let toid;
		this.input.addEventListener("keyup", async (event) => {
		    log.debug("'keyup' event for input: '%s' => '%s'", previous_value, this.input.value, this.input );
		    if ( previous_value === this.input.value )
			return; // no change

		    previous_value		= this.input.value;
		    this.showFeedback	= false;

		    if ( this.debounceDelay > 0 ) {
			if ( toid ) {
			    clearTimeout( toid );
			    toid		= undefined;
			}
			toid		= setTimeout( this.runValidator.bind(this, event), this.debounceDelay );
		    }
		    else
			this.runValidator( event );
		});
	    }
	    else {
		this.input.addEventListener("keyup", async (event) => {
		    this.updateInvalidMessage();
		});
	    }
	},
	"methods": {
	    async runValidator ( event ) {
		// I don't know why this was put in, but it seems to be a mistake.  Why wouldn't we let
		// the validator determine if an empty value is invalid?
		//
		// if ( this.input.value === "" ) {
		// 	this.showFeedback	= true;
		// 	return this.updateInvalidMessage("");
		// }

		const valid		= await this.validator( this.input.value, this.input, this );

		this.$nextTick(() => {
		    this.updateInvalidMessage( valid === true ? "" : valid );
		    this.showFeedback	= true;
		});
	    },
	    updateInvalidMessage ( msg = "" ) {
		if ( msg === false )
		    msg			= "Validator returned false";

		this.input.setCustomValidity( msg );

		if ( this.invalidMessage === this.input.validationMessage )
		    return;

		log.trace("Setting invalid message to: '%s'", this.input.validationMessage );
		this.invalidMessage		= this.input.validationMessage;
	    },
	},
	"computed": {
	    show_validation_feedback () {
		if ( !this.input )
		    return false;

		this.invalidMessage; // cause reactivity for this property

		if ( this.input.checkValidity() ) {
		    return this.blurred && !this.hideValid;
		}
		else {
		    return this.blurred && this.showFeedback;
		}
	    },
	},
	"template": await load_html(`/dist/components/${component_name}.html`),
    };
}
