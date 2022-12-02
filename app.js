//import express.js 
var express = require('express');
//assign it to variable app 
var app = express();
//create a server and pass in app as a request handler
var serv = require('http').Server(app); //Server-11

var path = require("path");
__dirname = path.resolve();

//send a index.html file when a get request is fired to the given 
//route, which is ‘/’ in this case
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
//this means when a get request is made to ‘/client’, put all the 
//static files inside the client folder 
//Under ‘/client’. See for more details below

app.use('/client',express.static(__dirname + '/client'));

//listen on port 2000
serv.listen(process.env.PORT || 2000);
console.log("Server started.");

//this is where we will store all the players in the client,
// which is connected to the server
var player_lst = [];

// A player “class”, which will be stored inside player list 
var Player = function (startX, startY, startFacing) {
  var x = startX
  var y = startY
  var facing = startFacing
}

//onNewplayer function is called whenever a server gets a message “new_player” from the client
function onNewplayer (data) {
	//form a new player object 
	var newPlayer = new Player(data.x, data.y, data.facing);
	console.log("created new player with id " + this.id);
	player_lst.push(newPlayer); 

}

// when a new player connects, we make a new instance of the player object,
// and send a new player message to the client. 
function onNewplayer (data) {
	console.log(data);
	//new player instance
	var newPlayer = new Player(data.x, data.y, data.facing);
	console.log(newPlayer);
	console.log("created new player with id " + this.id);
    newPlayer.id = this.id; 	
    
	//information to be sent to all clients except sender
	var current_info = {
		id: newPlayer.id, 
		x: newPlayer.x,
		y: newPlayer.y,
		facing: newPlayer.facing,
	}; 
	
	//send to the new player about everyone who is already connected. 	
	for (i = 0; i < player_lst.length; i++) {
		existingPlayer = player_lst[i];
		var player_info = {
			id: existingPlayer.id,
			x: existingPlayer.x,
			y: existingPlayer.y, 
			facing: existingPlayer.facing,			
		};
		console.log("pushing player");
		//send message to the sender-client only
		this.emit("new_remotePlayer", player_info);
	}
	
	//send message to every connected client except the sender
	this.broadcast.emit('new_remotePlayer', current_info);
	
	player_lst.push(newPlayer); 

}

//update the player position and send the information back to every client except sender
function onMovePlayer (data) {
	var movePlayer = find_playerid(this.id); 
	movePlayer.x = data.x;
	movePlayer.y = data.y;
    movePlayer.facing = data.facing; 
    	
	var moveplayerData = {
		id: movePlayer.id,
		x: movePlayer.x,
		y: movePlayer.y, 
		facing: movePlayer.facing
	}
	
	//send message to every connected client except the sender
	this.broadcast.emit('remotePlayer_move', moveplayerData);
}

function onNewMessage (data) {
    var playerId = this.id;

    var current_info = {
        playerId: playerId, 
        message: data.message,
        ttl: data.ttl,
		x: data.x,
        y: data.y
    }; 
    
	//send message to every connected client except the sender
	this.broadcast.emit('new_remoteMessage', current_info);
}

//call when a client disconnects and tell the clients except sender to remove the disconnected player
function onClientdisconnect() {
	console.log('disconnect'); 

	var removePlayer = find_playerid(this.id); 
		
	if (removePlayer) {
		player_lst.splice(player_lst.indexOf(removePlayer), 1);
	}
	
	console.log("removing player " + this.id);
	
	//send message to every connected client except the sender
	this.broadcast.emit('remove_remotePlayer', {id: this.id});
	
}

// find player by the the unique socket id 
function find_playerid(id) {

	for (var i = 0; i < player_lst.length; i++) {

		if (player_lst[i].id == id) {
			return player_lst[i]; 
		}
	}
	
	return false; 
}


 // binds the serv object we created to socket.io
var io = require('socket.io')(serv,{});

// listen for a connection request from any client
io.sockets.on('connection', function(socket){
	console.log("socket connected"); 
	//output a unique socket.id 
    console.log(socket.id);

    socket.on('disconnect', onClientdisconnect); 
    socket.on("new_player", onNewplayer);
    socket.on("move_player", onMovePlayer);
    socket.on("new_message", onNewMessage);
});