'use strict';
var Q = require('q'),
	exec = require('child_process').exec,
	ImageMagickCommands = require('./commands'),
	debug = require('debug')('imagickal');

/**
 * Get Dimensions from an image file
 * @param  {String}   path full path to the file
 * @return {Promise} resolved with {width:,height:}
 */
var dimensions = exports.dimensions = function (path) {
	var defer = Q.defer(),
		cmd = 'identify -format "%wx%h" ' + path;
	debug('dimensions', cmd);
	exec(cmd, function (err, stdout) {
		if (err) {
			return defer.reject(err);
		}

		var matches = /(\d+)x(\d+)/.exec(stdout.toString());
		if (!matches) {
			return defer.reject(new Error('Unable to parse dimensions from output: ' + stdout.toString()));
		}

		defer.resolve({ width: parseInt(matches[1], 10), height: parseInt(matches[2], 10) });
	});
	return defer.promise;
};

/**
 * Identify image format & dimensions on a image.
 * @param  {String} path
 * @return {Promise} - resolved with {format:, width:, height:}
 */
exports.identify = function (path) {
	var defer = Q.defer(),
		cmd = 'identify -format "{\\"format\\":\\"%m\\",\\"width\\":%w,\\"height\\":%h}" ' + path;
	debug('identify', cmd);
	exec(cmd, function (err, stdout) {
		if (err) {
			if (err.message.match(/decode delegate/)) {
				return defer.reject(new Error('Invalid image file'));
			}
			return defer.reject(err);
		}

		var data;
		try {
			data = JSON.parse(stdout.toString());
		} catch (e) {
			return defer.reject(new Error('Unable to parse identify data, output was:' + stdout.toString()));
		}

		if (!data) {
			return defer.reject(new Error('Unable to identify image, output was:' + stdout.toString()));
		}

		defer.resolve(data);
	});
	return defer.promise;
};

/**
 * Create new ImageMagickCommands instances
 * @return {ImageMagickCommands}
 */
var commands = exports.commands = function () {
	return new ImageMagickCommands();
};


/**
 * TRANSFORMATION
 */

var commandKeys = [ 'strip', 'quality', 'resize', 'rotate', 'sharpen', 'crop' ];

/**
 * Create ImageMagickCommands object and apply actions on it.
 * @param  {Object} actions
 * @return {ImageMagickCommands}
 */
function applyActions(actions) {
	var cmds = commands();
	Object.keys(actions).forEach(function (action) {
		if (commandKeys.indexOf(action) < 0) {
			return;
		}
		cmds[action](actions[action]);
	});
	return cmds;
}

/**
 * Calculate new dimensions on image after transformation based on its actions.
 * @param  {Object} actions
 * @param  {Integer} origWidth
 * @param  {Integer} origHeight
 * @return {Object} {width:, height:}
 */
function calculateNewDimensions(actions, origWidth, origHeight) {
	if (actions.resize.width && actions.resize.height) {
		return { width: actions.resize.width, height: actions.resize.height };
	}

	if (actions.resize.width) {
		return {
			width: actions.resize.width,
			height: Math.ceil(origHeight / origWidth * actions.resize.width)
		};
	}

	if (actions.resize.height) {
		return {
			width: Math.ceil(origWidth / origHeight * actions.height),
			height: actions.height
		};
	}

	if (actions.crop) {
		return { width: actions.crop.width, height: actions.crop.height };
	}

	return { width: origWidth, height: origHeight };
}

/**
 * Transform image
 * @param  {String} src
 * @param  {String} dst
 * @param  {Object} actions
 * @return {Promise} resolved promise with dst as value
 */
exports.transform = function (src, dst, actions) {
	if (actions.sharpen && actions.sharpen.mode === 'variable') {
		return dimensions(src).then(function (dim) {
			var newDim = calculateNewDimensions(actions, dim.width, dim.height),
				moddedActions = JSON.parse(JSON.stringify(actions));
			moddedActions.sharpen.width = newDim.width;
			moddedActions.sharpen.height = newDim.height;
			return applyActions(moddedActions).exec(src, dst);
		});
	} else {
		return applyActions(actions).exec(src, dst);
	}
};