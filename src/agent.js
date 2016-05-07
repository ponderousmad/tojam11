var AGENT = (function () {
    "use strict";
    
    var BASE_OFFSET = 5;
    
    function canMove(world, player, move) {
        return world.canMove(player, player.i + move.i, player.j + move.j);
    }
    
    function doMove(world, player, move) {
        player.i += move.i;
        player.j += move.j;
    }
    
    function updatePush(world, player) {
        if (player.push !== null) {
            if (!player.push.hand.moving()) {
                doMove(world, player, player.push.move);
                world.moved(player, true, false);
                player.push = null;
            }
            return true;
        }
        return false;
    }
    
    function Player(i, j) {
        this.i = i;
        this.j = j;
        this.moves = [];
        this.moveTimer = null;
        this.push = null;
    }
    
    Player.prototype.update = function (world, sweeping, now, elapsed, keyboard, pointer) {
        if (sweeping) {
            updatePush(world, this);
            return;
        }
        if (this.moveTimer) {
            this.moveTimer -= elapsed;
            if (this.moveTimer < 0) {
                this.moveTimer = null;
                var move = this.moves[this.moves.length - 1],
                    relocated = false;
                if (canMove(world, this, move)) {
                    doMove(world, this, move);
                    relocated = true;
                }
                world.moved(this, relocated, true);
            }
            return;
        }
        if (keyboard.wasKeyPressed(IO.KEYS.Space)) {
            world.rewind(this);
        }
        else if (keyboard.wasKeyPressed(IO.KEYS.Up)) {
            this.tryMove(world, 0, -1);
        }
        else if (keyboard.wasKeyPressed(IO.KEYS.Down)) {
            this.tryMove(world, 0, 1);
        }
        else if (keyboard.wasKeyPressed(IO.KEYS.Left)) {
            this.tryMove(world, -1, 0);
        }
        else if (keyboard.wasKeyPressed(IO.KEYS.Right)) {
            this.tryMove(world, 1, 0);
        }
    };

    Player.prototype.tryMove = function (world, iStep, jStep) {
        this.moves.push({i:iStep, j:jStep});
        this.moveTimer = world.stepDelay;
    };
    
    Player.prototype.sweep = function(push) {
        this.push = push;
    };

    Player.prototype.isAt = function (i, j) {
        return this.i == i && this.j == j;
    };
    
    Player.prototype.draw = function (context, world) {
        var x = this.i * world.tileWidth + BASE_OFFSET,
            y = this.j * world.tileHeight + BASE_OFFSET,
            move = null,
            moveFraction = 0;
        
        if (this.push !== null) {
            moveFraction = this.push.hand.moveFraction();
            move = this.push.move;
        } else if (this.moveTimer !== null) {
            moveFraction = 1 - this.moveTimer / world.stepDelay;
            move = this.moves[this.moves.length-1];   
        }
        
        if (move !== null) {
            if (moveFraction > 0.5 && !canMove(world, this, move)) {
                moveFraction = 1 - moveFraction;
            }
            x += moveFraction * move.i * world.tileWidth;
            y += moveFraction * move.j * world.tileHeight;
        }
        
        context.fillRect(x, y, 10, 10);
    };
    
    function Replayer(i, j, moves) {
        this.i = i;
        this.j = j;
        this.startI = i;
        this.startJ = j;
        this.moves = moves;
        this.moveIndex = 0;
        this.push = null;
    }
    
    Replayer.prototype.step = function (world) {
        if (this.moveIndex >= this.moves.length) {
            return;
        }
        
        var move = this.moves[this.moveIndex],
            relocated = false;
        if (canMove(world, this, move)) {
            doMove(world, this, move);
            relocated = true;
        }
        world.moved(this, relocated, false);
        this.moveIndex += 1;
    };
    
    Replayer.prototype.update = function (world, now, elapsed) {
        updatePush(world, this);
    };
    
    Replayer.prototype.rewind = function () {
        this.moveIndex = 0;
        this.i = this.startI;
        this.j = this.startJ;
    };

    Replayer.prototype.isAt = function (i, j) {
        return this.i == i && this.j == j;
    };
    
    Replayer.prototype.sweep = function (push) {
        this.push = push;
    };
    
    Replayer.prototype.draw = function (context, world, offset, moveFraction) {
        context.save();
        context.globalAlpha = 0.5;
        var x = this.i * world.tileWidth + BASE_OFFSET,
            y = this.j * world.tileHeight + BASE_OFFSET,
            move = null;
        
        if (this.push !== null) {
            move = this.push.move;
            moveFraction = this.push.hand.moveFraction();
        } if (moveFraction !== null && this.moveIndex < this.moves.length) {
            move = this.moves[this.moveIndex];
            if (!canMove(world, this, move) & moveFraction > 0.5) {
                moveFraction = 1 - moveFraction;
            }
        }
        if (move !== null) {
            x += world.tileWidth * move.i * moveFraction;
            y += world.tileWidth * move.j * moveFraction;
        }
        
        context.fillRect(x + offset.x, y + offset.y, 10, 10);
        context.restore();
    };
    
    return {
        Player: Player,
        Replayer: Replayer
    };
}());