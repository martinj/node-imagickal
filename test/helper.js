'use strict';
const readChunk = require('read-chunk');
const fileType = require('file-type');

module.exports.isJPG = function (file) {
	const buffer = readChunk.sync(file, 0, 4100);

	return fileType(buffer).ext === 'jpg';
};
