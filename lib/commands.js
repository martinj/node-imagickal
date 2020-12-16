'use strict';
const Promise = require('bluebird');
const exec = require('child_process').exec;
const	printf = require('util').format;
const debug = require('debug')('imagickal');

/**
 * Differet sharpening presets, values are (radius, amount, threshold)
 * @type {Object}
 */
const sharpening = {
	light: [0.5, 1, 0.05],
	moderate: [0.65, 1.1, 0.05],
	strong: [0.8, 1.2, 0.05],
	extreme: [1.0, 1.5, 0.00]
};

/**
 * Valid resize flags, http://www.imagemagick.org/Usage/resize/#noaspect
 * @type {Array}
 */
const resizeFlags = ['<', '>', '!', '^'];

/**
 * valid gravity values, http://www.imagemagick.org/script/command-line-options.php#gravity
 * @type {Array}
 */
const gravities = ['NorthWest', 'North', 'NorthEast', 'West', 'Center', 'East', 'SouthWest', 'South', 'SouthEast'];

/**
 * Check if variable is a number
 * @param  {Mixed}  n [description]
 * @return {Boolean}
 */
function isNumber(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Calculate what sharpening mode to use base on image dimensions
 * @param  {Integer} width
 * @param  {Integer} height
 * @return {String} the sharpening mode
 */
function getVariableMode(width, height) {
	if ((width && width <= 50) || (height && height <= 50)) {
		return 'extreme';
	}

	if ((width && width <= 100) || (height && height <= 100)) {
		return 'strong';
	}

	if ((width && width <= 300) || (height && height <= 300)) {
		return 'moderate';
	}

	if ((width && width <= 500) || (height && height <= 500)) {
		return 'light';
	}
	return false;
}

/**
 * Sanitize Resize flag option, quote if needed.
 * @param  {String} flag
 * @return {String} empty string if invalid flag
 */
function getResizeFlag(flag) {
	if (resizeFlags.indexOf(flag) < 0) {
		return '';
	}

	return flag === '^' ? flag : '\\' + flag;
}

function pipeOrPath(obj, format) {
	format = format ? `${format}:` : '';
	const quoted = typeof obj === 'string' ? `"${obj}"` : obj;
	return typeof (obj.pipe) === 'function' ? `${format}-` : `${format}${quoted}`;
}

function ImageMagickCommands(opts) {
	opts = opts || {};
	this.executable = opts.executable || 'convert';
	this.inputOptions = [];
	this.commands = [];
	this.maxBuffer = opts.maxBuffer || 1024 * 1024 * 100;
	this.execOptions = opts.execOptions || {};
}

/**
 * Set gravity
 * See http://www.imagemagick.org/script/command-line-options.php#gravity for valid gravities.
 *
 * @param  {String} gravity
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.gravity = function (gravity) {
	if (gravities.indexOf(gravity) < 0) {
		return this;
	}

	this.commands.push('-gravity ' + gravity);
	return this;
};

/**
 * Resize, if only one param is supplied it will remain aspect ratio.
 * @param  {Object} opts {width, height, flag, gravity}
 * @param {String} opts.flag imagemagick resize flags (<,>,!,^)
 * @param {String} opts.gravity imagemagick gravity (NorthWest, North, NorthEast, West, Center, East, SouthWest, South, SouthEast)
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.resize = function (opts) {
	if (!opts.width && !opts.height) {
		return this;
	}
	const height = opts.height || '';
	const width = opts.width || '';
	const flag = opts.flag ? getResizeFlag(opts.flag) : '';

	this.commands.push(printf('-filter Catrom -resize %sx%s%s', width, height, flag));
	return this;
};

/**
 * Crop
 * @param  {Object} opts {width,height,x,y}
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.crop = function (opts) {
	if (!opts.width || !opts.height || !isNumber(opts.x) || !isNumber(opts.y)) {
		return this;
	}
	const x = opts.x >= 0 ? '+' + opts.x : opts.x;
	const y = opts.y >= 0 ? '+' + opts.y : opts.y;

	this.commands.push(printf('-crop %sx%s%s%s', opts.width, opts.height, x, y));
	return this;
};

/**
 * Extent
 * @param  {Object} opts {width, height}
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.extent = function (opts) {
	if (!opts.width || !opts.height) {
		return this;
	}
	this.commands.push(printf('-extent %sx%s', opts.width, opts.height));
	return this;
};

/**
 * Rotate
 * @param  {Object} opts {angle,x,y,bgColor?}
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.rotate = function (opts) {
	if (!opts.angle || !opts.x || !opts.y) {
		return this;
	}

	const bgColor = opts.bgColor ? '-background ' + opts.bgColor + ' -virtual-pixel background ' : '';
	this.commands.push(printf(
		'%s-distort ScaleRotateTranslate \'%s,%s %s\'',
		bgColor, opts.x, opts.y, opts.angle
	));
	return this;
};

/**
 * Sharpen
 * mode - available presets are [light,moderate,strong,extreme,variable,off]
 * width,height only needed if mode is variable
 * @param  {Object} opts {mode, width?, height?]
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.sharpen = function (opts) {
	let mode = opts.mode;

	if (Object.keys(sharpening).concat(['off', 'variable']).indexOf(mode) < 0) {
		return this;
	}

	if (mode === 'variable') {
		mode = getVariableMode(opts.width, opts.height);
	}

	if (mode === 'off' || !mode) {
		return this;
	}

	const radius = sharpening[mode][0];
	const amount = sharpening[mode][1];
	const threshold = sharpening[mode][2];
	const sigma = radius < 1 ? radius : Math.sqrt(radius);

	this.commands.push(printf('-unsharp %dx%d+%d+%d', radius, sigma, amount, threshold));
	return this;
};

/**
 * Quality
 * @param  {Number} quality
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.quality = function (quality) {
	if (!isNumber(quality)) {
		return this;
	}

	this.commands.push('-quality ' + quality);
	return this;
};

/**
 * Density
 * @param  {Number} density
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.density = function (density) {
	if (!isNumber(density)) {
		return this;
	}

	this.inputOptions.push('-density ' + density);
	return this;
};

/**
 * Strip
 * @return {ImageMagickCommands}
 */
ImageMagickCommands.prototype.strip = function () {
	this.commands.push('-strip');
	return this;
};

/**
 * Get the commandline string
 * @param {String} src
 * @param {String} dst
 * @param {String} [outputFormat]
 * @return {String}
 */
ImageMagickCommands.prototype.get = function (src, dst, outputFormat) {
	return [this.executable].concat(this.inputOptions, [pipeOrPath(src)], this.commands, [pipeOrPath(dst, outputFormat)]).join(' ');
};

/**
 * Execute the commands
 * @param  {String|Readable} src
 * @param  {String|Writeable} dst
 * @param {Object} [opts]
 * @param {Number} [opts.format] output format jpg, png
 * @param  {Function} [callback] optional for those that dont want promise.
 * @return {Promise}
 */
ImageMagickCommands.prototype.exec = function (src, dst, opts = {}, callback) {
	if (typeof (opts) === 'function') {
		callback = opts;
		opts = {};
	}

	debug('Executing', this.get(src, dst, opts.format));

	const execOpts = Object.assign(
		{ stdio: ['pipe', 'pipe'], maxBuffer: this.maxBuffer, encoding: 'binary' },
		this.execOptions
	);

	const promise = new Promise((resolve, reject) => {
		const shell = exec(this.get(src, dst, opts.format), execOpts, (err) => {
			if (err) {
				return reject(err);
			}

			resolve(dst);
		});

		if (typeof (src.pipe) === 'function') {
			src.pipe(shell.stdin);
		}

		if (typeof (dst.pipe) === 'function') {
			shell.stdout.pipe(dst);
		}
	});

	return promise.asCallback(callback);
};

module.exports = ImageMagickCommands;
