'use strict';
const Promise = require('bluebird');
const exec = require('child_process').exec;
const printf = require('util').format;
const stream = require('stream');
const Readable = stream.Readable;
const ImageMagickCommands = require('./commands');
const debug = require('debug')('imagickal');

let globalOpts = {};

const identifyFormatDefaults = {
	format: '%m',
	width: {
		type: Number,
		value: '%w'
	},
	height: {
		type: Number,
		value: '%h'
	}
};

/**
 * Parse output from identify returning record for the first image in sequence
 * The parsed data will contain an extra attribute "images" indicating number of images.
 * @param  {String} output
 * @throws {Error} If unable to parse output
 * @return {Object}
 */
function parseOutput(output) {
	let matches;
	let data;
	let json;
	let images = 0;
	const regx = /(\{[^\}]+\})/g;

	while ((matches = regx.exec(output)) !== null) {
		if (!data) {
			data = matches[1];
		}
		images++;
	}

	if (!data) {
		throw new Error();
	}

	try {
		json = JSON.parse(data);
		if (typeof (json) !== 'object') {
			throw new Error();
		}
	} catch (e) {
		throw new Error();
	}

	json.images = images;
	return json;
}

/**
 * Get Dimensions from an image file.
 * Returns only dimensions for the first image if the image file contains a sequence of images.
 * @param  {String|Readable}   path full path to the file
 * @param {Function} [callback] results in format {width:,height:,images:}
 *                     images attriube shows number of images in sequence. eg for an animated gif
 * @return {Promise} resolved with {width:,height:}
 *                     images attriube shows number of images in sequence. eg for an animated gif
 */
exports.dimensions = function (path, callback) {
	const cmd = 'identify -format "{\\"width\\":%w,\\"height\\":%h}" ' + (path instanceof Readable ? '-' : path);

	const promise = new Promise((resolve, reject) => {
		debug('dimensions', cmd);

		const shell = exec(cmd, Object.assign({ stdio: ['pipe'] }, globalOpts.execOptions || {}), (err, stdout) => {
			if (err) {
				return reject(err);
			}

			try {
				resolve(parseOutput(stdout.toString()));
			} catch (e) {
				return reject(new Error('Unable to parse dimensions from output: ' + stdout.toString()));
			}
		});

		if (path instanceof Readable) {
			path.pipe(shell.stdin);
		}
	});

	return promise.asCallback(callback);
};

/**
 * Identify image format & dimensions on a image.
 * This will also verify that the image file is not corrupt.
 * This will only be done on the first image if the image file contains a sequence of images.
 * @param  {String|Readable} path
 * @param  {Object|Function} options
 * @param  {Object} [options.format] extra format parameters
 * @param  {Boolean} [options.verifyImage] use verbose in identify command to check image for corruption.
 *                                          Callback can be passed as this parameter.
 * @param {Function} [callback] result in format {format:, width:, height:, images:}
 *                     images attribute shows number of images in sequence. eg for an animated gif
 * @return {Promise} - resolved with {format:, width:, height:, images:}
 *                     images attribute shows number of images in sequence. eg for an animated gif
 */
exports.identify = function (path, options = {}, callback) {
	if (typeof (options) === 'function') {
		callback = options;
		options = {};
	}

	const cmd = printf(
		'identify -format "%s" %s%s',
		stringifyIdentifyFormat(Object.assign({}, identifyFormatDefaults, options.format)),
		options.verifyImage ? '-verbose ' : '',
		path instanceof Readable ? '-' : path
	);

	debug('identify', cmd);

	const promise = new Promise((resolve, reject) => {
		const shell = exec(cmd, Object.assign({ stdio: ['pipe'] }, globalOpts.execOptions || {}), (err, stdout) => {
			if (err) {
				if (err.message.match(/decode delegate/)) {
					return reject(new Error('Invalid image file'));
				}
				return reject(err);
			}

			let data;
			try {
				data = parseOutput(stdout.toString());
				data.format = data.format.toLowerCase();
				data.format = data.format === 'jpeg' ? 'jpg' : data.format;
			} catch (e) {
				return reject(new Error('Unable to parse identify data, output was:' + stdout.toString()));
			}

			if (!data) {
				return reject(new Error('Unable to identify image, output was:' + stdout.toString()));
			}

			resolve(data);
		});

		if (path instanceof Readable) {
			path.pipe(shell.stdin);
		}
	});

	return promise.asCallback(callback);
};

function stringifyIdentifyFormat(format) {
	const strings = Object.keys(format).reduce((acc, key) => {
		const val = format[key];
		const strValue = typeof (val) === 'object' && val.type === Number ? val.value : `\\"${val}\\"`;
		acc.push(`\\"${key}\\":${strValue}`);
		return acc;
	}, []);

	return `{${strings.join(',')}}`;
}

/**
 * Create new ImageMagickCommands instances
 * @param {Object} [opts] if specified it not use any of the global options set by setDefaults()
 * @param {String} [opts.executable] path/command for convert.
 * @return {ImageMagickCommands}
 */
const commands = exports.commands = function (opts) {
	return new ImageMagickCommands(opts || globalOpts);
};


/**
 * TRANSFORMATION
 */
const invalidActions = ['get', 'exec'];

/**
 * Create ImageMagickCommands object and apply actions on it.
 * @param  {Object} actions
 * @return {ImageMagickCommands}
 */
function applyActions(actions) {
	const cmds = commands();
	Object.keys(actions).forEach((action) => {
		if (invalidActions.indexOf(action) === -1 && typeof (cmds[action]) === 'function') {
			cmds[action](actions[action]);
		}
	});
	return cmds;
}

/**
 * Calculate new dimensions on image after transformation based on its actions.
 * @param  {Object} actions
 * @return {Object|Boolean} {width:, height:}, false if no new dimensions could be calculated
 */
function calculateNewDimensions(actions) {
	if (actions.resize && actions.resize.width && actions.resize.height) {
		return { width: actions.resize.width, height: actions.resize.height };
	}

	if (actions.resize && actions.resize.width) {
		return {
			width: actions.resize.width
		};
	}

	if (actions.resize && actions.resize.height) {
		return {
			height: actions.height
		};
	}

	return false;
}

/**
 * Transform image
 * @param  {String} src
 * @param  {String} dst
 * @param  {Object} actions
 * @param {Object} [opts]
 * @param {Number} [opts.format] output format jpg, png
 * @param  {Function} [callback]
 * @return {Promise} resolved promise with dst as value
 */
exports.transform = function (src, dst, actions, opts, callback) {
	if (actions.sharpen && actions.sharpen.mode === 'variable') {
		const newDim = calculateNewDimensions(actions);
		if (newDim) {
			const moddedActions = JSON.parse(JSON.stringify(actions));
			moddedActions.sharpen.width = newDim.width;
			moddedActions.sharpen.height = newDim.height;

			return applyActions(moddedActions).exec(src, dst, opts, callback);
		}
	}

	return applyActions(actions).exec(src, dst, opts, callback);
};

/**
 * Set default options to be passed to ImageMagickCommands.
 * @param {Object} opts
 */
exports.setDefaults = function (opts) {
	globalOpts = opts;
};
