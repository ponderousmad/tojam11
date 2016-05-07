var AGENT = (function () {
    "use strict";
    
    function Move(action, time) {
        this.action = action;
        this.time = time;
    }
    
    function Player(i, j) {
        this.i = i;
        this.j = j;
        this.moves = [];
    }
    
    Player.prototype.update = function (world, now, elapsed, keyboard, pointer) {
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
        var newI = this.i + iStep,
            newJ = this.j + jStep;
        
        if (world.canMove(this, newI, newJ)) {
            this.i = newI;
            this.j = newJ;
            
        }
        this.moves.push({i:iStep, j:jStep});
        world.moved();
    };

    Player.prototype.isAt = function (i, j) {
        return this.i == i && this.j == j;
    };
    
    Player.prototype.draw = function (context, x, y) {
        context.fillRect(x + 5, y + 5, 10, 10);
    };
    
    function Replayer(i, j, moves) {
        this.i = i;
        this.j = j;
        this.startI = i;
        this.startJ = j;
        this.moves = moves;
        this.moveIndex = 0;
    }
    
    Replayer.prototype.step = function (world) {
        if (this.moveIndex >= this.moves.length) {
            return;
        }
        var step = this.moves[this.moveIndex],
            newI = this.i + step.i,
            newJ = this.j + step.j;
        
        if (world.canMove(this, newI, newJ)) {
            this.i = newI;
            this.j = newJ;    
        }
        this.moveIndex += 1;
    };
    
    Replayer.prototype.rewind = function () {
        this.moveIndex = 0;
        this.i = this.startI;
        this.j = this.startJ;
    };

    Replayer.prototype.isAt = function (i, j) {
        return this.i == i && this.j == j;
    };
    
    Replayer.prototype.draw = function (context, x, y, offset, yOffset) {
        context.save();
        context.globalAlpha = 0.5;
        context.fillRect(x + 5 + offset.x, y + 5 + offset.y, 10, 10);
        context.restore();
    };
    
    return {
        Player: Player,
        Replayer: Replayer
    };
}());