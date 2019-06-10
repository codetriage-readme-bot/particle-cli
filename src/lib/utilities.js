/**
 ******************************************************************************
 * @file    lib/utilities.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   General Utilities Module
 ******************************************************************************
Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope utilities it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */


const fs = require('fs');
const path = require('path');
const when = require('when');
const childProcess = require('child_process');
const glob = require('glob');
const _ = require('lodash');
const VError = require('verror');
const log = require('./log');

const utilities = {
	deferredChildProcess(exec){
		return new Promise((resolve, reject) => {
			childProcess.exec(exec, (error, stdout) => {
				if (error){
					reject(error);
				} else {
					resolve(stdout);
				}
			});
		});
	},

	deferredSpawnProcess(exec, args){
		return new Promise((resolve, reject) => {
			try {
				log.verbose('spawning ' + exec + ' ' + args.join(' '));

				let options = {
					stdio: ['ignore', 'pipe', 'pipe']
				};

				let child = childProcess.spawn(exec, args, options);
				let stdout = [],
					errors = [];

				if (child.stdout){
					child.stdout.pipe(log.stdout());
					child.stdout.on('data', (data) => {
						stdout.push(data);
					});
				}

				if (child.stderr){
					child.stderr.pipe(log.stderr());
					child.stderr.on('data', (data) => {
						errors.push(data);
					});
				}

				child.on('close', (code) => {
					let output = { stdout: stdout, stderr: errors };
					if (!code){
						resolve(output);
					} else {
						reject(output);
					}
				});
			} catch (ex){
				console.error('Error during spawn ' + ex);
				reject(ex);
			}
		});
	},

	filenameNoExt(filename){
		if (!filename || (filename.length === 0)){
			return filename;
		}

		let idx = filename.lastIndexOf('.');
		if (idx >= 0){
			return filename.substr(0, idx);
		} else {
			return filename;
		}
	},

	getFilenameExt(filename){
		if (!filename || (filename.length === 0)){
			return filename;
		}

		let idx = filename.lastIndexOf('.');
		if (idx >= 0){
			return filename.substr(idx);
		} else {
			return filename;
		}
	},

	timeoutGenerator(msg, defer, delay){
		return setTimeout(() => {
			defer.reject(msg);
		}, delay);
	},

	async retryDeferred(testFn, numTries, recoveryFn){
		if (!testFn){
			console.error('retryDeferred - comon, pass me a real function.');
			return Promise.reject('not a function!');
		}

		return new Promise((resolve, reject) => {
			let lastError = null;
			let tryTestFn = (async () => {
				numTries--;

				if (numTries < 0){
					return reject(lastError);
				}

				try {
					const value = await Promise.resolve(testFn());
					return resolve(value);
				} catch (error){
					lastError = error;

					if (typeof recoveryFn === 'function'){
						when(recoveryFn()).then(tryTestFn);
					} else {
						tryTestFn();
					}
				}
			})();
		});



		let defer = when.defer();
		let lastError = null;
		let tryTestFn = () => {
			numTries--;
			if (numTries < 0){
				defer.reject('Out of tries ' + lastError);
				return;
			}

			try {
				when(testFn()).then(
					(value) => {
						defer.resolve(value);
					},
					(msg) => {
						lastError = msg;

						if (recoveryFn){
							when(recoveryFn()).then(tryTestFn);
						} else {
							tryTestFn();
						}
					});
			} catch (ex){
				lastError = ex;
			}
		};

		tryTestFn();
		return defer.promise;
	},

	globList(basepath, arr){
		let line, found, files = [];
		for (let i=0;i<arr.length;i++){
			line = arr[i];
			if (basepath){
				line = path.join(basepath, line);
			}
			found = glob.sync(line, { nodir: true });

			if (found && (found.length > 0)){
				files = files.concat(found);
			}
		}
		return files;
	},

	trimBlankLinesAndComments(arr){
		if (arr && (arr.length !== 0)){
			return arr.filter((obj) => {
				return obj && (obj !== '') && (obj.indexOf('#') !== 0);
			});
		}
		return arr;
	},

	readAndTrimLines(file){
		if (!fs.existsSync(file)){
			return null;
		}

		let str = fs.readFileSync(file).toString();
		if (!str){
			return null;
		}

		let arr = str.split('\n');
		if (arr && (arr.length > 0)){
			for (let i = 0; i < arr.length; i++){
				arr[i] = arr[i].trim();
			}
		}
		return arr;
	},

	tryParse(str){
		try {
			if (str){
				return JSON.parse(str);
			}
		} catch (ex){
			console.error('tryParse error ', ex);
		}
	},

	/**
	 * replace unfriendly resolution / rejected messages with something nice.
	 *
	 * @param {Promise} promise
	 * @param {*} res
	 * @param {*} err
	 * @returns {Promise} promise, resolving with res, or rejecting with err
	 */
	replaceDfdResults(promise, res, err){
		return Promise.resolve(promise)
			.then(() => res)
			.catch(() => err);
	},

	compliment(arr, excluded){
		let hash = utilities.arrayToHashSet(excluded);

		let result = [];
		for (let i=0;i<arr.length;i++){
			let key = arr[i];
			if (!hash[key]){
				result.push(key);
			}
		}
		return result;
	},

	tryDelete(filename){
		try {
			if (fs.existsSync(filename)){
				fs.unlinkSync(filename);
			}
			return true;
		} catch (ex){
			console.error('error deleting file ' + filename);
		}
		return false;
	},

	__banner: undefined,
	banner(){
		let bannerFile = path.join(__dirname, '../../assets/banner.txt');
		if (this.__banner===undefined){
			try {
				this.__banner = fs.readFileSync(bannerFile, 'utf8');
			} catch (err){
				// ignore missing banner
			}
		}
		return this.__banner;
	},

	// todo - factor from/to constants.js
	knownPlatforms(){
		return {
			'core': 0,
			'photon': 6,
			'p1': 8,
			'electron': 10,
			'raspberrypi': 31,
			'argon': 12,
			'boron': 13,
			'xenon': 14,
			'asom': 22,
			'bsom': 23,
			'xsom': 24,
			'oak': 82,
			'duo': 88,
			'bluz': 103,
			'bluz-gateway': 269,
			'bluz-beacon': 270
		};
	},

	ensureError(err){
		if (!_.isError(err) && !(err instanceof VError)){
			return new Error(_.isArray(err) ? err.join('\n') : err);
		}
		return err;
	}
};
module.exports = utilities;
