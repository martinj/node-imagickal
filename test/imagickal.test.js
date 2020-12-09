'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const ImagickCommands = require('../lib/commands');
const im = require(__dirname + '/../');
const isJPG = require('./helper').isJPG;

require('should');

const imageFile = __dirname + '/fixtures/small.jpg';
const animImage = __dirname + '/fixtures/anim.gif';
const svgFile = __dirname + '/fixtures/small.svg';

describe('Imagick', () => {
	describe('#setDefaults', () => {
		afterEach(() => {
			im.setDefaults({});
		});

		it('should use global defaults', () => {
			im.setDefaults({ executable: 'foobar' });
			im.commands().get('a', 'b').should.equal('foobar a b');
		});

		it('should ignore global defaults if options is passed to commands()', () => {
			im.setDefaults({ executable: 'foobar' });
			im.commands({ executable: 'monkey' }).get('a', 'b').should.equal('monkey a b');
		});
	});

	describe('#dimensions', () => {
		it('should support streams', () => {
			return im
				.dimensions(fs.createReadStream(imageFile))
				.then((dim) => {
					dim.width.should.equal(13);
					dim.height.should.equal(10);
					dim.images.should.equal(1);
				});
		});

		it('should return dimensions', () => {
			return im
				.dimensions(imageFile)
				.then((dim) => {
					dim.width.should.equal(13);
					dim.height.should.equal(10);
					dim.images.should.equal(1);
				});
		});

		it('should accept callback function', (done) => {
			im.dimensions(animImage, (err, dim) => {
				if (err) {
					return done(err);
				}

				dim.width.should.equal(64);
				dim.height.should.equal(64);
				dim.images.should.equal(2);
				done();
			});
		});
	});

	describe('#identify', () => {
		it('should support streams', () => {
			return im
				.identify(fs.createReadStream(imageFile))
				.then((data) => {
					data.should.eql({ format: 'jpg', width: 13, height: 10, images: 1 });
				});
		});

		it('should return data in as an object', () => {
			return im
				.identify(imageFile)
				.then((data) => {
					data.should.eql({ format: 'jpg', width: 13, height: 10, images: 1 });
				});
		});

		it('should support extra format options', () => {
			return im
				.identify(imageFile, { format: { orient: '%[orientation]' } })
				.then((data) => {
					data.should.eql({ format: 'jpg', width: 13, height: 10, images: 1, orient: 'TopLeft' });
				});
		});

		it('should accept callback function', (done) => {
			im.identify(animImage, (err, data) => {
				if (err) {
					return done(err);
				}
				data.should.eql({ format: 'gif', width: 64, height: 64, images: 2 });
				done();
			});
		});
	});

	describe('#transform', () => {
		describe('callback function', () => {
			beforeEach(() => {
				this.get = ImagickCommands.prototype.get;
				ImagickCommands.prototype.get = function () {
					return 'echo';
				};
			});

			afterEach(() => {
				ImagickCommands.prototype.get = this.get;
			});


			it('should accept callback function', (done) => {
				im.transform(imageFile, 'dst.jpg', { strip: true }, (err, dst) => {
					if (err) {
						return done(err);
					}

					dst.should.equal('dst.jpg');
					done();
				});
			});
		});

		describe('svg', () => {
			it('should convert svg to jpg', async () => {
				const dst = await im.transform(svgFile, 'dst.jpg', {});
				dst.should.equal('dst.jpg');
				const dimensions = await im.identify(dst);
				dimensions.should.match({
					format: 'jpg',
					width: 534,
					height: 544
				});
			});

			it('should convert svg to png', async () => {
				const dst = await im.transform(svgFile, 'dst.png', {});
				dst.should.equal('dst.png');
				const dimensions = await im.identify(dst);
				dimensions.should.match({
					format: 'png',
					width: 534,
					height: 544
				});
			});

			it('should support variable density', async () => {
				const small = await im.transform(svgFile, 'dst.png', { density: 50 });
				const smallDims = await im.identify(small);

				const large = await im.transform(svgFile, 'dst.png', { density: 150 });
				const largeDims = await im.identify(large);

				smallDims.height.should.be.lessThan(largeDims.height);
				smallDims.width.should.be.lessThan(largeDims.width);
			});
		});

		describe('#transform', () => {
			beforeEach(() => {
				try {
					fs.unlinkSync('test.jpg'); // eslint-disable-line no-sync
				} catch (e) {}
			});

			it('should support streams', () => {
				return im
					.transform(fs.createReadStream(imageFile), fs.createWriteStream('test.jpg', { encoding: 'binary' }), {
						quality: 10,
						strip: true,
						sharpen: { mode: 'variable' }
					})
					.then(() => {
						isJPG('test.jpg').should.be.true();
					});
			});
		});

		describe('command order', () => {
			beforeEach(() => {
				this.exec = ImagickCommands.prototype.exec;
				ImagickCommands.prototype.exec = function () {
					return Promise.resolve(this.commands);
				};
			});

			afterEach(() => {
				ImagickCommands.prototype.exec = this.exec;
			});

			it('should ignore invalid actions', () => {
				return im
					.transform('src.jpg', 'dst.jpg', {
						quality: 10,
						exec: 'no',
						foobar: 'monkey'
					})
					.then((commands) => {
						commands.should.eql(['-quality 10']);
					});
			});

			it('should create commands in order on transform', () => {
				const expected = [
					'-quality 10',
					'-strip',
					'-unsharp 0.8x0.8+1.2+0.05',
					'-filter Catrom -resize 100x\\!',
					'-crop 10x12+1+2'
				];

				return im
					.transform(imageFile, 'dst.jpg', {
						quality: 10,
						strip: true,
						sharpen: { mode: 'variable' },
						resize: { width: 100, flag: '!' },
						crop: { width: 10, height: 12, x: 1, y: 2 },
						rotate: { angle: 20 }
					})
					.then((commands) => {
						commands.should.eql(expected);
					});
			});
		});
	});
});
