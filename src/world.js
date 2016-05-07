var WORLD = (function () {
    "use strict";
    
    var TILE_WIDTH = 40,
        TILE_HEIGHT = 40,
        REPLAY_OFFSETS = [
            {x:  2, y:  2},
            {x:  4, y:  4},
            {x:  6, y:  6},
            {x:  8, y:  8},
            {x: 10, y: 10},
            {x: 12, y: 12},
            {x: 14, y: 14},
            {x: 16, y: 16},
            {x: 18, y: 18},
            {x: 20, y: 20}
        ],
        DIRECTIONS = {
            Up: 1,
            Down: 2,
            Left: 4,
            Right: 8
        };
    
    function ClockHand(i, j, direction) {
        this.i = i;
        this.j = j;
        this.direction = direction;
    };
    
    function Exit(i, j) {
        this.i = i;
        this.j = j;
    };
    
    Exit.prototype.draw = function (context) {
        context.save();
        context.fillStyle = "rgba(0,255,0,0.5)";
        context.fillRect(this.i * TILE_WIDTH, this.j * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
        context.restore();
    };
    
    function World(width, height) {
        this.width = width;
        this.height = height;
        this.tileWidth = TILE_WIDTH;
        this.tileHeight = TILE_HEIGHT;
        this.player = new AGENT.Player(0, 0);
        this.replayers = [];
        this.stepIndex = 0;
        this.stepTimer = null;
        this.stepDelay = 100;
        this.exit = new Exit(width - 1, height - 1);
    }

    World.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.stepTimer !== null) {
            this.stepTimer -= elapsed;
            
            if (this.stepTimer < 0) {
                this.replayers[this.stepIndex].step(this);
                this.stepIndex += 1;
                if (this.stepIndex >= this.replayers.length) {
                    this.stepTimer = null;
                    this.stepIndex = 0;
                } else {
                    this.stepTimer += this.stepDelay;
                }
            }
        } else {
            this.player.update(this, now, elapsed, keyboard, pointer);
        }
    };
    
    World.prototype.draw = function (context, width, height) {
        for (var i = 0; i < this.width; ++i) {
            for (var j = 0; j < this.height; ++j) {
                var x = i * TILE_WIDTH,
                    y = j * TILE_HEIGHT;
                
                context.strokeRect(x + 1, y + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);
            }
        }
        
        this.exit.draw(context);
        
        this.player.draw(context, this);
        for (var r = 0; r < this.replayers.length; ++r) {
            var replayer = this.replayers[r],
                stepFraction = null;
            if (this.stepIndex == r && this.stepTimer != null) {
                stepFraction = 1 - (this.stepTimer / this.stepDelay);
            }
            replayer.draw(context, this, REPLAY_OFFSETS[r], stepFraction);
        }
    };
    
    World.prototype.canMove = function (player, newI, newJ) {
        if (newI < 0) {
            return false;
        }
        if (newI >= this.width) {
            return false;
        }
        if (newJ < 0) {
            return false;
        }
        if (newJ >= this.height) {
            return false;
        }
        return true;
    };
    
    World.prototype.moved = function () {
        this.startRestep();
    };
    
    World.prototype.startRestep = function () {
        if (this.replayers.length > 0) {
            this.stepTimer = this.stepDelay;
        }
    };
    
    World.prototype.rewind = function () {
        if (this.replayers.length == REPLAY_OFFSETS.length) {
            this.replayers = this.replayers.slice(1);
        }
        for (var r = 0; r < this.replayers.length; ++r) {
            this.replayers[r].rewind();
        }
        this.replayers.push(new AGENT.Replayer(0, 0, this.player.moves));
        this.player = new AGENT.Player(0, 0);
        this.startRestep();
    };
    
    function defaultWorld() {
        return new World(10, 10);
    };
    
    return {
        World: World,
        default: defaultWorld 
    };
}());