'use strict';
var Promise = require('bluebird'),
	exec = require('child_process').exec,
	printf = require('util').format,
	debug = require('debug')('imagickal');

/**
 * Differet sharpening presets, values are (radius, amount, threshold)
 * @type {Object}
 */
var sharpening = {
	light: [0.5, 1, 0.05],
	moderate: [0.65, 1.1, 0.05],
	strong: [0.8, 1.2, 0.05],
	extreme: [1.0, 1.5, 0.00]
};

/**
 * Valid resize flags, http://www.imagemagick.org/Usage/resize/#noaspect
 * @type {Array}
 */
var resizeFlags = ['<', '>', '!', '^'];

/**
 * valid gravity values, http://www.imagemagick.org/script/command-line-options.php#gravity
 * @type {Array}
 */
var gravities = ['NorthWest', 'North', 'NorthEast', 'West', 'Center', 'East', 'SouthWest', 'South', 'SouthEast'];

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
	if (width <= 50 && height <= 50) {
		return 'extreme';
	}

	if (width <= 100 && height <= 100) {
		return 'strong';
	}

	if (width <= 300 && height <= 300) {
		return 'moderate';
	}

	if (width <= 500 && height <= 500) {
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

/**
 * Sanitize gravity option
 * @param {String} gravity
 * @return {String} empty string if invalid gravity
 */
function getGravity(gravity) {
	if (gravities.indexOf(gravity) < 0) {
		return '';
	}

	return ' -gravity ' + gravity;
}

function ImageMagickCommands(opts) {
	opts = opts || {};
	this.executable = opts.executable || 'convert';
	this.commands = [];
}

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
	var height = opts.height || '',
		width = opts.width || '',
		flag = opts.flag ? getResizeFlag(opts.flag) : '',
		gravity = opts.gravity ? getGravity(opts.gravity) : '';

	this.commands.push(printf('-filter Catrom -resize %sx%s%s%s', width, height, flag, gravity));
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
	var x = opts.x >= 0 ? '+' + opts.x : opts.x,
		y = opts.y >= 0 ? '+' + opts.y : opts.y;
	this.commands.push(printf('-crop %sx%s%s%s', opts.width, opts.height, x, y));
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

	var bgColor = opts.bgColor ? '-background ' + opts.bgColor + ' -virtual-pixel background ' : '';
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
	var mode = opts.mode;

	if (Object.keys(sharpening).concat(['off', 'variable']).indexOf(mode) < 0) {
		return this;
	}

	if (mode === 'variable') {
		mode = getVariableMode(opts.width, opts.height);
	}

	if (mode === 'off' || !mode) {
		return this;
	}

	var radius = sharpening[mode][0],
		amount = sharpening[mode][1],
		threshold = sharpening[mode][2],
		sigma = radius < 1 ? radius : Math.sqrt(radius);
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
 * @return {String}
 */
ImageMagickCommands.prototype.get = function (src, dst) {
	return [this.executable].concat([src], this.commands, [dst]).join(' ');
};

/**
 * Execute the commands
 * @param  {String} src
 * @param  {String} dst
 * @param  {Function} [callback] optional for those that dont want promise.
 * @return {Promise}
 */
ImageMagickCommands.prototype.exec = function (src, dst, callback) {
	var defer = Promise.defer();
	debug('Executing', this.get(src, dst));
	exec(this.get(src, dst), function (err) {
		if (err) {
			return defer.reject(err);
		}

		defer.resolve(dst);
	});

	return defer.promise.nodeify(callback);
};

module.exports = ImageMagickCommands;
