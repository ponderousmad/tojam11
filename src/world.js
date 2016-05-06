var WORLD = (function () {
    "use strict";
    
    var TILE_WIDTH = 50,
        TILE_HEIGHT = 40;
    
    function World(width, height) {
        this.width = width;
        this.height = height;
        this.player = new AGENT.Player(0, 0);
        this.replayers = [];
    }

    World.prototype.update = function (now, elapsed, keyboard, pointer) {
        this.player.update(this, now, elapsed, keyboard, pointer);
    }
    
    World.prototype.draw = function (context, width, height) {
        for (var i = 0; i < this.width; ++i) {
            for (var j = 0; j < this.height; ++j) {
                var x = i * TILE_WIDTH,
                    y = j * TILE_HEIGHT;
                
                context.strokeRect(x + 1, y + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);
                
                if (this.player.isAt(i, j)) {
                    this.player.draw(context, x, y);
                }
            }
        }
    }
    
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
    }
    
    function defaultWorld() {
        return new World(10, 10);
    }
    
    return {
        World: World,
        default: defaultWorld 
    };
}());