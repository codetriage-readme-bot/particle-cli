const VError = require('verror');
const ApiClient = require('../lib/ApiClient');
const ensureError = require('../lib/utilities').ensureError;

class PublishCommand {
	constructor(options) {
		this.options = options;
	}

	publishEvent(eventName, data, { 'public': publicFlag, 'private': privateFlag }) {
		// Cannot use usual destructuring since public and private are reserved keywords
		const setPrivate = publicFlag ? false : privateFlag;

		const api = new ApiClient();
		api.ensureToken();

		return api.publishEvent(eventName, data, setPrivate).catch((err) => {
			throw new VError(ensureError(err), 'Could not publish event');
		});
	}
}

module.exports = PublishCommand;
