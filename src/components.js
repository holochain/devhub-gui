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
		console.log("'keyup' event for input: '%s' => '%s'", previous_value, this.input.value, this.input );
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

	    console.log( this.input.checkValidity(), this.input );
	    if ( this.input.checkValidity() ) {
		console.log("Show valid feedback?", this.blurred, !this.hideValid );
		return this.blurred && !this.hideValid;
	    }
	    else {
		console.log("Show invalid feedback?", this.blurred, this.showFeedback );
		return this.blurred && this.showFeedback;
	    }
	},
    },
    "template": `
<div ref="container" :class="{ 'was-validated': show_validation_feedback }" class="d-inline-block w-100">
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

const ObjectEditor = {
    "props": {
	"object": {
	    "type": Object,
	    "required": true,
	},
    },
    data () {
	return {
	    "key": null,
	    "value": null,
	    "new_key": null,
	    "invalid_add": false,
	    "type_map": {},
	};
    },
    created () {
	for ( let k in this.object ) {
	    let type			= typeof this.object[k];
	    this.type_map[k]		= type === "object"
		? ( this.object[k] === null ? "null" : "object" )
		: type;
	}
    },
    "computed": {
	property_list () {
	    return Object.keys( this.object ).map(k => [k, k]); // [ current, updated ]
	},
    },
    "methods": {
	setProperty ( key, value ) {
	    if ( this.object[key] && !value )
		return;

	    this.object[key]		= value || "";
	    this.type_map[key]		= "string";
	},
	validateNewKey ( key, input, _feedback ) {
	    const value			= this.$refs['key-value'].value;
	    console.log("Validating new key/value:", key, value, this.object );

	    if ( this.object[key] ) {	// key already exists
		if ( value )		// existing key with changing value
		    return "Key already exists";
	    }
	    return true;
	},
	validateKey ( key, input, _feedback ) {
	    console.log("Validating key '%s'", key, this.object, input.dataset );
	    if ( key === input.dataset.originalKey )
		return true;

	    if ( this.object[key] === undefined )
		return true;
	    else
		return "Key already exists";
	},
	addProperty ( enter = false ) {
	    if ( !this.key )
		return;

	    const key			= this.key;
	    const value			= this.value;
	    console.log("Add property %s:", key, value, this.$refs );

	    let failed			= true;
	    console.log("Checking validity of key '%s':", key, this.$refs['key'].checkValidity() );
	    if ( this.$refs['key'].checkValidity() ) {
		this.setProperty( key, value );

		console.log("Reset key/value adders");
		this.key		= null;
		this.value		= null;

		failed			= false;

		if ( !enter ) {
		    // When we add a new property, we want to focus on its value input rather than
		    // the new-property value input.  This naturally covers the scenario where a key
		    // was entered that already exists.  In which case, the focus will go to the
		    // existing key's value input regardless of where it is in the table.
		    this.$nextTick(() => {
			this.$refs[key + '-value'].focus();
		    });
		}
	    }

	    return !failed;
	},
	renameProperty ( key, new_key ) {
	    if ( key === new_key )
		return true;

	    console.log("Rename property %s => %s:", key, new_key, this.$refs );
	    if ( !this.$refs[key].checkValidity() )
		return false;

	    let updated			= false;

	    for ( let k in this.object ) {
		if ( updated ) {
		    let value		= this.object[k];
		    delete this.object[k];
		    this.object[k]	= value;
		}
		else if ( k === key ) {
		    this.object[new_key]	= this.object[key];

		    delete this.object[key];

		    this.new_key	= null;
		    updated		= true;
		}
	    }

	    this.type_map[new_key]	= this.type_map[key];
	    delete this.type_map[key];
	},
	focusAndSelect ( input ) {
	    input.focus();
	    input.select && input.select();
	},
	focusFromContext ( row, col, event ) { // this method is only called by the "enter" event
	    // if row is null, it means the context is the 'add property' row
	    console.log("Triggered focus from context:", row, col, event );

	    this.$nextTick(() => {
		if ( row === null ) {
		    if ( event.shiftKey ) {
			const last_row_key	= this.property_list[this.property_list.length - 1][0];

			this.focusAndSelect( this.$refs[last_row_key + (col === "value" ? "-value" : "" )] );
		    }
		    else
			this.focusAndSelect( this.$refs['key'] ); // go to key regardless of current position
		}
		else {
		    const offset		= event.shiftKey ? -1 : 1;
		    const potential_row	= row + offset;
		    const keypair		= this.property_list[potential_row];
		    const key		= keypair === undefined
			  ? "key"		// go to new props
			  : keypair[0];	// go to next row

		    if ( col === "key" )
			this.focusAndSelect( this.$refs[key] );
		    else
			this.focusAndSelect( this.$refs[key + "-value"] );
		}
	    });
	},
	changePropType ( key, type ) {
	    this.type_map[key]			= type;

	    if ( type === "number" ) {
		this.object[key]		= isNaN( this.object[key] )
		    ? 0
		    : parseInt( this.object[key] );

		if ( isNaN( this.object[key] ) ) // catch Javascript inconsistency for null, true, and false becoming NaN
		    this.object[key]		= 0;
	    }
	    else if ( type === "boolean" )
		this.object[key]		= !!this.object[key];
	    else if ( type === "null" )
		this.object[key]		= null;
	    else if ( type === "object" )
		this.object[key]		= {};
	    else
		this.object[key]		= String( this.object[key] );
	},
    },
    "template": `
<div class="form-table">
    <div class="row align-items-center"
         v-for="(keypair, i) in property_list">
        <div class="col-sm-4">
            <input-feedback :hide-valid="true" :validator="validateKey">
                <input type="text" class="form-control form-input-clean text-end"
                       :ref="keypair[0]"
                       :data-original-key="keypair[0]"
                       v-model="keypair[1]"
                       @keydown.enter="renameProperty( keypair[0], $event.target.value ); focusFromContext( i, 'key', $event )"
                       @blur="renameProperty( keypair[0], $event.target.value )">
            </input-feedback>
        </div>
        <div class="col-sm">
            <select v-if="type_map[keypair[0]] === 'boolean'" class="form-select"
                    v-model="object[keypair[0]]"
                    :ref="keypair[0] + '-value'"
                    @keydown.enter="console.log( $event )">
                <option :value="true">True</option>
                <option :value="false">False</option>
            </select>
            <input v-else-if="type_map[keypair[0]] === 'number'" type="number" class="form-control form-input-clean"
                   :ref="keypair[0] + '-value'"
                   v-model.number="object[keypair[0]]"
                   @keydown.enter="focusFromContext( i, 'value', $event )">
            <input v-else-if="type_map[keypair[0]] === 'null'" type="text" class="form-control form-input-clean" :readonly="true"
                   :ref="keypair[0] + '-value'"
                   value="None"
                   :value="null"
                   @keydown.enter="focusFromContext( i, 'value', $event )">
            <input v-else-if="type_map[keypair[0]] === 'string'" type="text" class="form-control form-input-clean"
                   :ref="keypair[0] + '-value'"
                   v-model="object[keypair[0]]"
                   @keydown.enter="focusFromContext( i, 'value', $event )">
        </div>
        <div class="col-sm">
            <select v-model="type_map[keypair[0]]" class="form-select" @change="changePropType( keypair[0], $event.target.value )">
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="null">None</option>
                <option value="object">Object</option>
            </select>
        </div>
        <div class="col-sm-auto">
            <a @click="deleteProperty( keypair[0], object )" tabindex="-1"><i class="bi-x-lg text-secondary p-1"></i></a>
        </div>
        <div v-if="type_map[keypair[0]] === 'object'" class="col-12 p-2">
            <object-editor v-else-if="type_map[keypair[0]] === 'object'"
                           class="ms-5 p-3" style="background-color: #00000006;"
                           :object="object[keypair[0]]"></object-editor>
        </div>
    </div>
    <div class="row align-items-center">
        <div class="col-sm-4">
            <input-feedback :hide-valid="true" :validator="validateNewKey" :auto-validation-reset="false">
                <input type="text" name="key" class="form-control form-input-clean text-end"
                       ref="key"
                       v-model="key"
                       placeholder="Key"
                       @keydown.enter.prevent="addProperty( true ); focusFromContext( null, 'key', $event )"
                       @blur="addProperty()">
            </input-feedback>
        </div>
        <div class="col-sm">
            <input-feedback :hide-valid="true" :validator="validateValue">
                <input type="text" name="value" class="form-control form-input-clean"
                       ref="key-value"
                       v-model="value"
                       placeholder="Value"
                       @keydown.enter.prevent="focusFromContext( null, 'value', $event )">
            </input-feedback>
        </div>
        <div class="col-sm-auto"><i class="bi-x-lg text-light p-1"></i></div>
    </div>
</div>`,
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
    "object-editor":		ObjectEditor,
};
