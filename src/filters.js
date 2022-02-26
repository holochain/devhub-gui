const { Logger }			= require('@whi/weblogger');
const log				= new Logger("filters");

const days				= ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months				= ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function day ( d, length ) {
    return days[ d.getDay() ].slice(0, length);
}
function month ( d, length ) {
    return months[ d.getMonth() ].slice(0, length);
}
function date ( d ) {
    return `${d.getDate()} ${month(d, 3)} ${d.getFullYear()}`;
}
function time ( d ) {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

module.exports = {
    number ( value ) {
	return (new Number(value)).toLocaleString();
    },

    time ( value, format ) {
	const d				= new Date(value);

	if ( isNaN(d) ) {
	    log.warn("Invalid date from: %s", String(value) );
	    return "Invalid Date";
	}

	switch (format) {
	case "weekday+date+time":
	    format			= `${day(d)}, ${date(d)} @ ${time(d)}`; // "dddd, MMMM D (YYYY) @ HH:mm:ss";
	    break;
	case "weekday+date":
	    format			= `${day(d)}, ${date(d)}`;
	    break;
	case "date+time":
	    format			= `${date(d)} @ ${time(d)}`;
	    break;
	case "date":
	    format			= `${date(d)}`;
	    break;
	default:
	    const delta_seconds		= Math.floor( (new Date() - d) / 1000 );

	    let delta, term;

	    // seconds since
	    if ( delta_seconds < 60 ) {
		delta			= delta_seconds;
		term			= "second";
	    }
	    // minutes since
	    else if ( delta_seconds < 3600 ) {
		delta			= Math.floor( delta_seconds / 60 );
		term			= "minute";
	    }
	    // hours since
	    else if ( delta_seconds < 86400 ) {
		delta			= Math.floor( delta_seconds / 3600 );
		term			= "hour";
	    }
	    // days since
	    else if ( delta_seconds < 2592000 ) {
		delta			= Math.floor( delta_seconds / 86400 );
		term			= "day";
	    }
	    // months since
	    else if ( delta_seconds < 31536000 ) {
		delta			= Math.floor( delta_seconds / 2592000 )
		term			= "month";
	    }

	    format			= delta + " " + (delta > 1 ? `${term}s` : term) + " ago";
	    break;
	}

	return format;
    },
};
