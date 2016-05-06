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
        if (keyboard.wasKeyPressed(IO.KEYS.Up)) {
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
    };

    Player.prototype.isAt = function (i, j) {
        return this.i == i && this.j == j;
    };
    
    Player.prototype.draw = function (context, x, y) {
        context.fillRect(x + 5, y + 5, 10, 10);
    };
    
    function Replayer(i, j, moves) {
        this.position = pos;
        this.moves = moves;
    }
    
    Replayer.prototype.step = function () {
    };
    
    Replayer.prototype.draw = function (context) {
    };
    
    return {
        Player: Player,
        Replayer: Replayer
    };
}());