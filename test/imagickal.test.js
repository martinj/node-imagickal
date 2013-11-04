'use strict';
var Q = require('q'),
	ImagickCommands = require('../lib/commands'),
	im = require(__dirname + '/../');
require('should');

var imageFile = __dirname + '/fixtures/small.jpg';
describe('Imagick', function () {
	describe('#dimensions', function () {
		it('should return dimensions', function (done) {
			im.dimensions(imageFile).then(function (dim) {
				dim.width.should.equal(13);
				dim.height.should.equal(10);
				done();
			}).done();
		});
	});

	describe('#identify', function () {
		it('should return data in as an object', function (done) {
			im.identify(imageFile).then(function (data) {
				data.should.eql({ format: 'JPEG', width: 13, height: 10 });
				done();
			}).done();
		});
	});

	describe('#transform', function () {
		beforeEach(function () {
			this.exec = ImagickCommands.prototype.exec;
			ImagickCommands.prototype.exec = function (src, dst) {
				return Q.resolve(this.commands);
			};
		});

		afterEach(function () {
			ImagickCommands.prototype.exec = this.exec;
		});

		it('should create commands in order on transform', function (done) {
			var expected = [
				'-quality 10',
				'-strip',
				'-unsharp 0.8x0.8+1.2+0.05',
				'-filter Catrom -resize 100x',
				'-crop 10x12+1+2'
			];

			im.transform(imageFile, 'dst.jpg', {
				quality: 10,
				strip: true,
				sharpen: { mode: 'variable' },
				resize: { width: 100 },
				crop: { width: 10, height: 12, x: 1, y: 2 },
				rotate: { angle: 20 }
			}).then(function (commands) {
				commands.should.eql(expected);
				done();
			}).done();
		});
	});
});