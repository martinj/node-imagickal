'use strict';
var im = require(__dirname + '/../');
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
});