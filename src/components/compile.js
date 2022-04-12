
const fs			= require('fs');
const path			= require('path');

const components		= {};

function toKebabCase ( str ) {
    return str.split('').map( (letter, i) => {
	return letter.toUpperCase() === letter
	    ? `${ i !== 0 ? '-' : '' }${ letter.toLowerCase() }`
	    : letter;
    }).join('');
}

for ( let dirent of fs.readdirSync( __dirname, { "withFileTypes": true }) ) {
    if ( !dirent.isDirectory() )
	continue;

    const name			= dirent.name;
    const element_name		= toKebabCase( name );
    const comp_file		= `${name}.js`;

    console.log("Processing component: %s [%s]", name, element_name );

    const js_path		= path.resolve( __dirname, name, "index.js" );
    const html_path		= path.resolve( __dirname, name, "index.html" );
    const comp_path		= path.resolve( __dirname, comp_file );

    if ( !fs.existsSync( js_path ) )
	throw new Error(`Missing javascript for component: ${js_path}`);

    if ( !fs.existsSync( html_path ) )
	throw new Error(`Missing HTML for component: ${html_path}`);

    const js_text		= fs.readFileSync( js_path, "utf8" );
    const html_text		= fs.readFileSync( html_path, "utf8" );

    if ( !js_text.includes("__template") )
	throw new Error(`Missing '__template' in javascript for component: ${js_path}`);

    fs.writeFileSync( comp_path, js_text.replace("__template", "`" + html_text.trim() + "`") );

    components[ element_name ]	= name;
}

const index_path		= path.resolve( __dirname, "index.js" );
const component_exports		= Object.entries( components )
      .map( ([key, value]) => {
	  const calc_tabs	= Math.ceil( (key.length + 7 + 1) / 8 )
	  const extra_tabs	= "\t".repeat( 4 - calc_tabs );
	  return `"${key}":\t${extra_tabs}require('./${value}.js')`;
      })
      .join(",\n    ");

const index_text		= `\
const { Logger }			= require('@whi/weblogger');
const log				= new Logger("components");

const components			= {
    ${component_exports}
};

log.trace("Loaded components:", components );

module.exports = components;
`;

console.log("Writing index.js filet:\n%s", index_text );
fs.writeFileSync( index_path, index_text );
