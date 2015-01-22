/*
 * SETUP environment vars for application in Heroku
 * 
 * Twilio SID and TOKEN can be found here: https://www.twilio.com/user/account/
 * heroku config:set TWILIO_SID=Azzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
 * heroku config:set TWILIO_TOKEN=Azzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
 */

/*
 * These vars are your accountSid and authToken from twilio.com/user/account
 */
var accountSid = process.env.TWILIO_SID;
var authToken = process.env.TWILIO_TOKEN;
var twilio = require('twilio')(accountSid, authToken);

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var redis = require('redis');
var redisURL = url.parse(process.env.REDISCLOUD_URL);
var credis = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
client.auth(redisURL.auth.split(":")[1]);
var compress = require('compression')();

io.set('origins', '*:*');

app.use(compress);
app.disable('x-powered-by');

app.use(function(req, res, next) {

	console.log("adding headers allow-origin");
	res.setHeader('Access-Control-Allow-Origin', "*:*");
	res.setHeader('Access-Control-Allow-Methods',
			'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers',
			'X-Requested-With,content-type');
	next();
});

io.sockets.on('connection', function(socket) {

	console.log("got connection from socket " + socket.id);

	/*
	 * Event: register
	 * 
	 * Description: listen to each socket (agent) registered in the agent php
	 * application and connect agent to the queue if there are calls waiting
	 */
	socket.on('register', function(id) {

		var curdate = (new Date).getTime();
		console.log(curdate + ": got register event from client with id = "
				+ id + ". Socket id: " + socket.id);

		/*
		 * send ready signal to notify agent that (s)he is able to accept calls
		 */
		console.log("new client (id=" + id + ") logged in at " + curdate
				+ ". Socket id: " + socket.id);
		socket.emit('ready');

		/*
		 * add agent to the redis sorted list to be able to easily get the agent
		 * with greatest idle time
		 */
		var ags = [ 'agents_set', curdate, socket.id ];
		credis.zadd(ags, function(err, response) {
			console.log('saved agent in the redis sorted list: socketID='
					+ socket.id + ' ts=' + curdate);
			if (err)
				throw err;
		});

		/*
		 * if there are any queues with size > 0 find the queue with highest
		 * average wait time
		 */
		console.log('going to find queue with max idle time...');

		twilio.queues.list(function(err, data) {

			if (err)
				throw err;

			var maxWaitTime = 0;
			var queue_max = '';
			var qcnt = 0;

			console.log('There are ' + data.queues.length
					+ ' queues, looping...');

			data.queues.forEach(function(queue) {

				console.log('Looping through queues: ' + queue.friendlyName
						+ ', sid: ' + queue.sid + ', size: '
						+ queue.currentSize + ', average wait time: '
						+ queue.averageWaitTime);

				if (queue.currentSize != 0) {

					if (queue.averageWaitTime > maxWaitTime) {

						console.log('Found queue with max idle time');
						maxWaitTime = queue.averageWaitTime;
						queue_max = queue.friendlyName;
					}
					qcnt++;
				}
			});

			console.log('There are ' + qcnt
					+ ' active queues, maximum wait time is ' + maxWaitTime
					+ ' in queue ' + queue_max);

			/*
			 * Send request to agent to pick a call from the found queue
			 */
			if (maxWaitTime > 0) {
				io.sockets.connected[socket.id]
						.emit('call to queue', queue_max);
			}
		});
	});

	/*
	 * Event: Deregister event.
	 * 
	 * Description: if agent gone offline or oncall, deregister the agent's
	 * station/socket, remove socket id from redis
	 */
	socket.on('deregister', function(id) {

		var ags = [ 'agents_set', socket.id ];
		credis.zrem(ags, function(err, response) {
			console.log('removed an agent from redis sorted list: socketID='
					+ socket.id);
			if (err)
				throw err;
		});
	});

	/*
	 * Event: incoming call in queue
	 * 
	 * Description: listen on new incoming call in queue event emitted from
	 * caller.php. Find agent with longest idle time and return agent`s socket
	 */
	socket.on("incoming call in queue", function(queueID) {

		console.log("got new call in queue " + queueID + " from " + socket.id);

		var agent_id;
		var ags = [ 'agents_set', '+inf', '-inf' ];
		credis.zrevrangebyscore(ags, function(err, response) {
			if (err)
				throw err;

			console.log('error occured: ', err);
			agent_id = response[response.length - 1];

			console.log('get agent with longest idle time from agents_set: ',
					agent_id);

			if (agent_id != 'undefined')
				io.sockets.connected[agent_id].emit('call to queue', queueID);
		});
	});

	/*
	 * Event: missed queue call
	 * 
	 * Description: if agent didn't pickup/accept the incoming call presented
	 * then agent php application emits 'missed queue call' event. We re-rank
	 * this agent in the redis by removing and adding with a new timestamp. And
	 * then we try to find the next agent with longest idle time.
	 */
	socket.on("missed queue call", function(queueID) {

		console.log("got message that agent missed call in queue " + queueID
				+ "; Agent: " + socket.id);

		var curdate = (new Date).getTime();

		/*
		 * remove agent from redis
		 */
		var ags = [ 'agents_set', socket.id ];
		credis.zrem(ags, function(err, response) {
			if (err)
				throw err;

			console.log('removed an agent from redis sorted list: socketID='
					+ socket.id);
		});

		/*
		 * add agent to redis with a new (current) timestamp
		 */
		ags = [ 'agents_set', curdate, socket.id ];
		credis.zadd(ags, function(err, response) {
			if (err)
				thro1w
			err;

			console.log('saved agent in the redis sorted list: socketID='
					+ socket.id + ' ts=' + curdate);
		});

		/*
		 * find agent with longest idle time and return agent`s socket
		 */
		var agent_id;
		var ags = [ 'agents_set', '+inf', '-inf' ];
		credis.zrevrangebyscore(ags, function(err, response) {
			if (err)
				throw err;

			agent_id = response[response.length - 1];
			console.log('get agent with longest idle time from agents_set: ',
					agent_id);

			if (agent_id != 'undefined')
				io.sockets.connected[agent_id].emit('call to queue', queueID);
		});
	});

	/*
	 * Event: disconnect
	 * 
	 * Description: if agent closed the application (browser window), then
	 * remove the socket from redis
	 */
	socket.on('disconnect', function() {

		console.log('agent ' + socket.id + ' disconnected');

		var ags = [ 'agents_set', socket.id ];
		credis.zrem(ags, function(err, response) {
			if (err)
				throw err;

			console.log('removed an agent from redis sorted list: socketID='
					+ socket.id);
		});
	});

});

function findAgent_and_sendNotification() {

	// find agent with longest idle time and return agent`s socket
	var agent_id;
	var ags = [ 'agents_set', '+inf', '-inf' ];
	credis.zrevrangebyscore(ags, function(err, response) {
		if (err)
			throw err;

		console.log('get agent with longest idle time from agents_set: ',
				response[response.length - 1]);

		agent_id = response[response.length - 1];
	});
	return agent_id;
}

/*
 * setup server to listen on connections, the heroku approved way of doing this
 */
server.listen(process.env.PORT || 5000);