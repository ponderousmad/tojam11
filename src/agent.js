var AGENT = (function () {
    "use strict";
    
    function Move(action, time) {
        this.action = action;
        this.time = time;
    }
    
    function Player(pos) {
        this.position = pos;
        this.moves = [];
    }
    
    Player.prototype.update = function (keyboard, pointer, now, elapsed) {
    };
    
    Player.prototype.draw = function (context) {
    };
    
    function Replayer(pos, moves) {
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