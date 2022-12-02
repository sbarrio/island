//CONST
var TILE_WIDTH = 32;
var SCR_TILES_WIDTH = 10;    //320 / 32 = 10
var SCR_TILES_HEIGHT = 7;    //224 / 32 = 7
var SCR_WIDTH = 320;
var SCR_HEIGHT = 224;
var PLAYER_SPEED = 100;

var game = new Phaser.Game(SCR_WIDTH, SCR_HEIGHT, Phaser.AUTO, 'gameHolder', { preload: preload, create: create, update: update });

function preload() {
    game.load.spritesheet('player', 'client/res/sprite/orange_cowboy.png', 24, 24);
    game.load.spritesheet('remotePlayer', 'client/res/sprite/blue_cowboy.png', 24, 24);
    game.load.tilemap('world', 'client/res/map/world.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('tileset', 'client/res/map/tileset.png', TILE_WIDTH, TILE_WIDTH);
}

    //Globals

//World
var map;
var worldLayer;
var collisionLayer;

//Player
var player;

//Input
var cursors;
var enterKey;
var escKey;
var isTyping = false;
var keyboardcooldown = 0;

//Camera
var movingCamera = false;

//Network
var socket; 

//Remote players
var players = [];
var playersGroup;

//Messages
var remoteMessages = [];
var localMessages = [];
var messageGroup;


function create() {

    // Set scale and crisp rendering
    game.scale.scaleMode = Phaser.ScaleManager.USER_SCALE;
    game.scale.setUserScale(2, 2);
    game.renderer.renderSession.roundPixels = true;
    Phaser.Canvas.setImageRenderingCrisp(this.game.canvas)

    //Load map
    map = game.add.tilemap('world');
    map.addTilesetImage('tileset', 'tileset');
    collisionLayer = map.createLayer(0);
    worldLayer = map.createLayer(1);
    map.setCollisionBetween(1, 2000, true, 'collision');
    
    worldLayer.resizeWorld();

    //Create player
    player = game.add.sprite(460, 820, 'player');
    player.anchor.set(0.5);
    game.physics.enable(player, Phaser.Physics.ARCADE);
    player.body.setSize(12, 12, 6, 12);
    player.body.collideWorldBounds = true;   
    

    player.animations.add("walkUp", [4, 5]);
    player.animations.add("walkRight", [6, 7]);
    player.animations.add("walkDown", [0 , 1]);
    player.animations.add("walkLeft", [2, 3]);

    //Create playersGroup
    playersGroup = game.add.group();
    messageGroup = game.add.group();

    //Input
    cursors = game.input.keyboard.createCursorKeys();
    enterKey = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    escKey = game.input.keyboard.addKey(Phaser.Keyboard.ESC);

    //Camera
    updateCameraPosition(player, false);

    //Network
    socket = io.connect(); // send a connection request to the server
    socket.on("connect", onsocketConnected); 
    socket.on("new_remotePlayer", onNewPlayer);	
	socket.on("remotePlayer_move", onEnemyMove);
    socket.on('remove_remotePlayer', onRemovePlayer); 
    socket.on("new_remoteMessage", onNewRemoteMessage);	
}

function update() {

    //Collisions
    game.physics.arcade.collide(player, collisionLayer);
    game.physics.arcade.collide(player, playersGroup);

    //Player
    //game.debug.body(player);
    player.body.velocity.x = 0;
    player.body.velocity.y = 0;

    //Messages
    //local
    for (var i=0; i < localMessages.length; i++){

        //Update position (all messages belong to player since they are local, so just tag them along player)
        localMessages[i].text.x = player.x;
        localMessages[i].text.y = player.y - 12 - localMessages[i].text.height / 2;
        localMessages[i].ttl--;
        if (localMessages[i].ttl == 0){
            removeMessage(localMessages[i], true);
        }
    }

    //remote
    for (var i=0; i < remoteMessages.length; i++){
        
        var remotePlayer = findplayerbyid(remoteMessages[i].playerId);
        if (remotePlayer != null){
            remoteMessages[i].text.x = remotePlayer.p.x;
            remoteMessages[i].text.y = remotePlayer.p.y - 12 - remoteMessages[i].text.height / 2;
            remoteMessages[i].ttl--;
            if (remoteMessages[i].ttl == 0){
                removeMessage(remoteMessages[i], false);
            }
        }
    }

    if (!movingCamera){
        controls(player, PLAYER_SPEED);
    }

    //Camera update
    if (!movingCamera){
        updateCameraPosition(player, true);
    }

    //console.log("Player pos- x: " + player.x + " y: " + player.y);
    //console.log("Camera pos- x: " + game.camera.x + " y: " + game.camera.y);

    //Network
    //Send a new position data to the server 
	socket.emit('move_player', {x: player.x, y: player.y, facing: player.facing});
}

//Input

function controls(p, spd) {

    
    if (keyboardcooldown > 0){
        keyboardcooldown--;
    }

    if (enterKey.downDuration(400) && keyboardcooldown == 0){
        if ($("#chatInput").is(":visible")){
            //Send message
            var msg = drawMessage($("#chatInput").val(), null, 150, p.x, p.y);
            sendMessage(msg);
            $("#chatInput").hide();
            isTyping = false;
        }else{
            $("#chatInput").val("");
            $("#chatInput").show();
            $("#chatInput").focus();
            isTyping = true;
        }

        keyboardcooldown = 10;
    }

    if (escKey.downDuration(400) && keyboardcooldown == 0){
        $("#chatInput").hide();
        $("#chatInput").val("");
        isTyping = false;

        keyboardcooldown = 10;
    }

    if (isTyping){
        p.frame = p.idleFrame;
        return;
    }
    
    var goingUp = false;
    var goingDown = false;
    var goingLeft = false;
    var goingRight = false;

    if (cursors.up.isDown)
    {
        p.body.velocity.y = -spd;
        p.idleFrame = 4;
        p.facing = 0;
        goingUp = true;
    }
    else if (cursors.down.isDown)
    {
        p.body.velocity.y = spd;
        p.idleFrame = 0;
        p.facing = 2;
        goingDown = true;
    }

    if (cursors.left.isDown)
    {
        p.body.velocity.x = -spd;
        p.idleFrame = 2;
        p.facing = 3;
        goingLeft = true;
    }
    else if (cursors.right.isDown)
    {
        p.body.velocity.x = spd;
        p.idleFrame = 7;
        p.facing = 1;
        goingRight = true;
    }

    doPlayerAnimation(p, goingDown, goingUp, goingLeft, goingRight);

    //not moving?
    if (p.body.velocity.x == 0 && p.body.velocity.y == 0){
        p.frame = p.idleFrame;
    }
}

function doPlayerAnimation(p, goingDown, goingUp, goingLeft, goingRight){

    if (goingUp && goingLeft){
        p.animations.play("walkLeft", 5, true);
    }

    if (goingUp && goingRight){
        p.animations.play("walkRight", 5, true);
    }

    if (goingUp && (!goingLeft && !goingRight)){
        p.animations.play("walkUp", 5, true);    
    }

    if (goingDown && goingLeft){
        p.animations.play("walkLeft", 5, true);
    }

    if (goingDown && goingRight){
        p.animations.play("walkRight", 5, true);
    }

    if (goingDown && (!goingLeft && !goingRight)){
        p.animations.play("walkDown", 5, true);    
    }

    if (goingLeft && (!goingUp && !goingDown)){
        p.animations.play("walkLeft", 5, true);
    }

    if (goingRight && (!goingUp && !goingDown)){
        p.animations.play("walkRight", 5, true);
    }
}

//Camera

function updateCameraPosition(p, animated){

    //we have to get inside which grid the player is in

    var indexX = Math.floor(p.x / SCR_WIDTH);
    var indexY = Math.floor(p.y / SCR_HEIGHT);

    var targetCamX = indexX * SCR_WIDTH;
    var targetCamY = indexY * SCR_HEIGHT;

    //Camera must move?
    if (targetCamX != game.camera.x || targetCamY != game.camera.y){

        if (animated){
            movingCamera = true;
            tweenCameraTo(targetCamX, targetCamY);
        }else{
            game.camera.x = targetCamX;
            game.camera.y = targetCamY;
        }
    }
}

function tweenCameraTo(targetX,targetY){
    var tween = game.add.tween(game.camera).to( { x: targetX, y: targetY }, 500, Phaser.Easing.Sinusoidal.InOut, true);
    tween.onComplete.add(cameraMovingCompleted, this);
}

function cameraMovingCompleted(){
    movingCamera = false;
}


//Network

//Messaging
var message = function(msg, playerId, ttl, x, y){

    var style = {
        font: "Press Start 2P", 
        fontSize: 8,
        fill: "#000000", 
        wordWrap: true, 
        wordWrapWidth: 100,
        backgroundColor: "#FFFFFF",
        boundsAlignH: "center",
        boundsAlignV: "middle",
        align: "center"
    };

    this.text = game.add.text(0, 0, msg, style);
    this.msg = msg;
    this.ttl = ttl;
    this.text.anchor.set(0.5);
    this.text.alpha = 0.8;
    this.playerId = playerId;
    this.text.x = x;
    this.text.y = y - 12 - this.text.height / 2;
}
function drawMessage(msg, playerId, ttl, x, y){

    var m = new message(msg, playerId, ttl, x, y);       
    
    if (playerId == null){
        console.log("Adding message as local");
        localMessages.push(m);
    }else{
        console.log("Adding message as remote");
        remoteMessages.push(m);
    }

    messageGroup.add(m.text);

    return(m);
}

function sendMessage(m){
    socket.emit('new_message', {message: m.msg, ttl: m.ttl, x: m.text.x, y: m.text.y});
}

function removeMessage(message, local){

    messageGroup.remove(message.text);
    message.text.destroy();

    if (local){
        localMessages.splice(localMessages.indexOf(message), 1);
    }else{
        remoteMessages.splice(remoteMessages.indexOf(message), 1);
    }
    
}

function onNewRemoteMessage(data){
    console.log(data);
    drawMessage(data.message, data.playerId, data.ttl, data.x, data.y);
}


//Remote players
var remote_player = function (id, startx, starty, start_facing) {
	this.x = startx;
    this.y = starty;
    
	//this is the unique socket id. We use it as a unique name for enemy
	this.id = id;
	this.facing = start_facing;      //Facing 0: up, 1: right, 2: down, 3: left
    
    this.p = game.add.sprite(this.x, this.y, 'remotePlayer');
    playersGroup.add(this.p);
    this.p.anchor.set(0.5);
    this.p.x = this.x;
    this.p.y = this.y;
    game.physics.enable(this.p, Phaser.Physics.ARCADE);
    this.p.body.setSize(12, 12, 6, 12);
    // this.p.body.inmovable = false;
    // this.p.body.moves = false;

    this.p.animations.add("walkUp", [4, 5]);
    this.p.animations.add("walkRight", [6, 7]);
    this.p.animations.add("walkDown", [0 , 1]);
    this.p.animations.add("walkLeft", [2, 3]);
}

function onsocketConnected () {
    console.log("Connected to server - Welcome to the island"); 
    socket.emit('new_player', {x: player.x, y: player.y, facing: 0});
}

//Server will tell us when a new enemy player connects to the server.
//We create a new enemy in our game.
function onNewPlayer (data) {
	var new_remote_player = new remote_player(data.id, data.x, data.y, data.facing); 
    players.push(new_remote_player);
}

function onRemovePlayer (data) {
    var removePlayer = findplayerbyid(data.id);
    
	// Player not found
	if (!removePlayer) {
		console.log('Player not found: ', data.id)
		return;
    }
    
    playersGroup.remove(removePlayer.p);
	
	removePlayer.p.destroy();
	players.splice(players.indexOf(removePlayer), 1);
}

//Server tells us there is a new enemy movement. We find the moved enemy
//and sync the enemy movement with the server
function onEnemyMove (data) {
    //enemy moved
    //console.log("Enemy moved: " + data.id + " " + data.x + " " + data.y + " " + data.facing);
    
	//console.log(players);
    var movePlayer = findplayerbyid (data.id); 
    
    if (movePlayer == null){
        return;
    }

    var goingLeft = false;
    var goingRight = false;
    var goingUp = false;
    var goingDown = false;

    if (movePlayer.p.x < data.x){
        goingRight = true;
    }

    if (movePlayer.p.x > data.x){
        goingLeft = true;
    }

    if (movePlayer.p.y < data.y){
        goingDown = true;
    }

    if (movePlayer.p.y > data.y){
        goingUp = true;
    }
    
    movePlayer.x = data.x;
    movePlayer.y = data.y;
	movePlayer.p.x = data.x; 
	movePlayer.p.y = data.y; 
    movePlayer.facing = data.facing; 
    
    //Remote player animation
    doPlayerAnimation(movePlayer.p, goingDown, goingUp, goingLeft, goingRight);

    //Idle
    if (!goingDown && !goingUp && !goingLeft && !goingRight){
        movePlayer.p.animations.stop();
        switch(movePlayer.facing){
            case 0: movePlayer.p.frame = 4;
                    break;
            case 1: movePlayer.p.frame = 7;
                    break;
            case 3: movePlayer.p.frame = 0;
                    break;
            case 4: movePlayer.p.frame = 2;
                    break;
            default: movePlayer.p.frame = 0;
                    break;
        }
    }
}

//This is where we use the socket id. 
//Search through enemies list to find the right enemy of the id.
function findplayerbyid (id) {
	for (var i = 0; i < players.length; i++) {
		if (players[i].id == id) {
			return players[i]; 
		}
    }
    
    return null;
}
