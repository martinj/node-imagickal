'use strict';
const readChunk = require('read-chunk');
const fileType = require('file-type');

function is(file, extension) {
	const buffer = readChunk.sync(file, 0, fileType.minimumBytes);
	return fileType(buffer).ext === extension;
}

exports.isJPG = function (file) {
	return is(file, 'jpg');
};

exports.isPNG = function (file) {
	return is(file, 'png');
};
