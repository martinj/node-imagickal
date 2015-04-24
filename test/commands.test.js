'use strict';
var ImageMagickCommands = require('../lib/commands');
require('should');

describe('ImageMagickCommands', function () {
	beforeEach(function () {
		this.cmds = new ImageMagickCommands();
	});

	it('should be able to configure custom executable', function () {
		var cmds = new ImageMagickCommands({ executable: 'MAGICK_MEMORY_LIMIT=256MB /tmp/convert' });
		var cmd = cmds.get('src.jpg', 'dst.jpg');
		cmd.should.equal('MAGICK_MEMORY_LIMIT=256MB /tmp/convert src.jpg dst.jpg');
	});

	it('should apply commands in the same order as its called', function () {
		var cmd = this.cmds.strip()
			.quality(5)
			.crop({ width: 1, height: 2, x: 3, y: 4})
			.get('src.jpg', 'dst.jpg');

		cmd.should.equal('convert src.jpg -strip -quality 5 -crop 1x2+3+4 dst.jpg');
	});

	describe('#rotate', function () {
		it('should not apply when angle is 0', function () {
			var cmd = this.cmds.rotate({ angle: 0, x: 1, y: 2 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg dst.jpg');
		});

		it('should set background if supplied', function () {
			var cmd = this.cmds.rotate({ angle: 1, x: 1, y: 2, bgColor: 'blue' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -background blue -virtual-pixel background -distort ScaleRotateTranslate \'1,2 1\' dst.jpg');
		});
	});

	describe('#resize', function () {
		it('should not apply when if width or height is missing', function () {
			var cmd = this.cmds.resize({ flag: '!' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg dst.jpg');
		});

		it('should quote some flags', function () {
			var cmd = this.cmds.resize({ width: 10, flag: '>' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -filter Catrom -resize 10x\\> dst.jpg');

			this.cmds = new ImageMagickCommands();
			cmd = this.cmds.resize({ width: 10, flag: '^' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -filter Catrom -resize 10x^ dst.jpg');

		});

		it('should not set flag if invalid', function () {
			var cmd = this.cmds.resize({ width: 10, flag: 'f' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -filter Catrom -resize 10x dst.jpg');
		});

		it('should set gravity option', function () {
			var cmd = this.cmds.resize({ width: 10, flag: '^', gravity: 'Center' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -filter Catrom -resize 10x^ -gravity Center dst.jpg');
		});

		it('should not set gravity option if invalid', function () {
			var cmd = this.cmds.resize({ width: 10, flag: '^', gravity: 'Invalid' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -filter Catrom -resize 10x^ dst.jpg');
		});
	});

	describe('#sharpen', function () {
		it('should be ignored if mode is unknown', function () {
			var cmd = this.cmds.sharpen({ mode: 'foobar' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg dst.jpg');
		});

		it('should be ignored when mode is off', function () {
			var cmd = this.cmds.sharpen({ mode: 'off' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg dst.jpg');
		});

		it('should be ignored when mode is falsy', function () {
			var cmd = this.cmds.sharpen({ mode: 0 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg dst.jpg');
		});

		it('should be ignored when mode is variable and no width or height is specified', function () {
			var cmd = this.cmds.sharpen({ mode: 'variable' }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg dst.jpg');
		});

		it('should be choose preset when mode is variable', function () {
			var cmd = this.cmds.sharpen({ mode: 'variable', width: 250, height: 250 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -unsharp 0.65x0.65+1.1+0.05 dst.jpg');
		});
	});

	describe('#crop', function () {
		it('should handle positive x,y values', function () {
			var cmd = this.cmds.crop({ width: 100, height: 250, x: 10, y: 0 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -crop 100x250+10+0 dst.jpg');
		});

		it('should handle negative x,y values', function () {
			var cmd = this.cmds.crop({ width: 100, height: 250, x: -10, y: -12 }).get('src.jpg', 'dst.jpg');
			cmd.should.equal('convert src.jpg -crop 100x250-10-12 dst.jpg');
		});
	});
});
