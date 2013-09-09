# node-imagickal

node wrapper for ImageMagick commands

[![Build Status](https://secure.travis-ci.org/martinj/node-imagickal.png)](http://travis-ci.org/martinj/node-imagickal)

## Installation

	npm install imagickal

## Examples

	var im = require('imagickal');

	//get image dimensions
	im.dimensions('image.jpg').then(function (dim) {
		console.log(dim.width);
		console.log(dim.height);
	});

	//get image dimensions and type
	im.identify('image.jpg').then(function (data) {
		console.log(data);
	});

	//transform image with action object,
	//actions is applied in the same order as they are recevied
	var actions =  {
		resize: { width: 100 },
		crop: { width: 10, height: 10, x: 10, y: 10 },
		quality: 90,
		strip: true
	};

	im.transform('src.jpg', 'dst.jpg', actions).then(function () {
		console.log('Done')
	});

	//transform image with command object
	im.commands()
		.resize({ width: 100 })
		.crop({ width: 10, height: 10, x: 10, y: 10 })
		.quality(90)
		.strip()
		.exec('src.jpg', 'dst.jpg').then(function () {
			console.log('done');
		});

## Available image actions / commands

- rotate Rotate image, properties { angle: 0, x: 0, y: 0 }
- crop - Crop image, properties { width: 2560, height: 1013, x: 0, y: 0 }
- resize - Resize image, properties { width: 470, height: 186 }
- sharpen - Sharepn image, properties { mode: 'variable' }, available modes are: light, moderate, strong, extreme, off.
- strip - Strip image of all profiles and comments.
- quality - Compression quality, defaults to 85.

## Run Tests

	npm test

## Enable debugging output

Set DEBUG environment variable to imagickal

	DEBUG=imagickal node ./app.js
