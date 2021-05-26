const { Notyf }				= require('notyf');

const notify				= new Notyf({
    duration: 2000,
    types: [
	{
	    type: 'info',
	    backgroundColor: 'black',
	    icon: false,
	},
	{
	    type: 'warning',
	    backgroundColor: 'orange',
	    icon: {
		className: 'material-icons',
		tagName: 'i',
		text: 'warning'
	    }
	},
	{
	    type: 'error',
	    backgroundColor: 'indianred',
	    duration: 5000
	}
    ]
});

module.exports				= notify;
