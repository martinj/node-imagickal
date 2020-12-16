'use strict';
const fs = require('fs');
const stream = require('stream');
const Readable = stream.Readable;
const Writeable = stream.Writable;
const ImageMagickCommands = require('../lib/commands');
const { isJPG, isPNG } = require('./helper');

const imageFile = __dirname + '/fixtures/small.jpg';

require('should');

describe('ImageMagickCommands', () => {
	it('should be able to configure custom executable', () => {
		const cmds = new ImageMagickCommands({ executable: 'MAGICK_MEMORY_LIMIT=256MB /tmp/convert' });
		const cmd = cmds.get('src.jpg', 'dst.jpg');
		cmd.should.equal('MAGICK_MEMORY_LIMIT=256MB /tmp/convert "src.jpg" "dst.jpg"');
	});

	it('should apply commands in the same order as its called', () => {
		const cmds = new ImageMagickCommands();
		const cmd = cmds.strip()
			.quality(5)
			.crop({ width: 1, height: 2, x: 3, y: 4 })
			.get('src.jpg', 'dst.jpg');

		cmd.should.equal('convert "src.jpg" -strip -quality 5 -crop 1x2+3+4 "dst.jpg"');
	});

	describe('#rotate', () => {
		it('should not apply when angle is 0', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.rotate({ angle: 0, x: 1, y: 2 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" "dst.jpg"');
		});

		it('should set background if supplied', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.rotate({ angle: 1, x: 1, y: 2, bgColor: 'blue' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -background blue -virtual-pixel background -distort ScaleRotateTranslate \'1,2 1\' "dst.jpg"');
		});
	});

	describe('#resize', () => {
		it('should not apply when if width or height is missing', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.resize({ flag: '!' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" "dst.jpg"');
		});

		it('should quote some flags', () => {
			let cmds = new ImageMagickCommands();
			let cmd = cmds.resize({ width: 10, flag: '>' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -filter Catrom -resize 10x\\> "dst.jpg"');

			cmds = new ImageMagickCommands();
			cmd = cmds.resize({ width: 10, flag: '^' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -filter Catrom -resize 10x^ "dst.jpg"');

		});

		it('should not set flag if invalid', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.resize({ width: 10, flag: 'f' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -filter Catrom -resize 10x "dst.jpg"');
		});
	});

	describe('#gravity', () => {
		it('should set gravity option', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.gravity('Center').get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -gravity Center "dst.jpg"');
		});

		it('should not set gravity option if invalid', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.gravity('Invalid').get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" "dst.jpg"');
		});
	});

	describe('#sharpen', () => {
		it('should be ignored if mode is unknown', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.sharpen({ mode: 'foobar' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" "dst.jpg"');
		});

		it('should be ignored when mode is off', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.sharpen({ mode: 'off' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" "dst.jpg"');
		});

		it('should be ignored when mode is falsy', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.sharpen({ mode: 0 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" "dst.jpg"');
		});

		it('should be ignored when mode is variable and no width or height is specified', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.sharpen({ mode: 'variable' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" "dst.jpg"');
		});

		it('should be choose preset when mode is variable', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.sharpen({ mode: 'variable', width: 250, height: 250 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -unsharp 0.65x0.65+1.1+0.05 "dst.jpg"');
		});
	});

	describe('#crop', () => {
		it('should handle positive x,y values', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.crop({ width: 100, height: 250, x: 10, y: 0 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -crop 100x250+10+0 "dst.jpg"');
		});

		it('should handle negative x,y values', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.crop({ width: 100, height: 250, x: -10, y: -12 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -crop 100x250-10-12 "dst.jpg"');
		});
	});

	describe('#density', () => {
		it('should support variable density', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.density(300).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert -density 300 "src.jpg" "dst.jpg"');
		});
	});

	describe('#extent', () => {
		it('should be ignored if width or height is not set', () => {
			const cmds = new ImageMagickCommands();
			const widthCmd = cmds.extent({ width: 100 }).get('src.jpg', 'dst.jpg');
			const heightCmd = cmds.extent({ height: 100 }).get('src.jpg', 'dst.jpg');
			widthCmd.should.equal('convert "src.jpg" "dst.jpg"');
			heightCmd.should.equal('convert "src.jpg" "dst.jpg"');
		});

		it('should be applied if both width and height are present', () => {
			const cmds = new ImageMagickCommands();
			const cmd = cmds.extent({ width: 100, height: 200 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert "src.jpg" -extent 100x200 "dst.jpg"');
		});
	});

	describe('#exec', () => {
		beforeEach(() => {
			try {
				fs.unlinkSync('test.jpg'); // eslint-disable-line no-sync
			} catch (e) {}
		});

		it('should run commands', () => {
			const cmds = new ImageMagickCommands();
			return cmds
				.strip()
				.exec(imageFile, 'test.jpg')
				.then(() => {
					isJPG('test.jpg').should.be.true();
				});
		});

		it('should support outputFormat', async () => {
			const cmds = new ImageMagickCommands();
			await cmds.strip().exec(imageFile, 'test.jpg', { format: 'png' });
			isPNG('test.jpg').should.be.true();
		});

		it('should support outputFormat using streams', async () => {
			const cmds = new ImageMagickCommands();
			await cmds.exec(fs.createReadStream(imageFile), fs.createWriteStream('test.jpg', { encoding: 'binary' }), { format: 'png' });
			isPNG('test.jpg').should.be.true();
		});

		it('should support streams', () => {
			const cmds = new ImageMagickCommands();
			return cmds
				.strip()
				.exec(fs.createReadStream(imageFile), fs.createWriteStream('test.jpg', { encoding: 'binary' }))
				.then(() => {
					isJPG('test.jpg').should.be.true();
				});
		});

	});

	describe('#get', () => {
		it('should replace path with - for src and if streams are used', () => {
			const cmds = new ImageMagickCommands();
			const dst = new Writeable();
			const src = new Readable();
			cmds.get(src, dst).should.equal('convert - -');
		});
	});
});
