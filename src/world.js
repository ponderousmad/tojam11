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
            right: 0,
            down: Math.PI / 2,
            left: Math.PI,
            up: (3* Math.PI) / 2
        },
        TRIGGER_ACTIONS = {
            Exit: 0,
            Clockwise: 1,
            Counterclock: 2,
            Mousetrap: 3
        };
    
    function actionName(action) {
        for (var a in TRIGGER_ACTIONS) {
            if (TRIGGER_ACTIONS.hasOwnProperty(a) && TRIGGER_ACTIONS[a] == action) {
                return a;
            }
        }
        return null;
    }

    function Trigger(i, j, action) {
        this.i = i;
        this.j = j;
        this.action = action;
    }
    
    Trigger.prototype.style = function () {
        switch (this.action) {
            case TRIGGER_ACTIONS.Exit:
                return "rgba(0,255,0,0.5)";
            case TRIGGER_ACTIONS.Clockwise:
                return "rgba(0,0,255,0.5)";
            case TRIGGER_ACTIONS.Counterclock:
                return "rgba(255,0,255,0.5)";
            case TRIGGER_ACTIONS.Mousetrap:
                return "rgba(255,0,0,0.5)";
        }
        return "black";
    };
    
    Trigger.prototype.draw = function (context) {
        context.save();
        context.fillStyle = this.style();
        context.fillRect(this.i * TILE_WIDTH, this.j * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
        context.restore();
    };
    
    Trigger.prototype.save = function () {
        return {
            i: this.i,
            j: this.j,
            action: actionName(this.action)
        };
    };
    
    function ClockHand(i, j, angle, trigger) {
        this.i = i;
        this.j = j;
        this.startAngle = angle;
        this.angle = angle;
        this.trigger = trigger;
    }
    
    ClockHand.prototype.draw = function (context) {
        context.save();
        var x = this.i * TILE_WIDTH,
            y = this.j * TILE_WIDTH;
        context.translate(x, y);
        context.rotate(this.angle);
        context.fillRect(0, -3, TILE_WIDTH, 6);
        context.restore();
    };
    
    ClockHand.prototype.blocks = function (player, newI, newJ) {
        var iDir = Math.round(Math.cos(this.angle)),
            jDir = Math.round(Math.sin(this.angle));
        
        if (iDir === 0) {
            if (player.i === newI) {
                return false;
            }
            var maxI = Math.max(player.i, newI),
                handMinJ = jDir < 0 ? this.j - 1 : this.j;
            return handMinJ === newJ && maxI === this.i;
        }
        // jDir == 0
        if (player.j == newJ) {
            return false;
        }
        var maxJ = Math.max(player.j, newJ),
            handMinI = iDir < 0 ? this.i - 1 : this.i;
        return handMinI === newI && maxJ === this.j;
    };
    
    ClockHand.prototype.save = function (triggers) {
        var data = {
            i: this.i,
            j: this.j,
            angle: this.startAngle
        };
        
        if (this.trigger) {
            for (var t = 0; t < triggers.length; ++t) {
                if (triggers[t] == this.trigger) {
                    data.trigger = t;
                }
            }
        }
        return data;
    };
    
    function World(width, height) {
        this.loading = false;
        this.width = width;
        this.height = height;
        this.tileWidth = TILE_WIDTH;
        this.tileHeight = TILE_HEIGHT;
        this.startI = 0;
        this.startJ = 0;
        this.replayers = [];
        this.stepIndex = 0;
        this.stepTimer = null;
        this.stepDelay = 100;
        this.triggers = [];
        this.hands = [];
        this.setupPlayer();
    }
    
    World.prototype.setupPlayer = function () {
        this.player = new AGENT.Player(this.startJ, this.startI);
    };

    World.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.loading) {
            return false;
        }
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
        return true;
    };
    
    World.prototype.draw = function (context, width, height) {
        if (this.loading) {
            BLIT.centeredText(context, "LOADING", width / 2, height / 2);
            return;
        }
        for (var i = 0; i < this.width; ++i) {
            for (var j = 0; j < this.height; ++j) {
                var x = i * TILE_WIDTH,
                    y = j * TILE_HEIGHT;
                
                context.strokeRect(x + 1, y + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);
            }
        }
        
        for (var t = 0; t < this.triggers.length; ++t) {
            this.triggers[t].draw(context);
        }
        
        for (var h = 0; h < this.hands.length; ++h) {
            this.hands[h].draw(context);
        }
        
        this.player.draw(context, this);
        for (var r = 0; r < this.replayers.length; ++r) {
            var replayer = this.replayers[r],
                stepFraction = null;
            if (this.stepIndex == r && this.stepTimer !== null) {
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
        
        for (var h = 0; h < this.hands.length; ++h) {
            if (this.hands[h].blocks(player, newI, newJ)) {
                return false;
            }
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
        this.replayers.push(new AGENT.Replayer(this.startI, this.startJ, this.player.moves));
        this.setupPlayer();
        this.startRestep();
    };
    
    World.prototype.save = function () {
        var data = {
            width: this.width,
            height: this.height,
            startI: this.startI,
            startJ: this.startJ,
            triggers: this.saveTriggers(),
            hands: this.saveHands()
        };
        return JSON.stringify(data, null, 4);
    };
    
    World.prototype.saveTriggers = function () {
        var data = [];
        for (var t = 0; t < this.triggers.length; ++t) {
            data.push(this.triggers[t].save());
        }
        return data;
    };
    
    World.prototype.saveHands = function () {
        var data = [];
        for (var h = 0; h < this.hands.length; ++h) {
            data.push(this.hands[h].save());
        }
        return data;
    };
    
    World.prototype.load = function (data) {
        this.width = data.width;
        this.height = data.height;
        this.startI = data.startI;
        this.startJ = data.startJ;
        this.triggers = [];
        this.hands = [];
        this.replayers = [];
        
        for (var t = 0; t < data.triggers.length; ++t) {
            var triggerData = data.triggers[t];
            this.triggers.push(new Trigger(triggerData.i, triggerData.j, TRIGGER_ACTIONS[triggerData.action]));
        }
        
        for (var h = 0; h < data.hands.length; ++h) {
            var handData = data.hands[h],
                trigger = (handData.trigger == parseInt(handData.trigger, 10)) ? this.triggers[t] : null;
            this.hands.push(new ClockHand(handData.i, handData.j, handData.angle, trigger));
        }
        
        this.setupPlayer();
        this.loading = false;
    };
    
    World.prototype.open = function(resource) {
 
    };
    
    function defaultWorld() {
        var world = new World(10, 10);
        console.log(world.save());
        return world;
    }
    
    function loadWorld(resource, world) {
        if (!world) {
            world = new World(10, 10);
        }
        
        var request = new XMLHttpRequest();
        request.open("GET", resource, true);
        request.responseType = "text";
        request.onload = function () {
            console.log("Loading " + resource);
            var responseData = JSON.parse(request.response);
            world.load(responseData);
        };
        world.loading = true;
        request.send();

        return world;
    }
    
    return {
        World: World,
        default: defaultWorld,
        load: loadWorld
    };
}());