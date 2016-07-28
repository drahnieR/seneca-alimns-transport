'use strict';

const PLUGIN_NAME = 'alimns-transport';

var _ = require('lodash');
var AliMNS = require("ali-mns");

module.exports = function(opts) {
    var seneca = this;
    var so = seneca.options();

    // transport default settings
    var options = seneca.util.deepextend({
        alimns: {
            region: 'hangzhou',
            waitSeconds: 30
        }
    }, so.transport, opts);

    var tu = seneca.export('transport/utils')

    seneca.add({ role: 'transport', hook: 'listen', type: 'alimns' }, hookListenAliMNS);
    seneca.add({ role: 'transport', hook: 'client', type: 'alimns' }, hookClientAliMNS);

    function hookListenAliMNS(args, done) {
        var seneca = this
        var type = args.type
        // merge transport default options
		var listenOptions = seneca.util.clean(_.extend({}, options[type], args))
        var account = new AliMNS.Account(
            listenOptions.accountId,
            listenOptions.accessKeyId,
            listenOptions.accessKeySecret
        );
        var mns = new AliMNS.MNS(account, listenOptions.region)

		seneca.log.info('listen', 'open', listenOptions, seneca)

        // find queues to listen to
        var pins = tu.resolve_pins(args)
        
        var queues = []
        if (pins) {
            pins.forEach(function(pin) {
                var sb = [tu._msgprefix]
                _.each(_.keys(pin).sort(), function (key) {
                    sb.push(key, pin[key])
                })
                if (listenOptions.queueSuffix)
                    sb.push(listenOptions.queueSuffix)
                var queue = sb.join('-').replace(/[^a-zA-Z\d\-]+/g, '')
                queues.push(queue)
            })
        }
        else {
            queues.push('any')
        }

        _.forOwn(queues, function(queue) {
            var requestMq = new AliMNS.MQ(
                queue,
                account,
                listenOptions.region
            )
            seneca.log.info('connecting MQ: ' + queue)

            mns.createP(queue, listenOptions.queueOptions).then(
                startListening, 
                function(res) {
                    setTimeout(function() { throw new Error(res.Error.Message) })
                }
            )

            function startListening(res) {
                requestMq.notifyRecv(function(err, request) {
                    if (err) throw err;

                    seneca.log.info('Request received')
                    console.log(request)    // seneca truncates the log string
                    var reqMsg = tu.parseJSON(seneca, 'listen-' + type, request.Message.MessageBody)

                    var respMq = new AliMNS.MQ(
                        'seneca-client-' + reqMsg.clientId,
                        account,
                        listenOptions.region
                    )

                    tu.handle_request(seneca, reqMsg, listenOptions, function(resp) {
                        // delete message after processing
                        requestMq.deleteP(request.Message.ReceiptHandle).then(
                            function(res) {
                                seneca.log.info('Message deleted:(' + res + '):' + request.Message.ReceiptHandle)
                            },
                            seneca.log.error
                        )

                        // there may be no result!
                        if (null == resp) return

                        // send response
                        var respMsg = tu.stringifyJSON(seneca, 'listen-' + type, resp)
                        respMq.sendP(respMsg).then(
                            function(res) {
                                seneca.log.info('Response sent(' + res + ')')
                                console.log(respMsg)
                            },
                            seneca.log.error
                        )
                    })

                    // not delete the received message here
                    return false
                }, 5, 1)
            }

            seneca.add('role:seneca,cmd:close', function(args, done) {
                requestMq.notifyStopP().then(
                    function(res) {
                        seneca.log.info('Service stopped(' + res + ')')
                    },
                    seneca.log.error
                )
                this.prior(args, done)
            })
        })

        done()
    }

    function hookClientAliMNS(args, client_done) {
        var seneca = this
        var type = args.type
        // merge transport default options
        var clientOptions = seneca.util.clean(_.extend({}, options[type], args))

        var account = new AliMNS.Account(
            clientOptions.accountId,
            clientOptions.accessKeyId,
            clientOptions.accessKeySecret
        );
        var mns = new AliMNS.MNS(account, clientOptions.region)
        var clientMqName = 'seneca-client-' + clientOptions.id 

        var responseMq = new AliMNS.MQ(
            clientMqName,
            account,
            clientOptions.region
        );
        mns.createP(clientMqName).then(function(result){
            seneca.log.info('Client MQ ' + clientMqName + ' created (' + result + ')')

            responseMq.notifyRecv(function(err, response) {
                if (err) throw err;

                seneca.log.info('Response received')
                console.log(response)   // seneca truncates log string
                var respMsg = tu.parseJSON(seneca, 'client-' + type, response.Message.MessageBody)

                if (respMsg.error) {
                    respMsg.error.input = respMsg.input
                }

                tu.handle_response(seneca, respMsg, clientOptions)

                // ack receiving as there's no chance to callback after handle_response()
                return true
            })

            tu.make_client( make_send, clientOptions, client_done )

            // make_send is called per topic
            // not sure what @spec is here, seems that only {} or undefined will be passed in
            function make_send( spec, topic, send_done ) {
                var reqMqName = topic.replace(/_/g, '-');
                if (clientOptions.queueSuffix)
                    reqMqName += clientOptions.queueSuffix
                else
                    reqMqName = reqMqName.slice(0, -1)

                var requestMq = new AliMNS.MQ(
                    reqMqName,
                    account,
                    clientOptions.region
                );
                seneca.log.info('connecting MQ: ' + reqMqName)

                send_done( null, function( args, done ) {

                    // create message JSON
                    var request = tu.prepare_request( seneca, args, done )
                    request.clientId = clientOptions.id
                    var reqMsg = tu.stringifyJSON(seneca, 'client-alimns', request)

                    requestMq.sendP(reqMsg).then(
                        function(res) {
                            seneca.log.info('Request sent(' + res + ')')
                            console.log(reqMsg)
                        },
                        seneca.log.error
                    )
                })
            }
        }, seneca.log.error)

        seneca.add('role:seneca,cmd:close', function (close_args, done) {
            responseMq.notifyStopP().then(
                function(res) {
                    seneca.log.info('Client stopped(' + res + '): ' + clientOptions.id)
                },
                seneca.log.error
            )
            mns.deleteP(clientMqName)
            this.prior(close_args, done)
        })
    }

    return {
        name: PLUGIN_NAME
    };
};
