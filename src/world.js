var WORLD = (function () {
    "use strict";
    
    var TILE_WIDTH = 96,
        TILE_HEIGHT = 64;
    
    function World(width, height) {
        this.width = width;
        this.height = height;
        this.player = new AGENT.Player(new LINEAR.Vec(0, 0));
        this.replayers = [];
    }

    World.prototype.update = function (keyboard, pointer, now, elapsed) {
    }
    
    World.prototype.draw = function (context, width, height) {
        for (var i = 0; i < this.width; ++i) {
            for (var j = 0; j < this.height; ++j) {
                var x = i * TILE_WIDTH,
                    y = j * TILE_HEIGHT;
                
                context.strokeRect(x + 1, y + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);
                
            }
        }
    }
    
    function defaultWorld() {
        return new World(10, 10);
    }
    
    return {
        World: World,
        default: defaultWorld 
    };
}());