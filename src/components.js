const { Logger }			= require('@whi/weblogger');
const log				= new Logger("components");


const DeprecationAlert = {
    "props": {
	"title": {
	    "type": String,
	    "default": "This has been deprecated",
	},
	"message": {
	    "type": String,
	},
    },
    "template": `
<div class="alert alert-danger d-flex align-items-center" role="alert">
    <i class="bi-exclamation-triangle-fill me-3"></i>
    <div>
        <strong>{{ title }}</strong>
        <template v-if="message">
            <br><p class="m-0"><em>Author message: "{{ message }}"</em></p>
        </template>
    </div>
</div>`,
};

const DisplayError = {
    "props": {
	"error": {
	    "validator": ( value ) => {
		return [ null, undefined ].includes( value ) || (
		    value.name && value.message
		);
	    },
	    "required": true,
	},
	"debug": {
	    "type": Boolean,
	    "default": false,
	},
    },
    "template": `
<div v-if="error" class="alert alert-danger d-flex align-items-center" role="alert">
    <i class="bi-exclamation-triangle-fill me-3"></i>
    <div>
        <strong>{{ error.name }}</strong>
        <br>
        <p class="m-0"><em>{{ error.message }}</em></p>
        <pre v-if="debug && error.data" class="mt-3 mb-0"><code>{{ JSON.stringify(error.data, null, 4) }}</code></pre>
    </div>
</div>`,
};

const ListGroup = {
    "props": {
	"noResultText": {
	    "type": String,
	    "default": "No Results",
	},
	"list": {
	    "type": Array,
	    "required": true,
	},
	"loading": {
	    "type": Boolean,
	    "default": false,
	},
    },
    "template": `
<div v-if="loading" class="card">
    <div class="card-body">
        <loading :when="true"></loading>
    </div>
</div>
<div v-else-if="list.length" class="list-group list-group-flush">
    <slot></slot>
</div>
<div v-else class="card my-4">
    <div class="card-body text-center">
        {{ noResultText }}
    </div>
</div>`,
};

const ListGroupItem = {
    data () {
	return {
	    "action": false,
	};
    },
    mounted () {
	this.action			= !!this.$attrs["action"];
    },
    "template": `
<div class="list-group-item px-3" :class="{ 'list-group-item-action': this.action }">
    <slot></slot>
</div>`,
};

const InputFeedback = {
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
		if ( previous_value.trim() === this.input.value.trim() )
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
	    if ( this.input.value === "" ) {
		this.showFeedback	= true;
		return this.updateInvalidMessage("");
	    }

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
    },
    "template": `
<div ref="container" :class="{ 'was-validated': blurred && showFeedback }" class="d-inline-block w-100">
    <slot></slot>
    <div v-if="validMessage" class="valid-feedback text-start" v-html="validMessage"></div>
    <div v-if="input" class="invalid-feedback text-start" v-html="invalidMessage"></div>
</div>`,
};

const Breadcrumbs = {
    "props": {
	"backLink": {
	    "type": String,
	},
	"skipBase": {
	    "type": Boolean,
	    "default": false,
	},
	"pathMapping": {
	    "type": Object,
	    "required": true,
	},
    },
    data () {
	const breadcrumb_mapping	= this.pathMapping;
	const current_path		= this.$router.currentRoute.value.path;
	const segments			= current_path.split("/").slice(1);
	const crumbs			= [];
	log.trace("Creating breadcrumbs for %s segements (skip root: %s)", segments.length, this.skipBase );

	if ( this.skipBase === false ) {
	    crumbs.push({
		"link": "/",
		"text": breadcrumb_mapping["/"],
	    });
	}

	let path			= "";

	return {
	    "crumbs": segments.reduce( (acc, seg, index) => {
		if ( seg === "" ) // Ignore paths with accidental double slashes
		    return acc;

		path		       += "/" + seg;

		if ( this.$attrs[`sub-${index}`] ) {
		    acc.push({
			"link": path,
			"text": this.$attrs[`sub-${index}`],
		    });
		}
		else if ( breadcrumb_mapping[path] ) {
		    acc.push({
			"link": path,
			"text": breadcrumb_mapping[path],
		    });
		}
		else {
		    let found		= Object.entries( breadcrumb_mapping )
			.filter( ([re_str]) => re_str.startsWith("^") )
			.find( ([re_str]) => {
			    return (new RegExp( re_str )).test( path );
			});

		    if ( !found ) {
			log.warn("No breadcrumb name for path: %s", path );
			return acc;
		    }

		    acc.push({
			"link": path,
			"text": found[1],
		    });
		}

		if ( segments.length === (index + 1) ) {
		    // Remove the current pages link
		    delete acc[acc.length-1].link;
		}

		return acc;
	    }, crumbs ),
	}
    },
    "template": `
<div class="d-flex align-items-center">
    <router-link v-if="backLink" :to="backLink" class="text-primary fw-bolder">
        <i class="bi-arrow-left fs-4 me-3"></i>
    </router-link>
    <a v-else href="#" @click="$router.back()" class="text-primary fw-bolder">
        <i class="bi-arrow-left fs-4 me-3"></i>
    </a>
    <nav style="--bs-breadcrumb-divider: '>';">
        <ol class="breadcrumb m-0">
            <li v-for="(crumb, index) in crumbs" class="breadcrumb-item">
                <router-link v-if="crumb.link" :to="crumb.link">
                    {{ crumb.text }}
                </router-link>
                <span v-else>{{ crumb.text }}</span>
            </li>
        </ol>
    </nav>
    <slot></slot>
</div>`,
};


const Modal = {
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
	    "default": () => null,
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
    "template": `
<div class="modal">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title">{{ title }}</h4>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <slot name="default"></slot>
            </div>
            <div class="modal-footer modal-2-button">
                <slot name="controls">
                    <button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal"
                            @click="cancel()">Cancel</button>
                    <button type="button" class="btn btn-primary" :class="{ 'disabled': running_action }"
                            @click="runAction()">
                        <span v-if="running_action"
                              class="spinner-border spinner-border-sm me-3"></span>
                        {{ actionText }}
                    </button>
                </slot>
            </div>
        </div>
    </div>
</div>`,
};

const PageHeader = {
    "props": {
	"controlsCol": {
	    "type": String,
	    "default": null,
	},
    },
    data () {
	return {
	    "header_col_classes": {},
	    "controls_col_classes": {},
	};
    },
    mounted () {
	let header_col_size		= 12;
	let controls_col_size		= 0;

	if ( this.$slots["controls"] ) {
	    controls_col_size		= this.controlsCol || 6;
	    header_col_size		= 12 - controls_col_size;
	}

	this.header_col_classes[`col-${header_col_size}`] = true;
	this.controls_col_classes[`col-${controls_col_size}`] = true;
    },
    "template": `
<div class="page-header row align-items-center">
    <div class="d-flex align-items-center" :class="header_col_classes">
        <slot name="default"></slot>

        <div class="my-auto ms-5">
            <slot name="title-extras"></slot>
        </div>
    </div>
    <div v-if="$slots['controls']" :class="controls_col_classes">
        <slot name="controls"></slot>
    </div>
</div>`,
};

const PageView = {
    "template": `
<div class="flex-grow-1 pt-3 pb-5">
    <slot></slot>
</div>`,
};

const Search = {
    "props": {
	"modelValue": String,
    },
    "emits": [ "update:modelValue" ],
    "template": `
<div class="form-input-search">
    <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"
           v-bind="$attrs" type="text" class="form-control">
</div>`,
};

const Placeholder = {
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
    "template": `
<span class="ph-glow" :class="classes" :style="styles">
    <slot v-if="!when"></slot>
</span>`,
};

const Loading = {
    "props": {
	"when": {
	    "type": Boolean,
	    "required": true,
	},
    },
    "template": `
<div v-if="when" class="text-center p-4">
    <div class="spinner-border mt-1" role="status">
        <span class="visually-hidden">Loading...</span>
    </div>
</div>
<slot v-else></slot>`,
};


module.exports = {
    "deprecation-alert":	DeprecationAlert,
    "display-error":		DisplayError,
    "list-group":		ListGroup,
    "list-group-item":		ListGroupItem,
    "input-feedback":		InputFeedback,
    "breadcrumbs":		Breadcrumbs,
    "modal":			Modal,
    "page-header":		PageHeader,
    "page-view":		PageView,
    "search":			Search,
    "placeholder":		Placeholder,
    "loading":			Loading,
};
