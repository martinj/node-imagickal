'use strict';
var Promise = require('bluebird'),
	ImagickCommands = require('../lib/commands'),
	im = require(__dirname + '/../');
require('should');

var imageFile = __dirname + '/fixtures/small.jpg',
	animImage = __dirname + '/fixtures/anim.gif';

describe('Imagick', function () {
	describe('#setDefaults', function () {
		afterEach(function () {
			im.setDefaults({});
		});

		it('should use global defaults', function () {
			im.setDefaults({ executable: 'foobar' });
			im.commands().get('a', 'b').should.equal('foobar a b');
		});

		it('should ignore global defaults if options is passed to commands()', function () {
			im.setDefaults({ executable: 'foobar' });
			im.commands({ executable: 'monkey' }).get('a', 'b').should.equal('monkey a b');
		});
	});

	describe('#dimensions', function () {
		it('should return dimensions', function (done) {
			im.dimensions(imageFile).then(function (dim) {
				dim.width.should.equal(13);
				dim.height.should.equal(10);
				dim.images.should.equal(1);
				done();
			}).done();
		});

		it('should accept callback function', function (done) {
			im.dimensions(animImage, function (err, dim) {
				dim.width.should.equal(64);
				dim.height.should.equal(64);
				dim.images.should.equal(2);
				done();
			});
		});
	});

	describe('#identify', function () {
		it('should return data in as an object', function (done) {
			im.identify(imageFile).then(function (data) {
				data.should.eql({ format: 'jpg', width: 13, height: 10, images: 1 });
				done();
			}).done();
		});

		it('should accept callback function', function (done) {
			im.identify(animImage, function (err, data) {
				if (err) {
					return done(err);
				}
				data.should.eql({ format: 'gif', width: 64, height: 64, images: 2 });
				done();
			});
		});
	});

	describe('#transform', function () {
		describe('callback function', function () {
			beforeEach(function () {
				this.get = ImagickCommands.prototype.get;
				ImagickCommands.prototype.get = function (src, dst) {
					return 'echo';
				};
			});

			afterEach(function () {
				ImagickCommands.prototype.get = this.get;
			});


			it('should accept callback function', function (done) {
				im.transform(imageFile, 'dst.jpg', { strip: true }, function (err, dst) {
					dst.should.equal('dst.jpg');
					done();
				});
			});
		});

		describe('command order', function () {
			beforeEach(function () {
				this.exec = ImagickCommands.prototype.exec;
				ImagickCommands.prototype.exec = function (src, dst) {
					return Promise.resolve(this.commands);
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
					'-filter Catrom -resize 100x\\!',
					'-crop 10x12+1+2'
				];

				im.transform(imageFile, 'dst.jpg', {
					quality: 10,
					strip: true,
					sharpen: { mode: 'variable' },
					resize: { width: 100, flag: '!' },
					crop: { width: 10, height: 12, x: 1, y: 2 },
					rotate: { angle: 20 }
				}).then(function (commands) {
					commands.should.eql(expected);
					done();
				}).done();
			});
		});
	});
});