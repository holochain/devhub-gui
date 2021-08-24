

function sort_by_object_key ( list_of_objects, key ) {
    return list_of_objects.sort( (a,b) => {
	if ( a[key] === undefined )
	    return b[key] === undefined ? 0 : -1;
	return a[key] < b[key]
	    ? -1
	    : a[key] > b[key] ? 1 : 0;
    } );
}


module.exports = {
    sort_by_object_key,
};
