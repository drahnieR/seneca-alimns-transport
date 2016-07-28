var config = require('../config')
var seneca = require('seneca')()
.use('..')
.listen({
    type: 'alimns',
    pin: 'role:test',
    queueSuffix: 'dev',
    queueOptions: {
        DelaySeconds: 0,
        MaximumMessageSize: 65536,
        MessageRetentionPeriod: 345600,
        VisibilityTimeout: 30,
        PollingWaitSeconds: 0
    },
    accountId:        config.accountId,
    accessKeyId:      config.accessKeyId,
    accessKeySecret:  config.accessKeySecret
})
.ready(function(){
    console.log('Service Ready')
});

seneca.add('role:test,cmd:create', function(message, done) {
    console.log('========== CMD: CREATE ==========')
    return done(null, {
        random: Math.random()
    });
})
seneca.add('role:test,cmd:delete', function(message, done) {
    console.log('========== CMD: DELETE ==========')
    return done(null, {
        random: Math.random()
    });
})
seneca.add('role:test,cmd:delete,arg:hehe', function(message, done) {
    console.log('========== CMD: DELETE HEHE ==========')
    return done(null, {
        random: Math.random()
    });
})
