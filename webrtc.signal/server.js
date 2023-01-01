var app = require('express')();
var port = process.env.SocketIO_PORT || '9000';

var server = require('http').Server(app);
var io = require('socket.io')(server);
server.listen(port);

io.on('connection', function (socket) {
    socket.emit('connected', { 'sessionID': socket.id });

    socket.on('join', address => {
        console.log('join', address);
        socket.join(address);
    });

    socket.on('message', payload => {
        console.log('message', payload.signal, 'from', payload.from, 'to', payload.to);
        io.to(payload.to).emit('message', payload);
    });

    socket.on('disconnect', function (data) {
        console.log('disconnect', data);
    });
});
