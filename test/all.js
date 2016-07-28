process.argv.push('--seneca.log.quiet')
var seneca = require('seneca')();
var should = require('chai').should();
var uuid = require('uuid');
var config = require('../config')

var server = require('seneca')()
    .use('..')
    .listen({
        type: 'alimns',
        pins: ['role:test1', 'role:test2'],
        accountId:        config.accountId,
        accessKeyId:      config.accessKeyId,
        accessKeySecret:  config.accessKeySecret
    });

server.add('role:test1,cmd:success', function(message, done) {
    done(null, {result: 1});
});

server.add('role:test1,cmd:error', function(message, done) {
    var error = new Error('error message');
    error.status = -1;
    done(error);
});

server.add('role:test1,cmd:success,arg:foo', function(message, done) {
    done(null, {result: 'foo'});
});

server.add('role:test2,cmd:success', function(message, done) {
    done(null, {result: 2});
});

client = require('seneca')()
    .use('..' )
    .client({
        type: 'alimns',
        pins: ['role:test1', 'role:test2'],
        accountId:        config.accountId,
        accessKeyId:      config.accessKeyId,
        accessKeySecret:  config.accessKeySecret
    });

before(function(done) {
    client.ready(function(err){
        done();
    });
});

describe('invokes', function() {
    describe('success', function() {
        it('should return message',function(done) {
            client.act('role:test1,cmd:success', function(err, msg) {
                msg.result.should.equal(1);
                done();
            });
        });
    });

    describe('error', function() {
        it('should return error',function(done) {
            client.act('role:test1,cmd:error', function(err, msg) {
                err.status.should.equal(-1);
                done();
            });
        });
    });

    describe('priority match', function() {
        it('should be routed correctly',function(done) {
            client.act('role:test1,cmd:success,arg:foo', function(err, msg) {
                msg.result.should.equal('foo');
                done();
            });
        });
    });

    describe('loose match', function() {
        it('should be routed correctly',function(done) {
            client.act('role:test1,cmd:error,arg:bar', function(err, msg) {
                err.status.should.equal(-1);
                done();
            });
        });
    });

    describe('multiple pin', function() {
        it('should be routed correctly', function(done) {
            client.act('role:test2,cmd:success', function(err, msg) {
                msg.result.should.equal(2);
                done();
            });
        });
    });
});
