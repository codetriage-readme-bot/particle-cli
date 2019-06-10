const { expect, sinon } = require('../../test/test-setup');
const util = require('./utilities');


describe('Utilities', () => {
	const sandbox = sinon.createSandbox();

	beforeEach(() => {
		// sandbox.stub(fakes, 'clearTimeout');
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('retryDeferred()', () => {
		it('retries', async () => {
		});
	});
});
