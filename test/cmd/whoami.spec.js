const expect = require('chai').expect;
const proxyquire = require('proxyquire');
const sandbox = require('sinon').createSandbox();

const stubs = {
	api: {
		hasToken: () => {},
		getUser: () => {}
	},
	settings: {
		clientId: 'CLITESTS',
		username: '',
		override: () => {}
	},
	ApiClient: function ApiClient(){
		return stubs.api;
	}
};

const WhoAmICommands = proxyquire('../../src/cmd/whoami', {
	'../../settings': stubs.settings,
	'../lib/ApiClient': stubs.ApiClient
});


describe('Whoami Commands', () => {
	let fakeUser, fakeUserPromise;

	beforeEach(() => {
		fakeUser = { username: 'from-api@example.com' };
		fakeUserPromise = Promise.resolve(fakeUser);
	});

	afterEach(() => {
		sandbox.restore();
		stubs.settings.username = '';
	});

	it('fails when user is signed-out', () => {
		const { whoami, api } = stubForWhoAmI(new WhoAmICommands(), stubs);
		api.hasToken.returns(false);

		return whoami.getUsername()
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				expect(error).to.have.property('message', 'You are not signed in! Please run: `particle login`');
			});
	});

	it('fails when token is invalid', () => {
		const { whoami, api } = stubForWhoAmI(new WhoAmICommands(), stubs);
		api.hasToken.returns(true);
		api.getUser.throws();

		return whoami.getUsername()
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				expect(error).to.have.property('message', 'Failed to find username! Try: `particle login`');
			});
	});

	it('returns username from the local settings when user is signed-in', withConsoleStubs(() => {
		const { whoami, api } = stubForWhoAmI(new WhoAmICommands(), stubs);
		stubs.settings.username = 'from-settings@example.com';
		api.getUser.returns(fakeUserPromise);
		api.hasToken.returns(true);

		return whoami.getUsername()
			.then(username => {
				expect(username).to.equal(stubs.settings.username);
				expect(api.hasToken).to.have.property('callCount', 1);
				expect(api.getUser).to.have.property('callCount', 1);
				expectSuccessMessage(stubs.settings.username);
			});
	}));

	it('returns username from the API when user is signed-in and username isn\'t saved locally', withConsoleStubs(() => {
		const { whoami, api } = stubForWhoAmI(new WhoAmICommands(), stubs);
		api.getUser.returns(fakeUserPromise);
		api.hasToken.returns(true);

		return whoami.getUsername()
			.then(username => {
				expect(username).to.equal(fakeUser.username);
				expect(api.hasToken).to.have.property('callCount', 1);
				expect(api.getUser).to.have.property('callCount', 1);
				expectSuccessMessage(fakeUser.username);
			});
	}));

	it('returns fallback when user is signed-in but username is not saved locally or available in the API', withConsoleStubs(() => {
		const { whoami, api } = stubForWhoAmI(new WhoAmICommands(), stubs);
		fakeUser.username = '';
		stubs.settings.username = '';
		api.getUser.returns(fakeUserPromise);
		api.hasToken.returns(true);

		return whoami.getUsername()
			.then(username => {
				const fallback = 'unknown username';
				expect(username).to.equal(fallback);
				expect(api.hasToken).to.have.property('callCount', 1);
				expect(api.getUser).to.have.property('callCount', 1);
				expectSuccessMessage(fallback);
			});
	}));

	function expectSuccessMessage(username){
		expect(process.stdout.write).to.have.property('callCount', 1);
		expect(process.stdout.write.firstCall.args[0])
			.to.match(new RegExp(`${username}\\n$`));
	}

	function stubForWhoAmI(whoami, stubs){
		const { api } = stubs;
		sandbox.stub(whoami, 'newSpin');
		sandbox.stub(whoami, 'stopSpin');
		whoami.newSpin.returns({ start: sandbox.stub() });
		sandbox.stub(api, 'hasToken');
		sandbox.stub(api, 'getUser');
		return { whoami, api };
	}

	// TODO (mirande): figure out a better approach. this allows us to verify
	// log output without supressing mocha's success / error messages but is a
	// bit awkward
	function withConsoleStubs(fn){
		return () => {
			let result;

			sandbox.stub(process.stdout, 'write');
			sandbox.stub(process.stderr, 'write');

			try {
				result = fn();
			} catch (error) {
				sandbox.restore();
				throw error;
			}

			if (result && typeof result.finally === 'function'){
				return result.finally(() => sandbox.restore());
			}
			sandbox.restore();
			return result;
		};
	}
});

