var config = require('../config')
var client = require('seneca')()
.use('..' )
.client({
    type: 'alimns',
    pins: ['role:test'],
    queueSuffix: 'dev',
    accountId:        config.accountId,
    accessKeyId:      config.accessKeyId,
    accessKeySecret:  config.accessKeySecret
})
.ready(function(err){
    if (err) {
        console.log('Client failed to start')
        console.log(err)
        return
    }
    console.log('Client ready')
});

client.act('role:test,cmd:create', {
    msg: new Date().toString()
}, function(err, res) {
    console.log('========== CMD: CREATE ==========')
    console.log(res)
})
client.act('role:test,cmd:delete,arg:hehe', {
    msg: new Date().toString()
}, function(err, res) {
    console.log('========== CMD: DELETE HEHE ==========')
    console.log(res)
})
client.act('role:test,cmd:delete', {
    msg: new Date().toString()
}, function(err, res) {
    console.log('========== CMD: DELETE ==========')
    console.log(res)
})
client.act('role:test,cmd:create', {
    msg: new Date().toString()
}, function(err, res) {
    console.log('========== CMD: CREATE ==========')
    console.log('act callback: ' + err + ' / ' + res)
})
