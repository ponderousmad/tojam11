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
        },
        QTURN = Math.PI / 2,
        TICK_TIME = 50;
    
    
    function actionName(action) {
        for (var a in TRIGGER_ACTIONS) {
            if (TRIGGER_ACTIONS.hasOwnProperty(a) && TRIGGER_ACTIONS[a] == action) {
                return a;
            }
        }
        return null;
    }
    
    function canonicalAngle(angle) {
        return (Math.round(angle / QTURN) % 4) * QTURN;
    }

    function Trigger(i, j, action) {
        this.i = i;
        this.j = j;
        this.action = action;
    }
    
    Trigger.prototype.contains = function (entity) {
        return entity.i == this.i && entity.j == this.j;
    };
    
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
    
    function ClockHand(i, j, angle, trigger, persist) {
        this.i = i;
        this.j = j;
        this.startAngle = angle;
        this.angle = angle;
        this.trigger = trigger;
        this.persist = persist ? true : false;
        this.tickTimer = null;
    }
    
    ClockHand.prototype.rewind = function () {
        if (!this.persist) {
            this.angle = this.startAngle;
        }
    };
    
    ClockHand.prototype.update = function (now, elapsed) {
        if (this.tickTimer !== null) {
            this.tickTimer -= elapsed;
            if (this.tickTimer < 0) {
                this.tickTimer = null;
            }
        }
    };
    
    ClockHand.prototype.draw = function (context, editing) {
        context.save();
        var x = this.i * TILE_WIDTH,
            y = this.j * TILE_WIDTH,
            angle = this.angle;
        if (this.tickTimer !== null) {
            angle -= QTURN * (this.tickTimer / TICK_TIME);
        }
        context.translate(x, y);
        context.rotate(angle);
        if (this.persist) {
            context.fillStyle = "rbg(0,0,127)";
        }
        context.fillRect(0, -3, TILE_WIDTH, 6);
        context.restore();
        
        if (editing && this.trigger) {
            var endX = (this.trigger.i + 0.5) * TILE_WIDTH,
                endY = (this.trigger.j + 0.5) * TILE_WIDTH;
            
            context.save();
            context.strokeStyle = "rgba(0,0,0,.2)";
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(endX, endY);
            context.stroke();
            context.restore();
        }
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
            angle: Math.round(this.startAngle / QTURN),
            rewind: this.rewind
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
    
    ClockHand.prototype.advance = function () {
        this.angle = canonicalAngle(this.angle + QTURN);
        this.tickTimer = TICK_TIME;
    };
    
    function World(width, height) {
        this.loading = false;
        this.editData = null;
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

        if (this.editUpdate(now, elapsed, keyboard, pointer)) {
            return true;
        }
        else if (this.stepTimer !== null) {
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
        for (var h = 0; h < this.hands.length; ++h) {
            this.hands[h].update(now, elapsed);
        }
        return true;
    };
    
    World.prototype.pointerLocation = function (pointer) {
        var point = pointer.location();
        
        if (point) {
            var x = point.x / TILE_WIDTH,
                y = point.y / TILE_HEIGHT;
            
            return {
                x: x, y: y,
                gridI: Math.round(x), gridJ: Math.round(y),
                squareI: Math.round(x - 0.5), squareJ: Math.round(y - 0.5)
            };
        }
        
        return null;
    };
    
    World.prototype.editUpdate = function (now, elapsed, keyboard, pointer) {
        if (keyboard.wasAsciiPressed("E")) {
            if (this.editData !== null) {
                this.editData = null;
            } else {
                this.editData = {};
            }
        } else if(keyboard.wasAsciiPressed("S")) {
            console.log(this.save());
        }
        if (this.editData === null) {
            return false;
        }
        var at = this.pointerLocation(pointer),
            edit = this.editData;
        if (pointer.activated()) {
            edit.start = at;
        }
        if (edit.hand) {
            if (pointer.primary) {
                var angle = Math.atan2(edit.start.gridJ - at.y, edit.start.gridI - at.x);
                edit.hand.angle = angle + Math.PI;
            } else {
                edit.hand.angle = canonicalAngle(edit.hand.angle);
                edit.lastHand = edit.hand;
                edit.hand = null;
            }
        }
        else if (edit.trigger) {
            if (pointer.primary) {
                edit.trigger.i = at.squareI;
                edit.trigger.j = at.squareJ;
            } else {
                edit.lastTrigger = edit.trigger;
                edit.trigger = null;
            }
        }
        else if (pointer.activated()) {
            if (keyboard.isShiftDown()) {
                for (var t = 0; t < this.triggers.length; ++t) {
                    var trigger = this.triggers[t];
                    if (trigger.i == at.squareI && trigger.j == at.squareJ) {
                        edit.trigger = trigger;
                    }
                }
                if (!edit.trigger) {
                    edit.trigger = new Trigger(at.squareI, at.squareJ, TRIGGER_ACTIONS.Clockwise);
                    this.triggers.push(edit.trigger);
                }
                if (edit.lastHand) {
                    edit.lastHand.trigger = edit.trigger;
                }
                edit.lastHand = null;
            } else {
                for (var h = 0; h < this.hands.length; ++h) {
                    var hand = this.hands[h];
                    if (hand.i == at.gridI && hand.j == at.gridJ) {
                        edit.hand = hand;
                    }
                }
                if (!edit.hand) {
                    edit.hand = new ClockHand(at.gridI, at.gridJ, 0, null, false);
                    this.hands.push(edit.hand);
                }
            }
        } else if (keyboard.wasKeyPressed(IO.KEYS.Minus)) {
            if (edit.lastHand) {
                this.hands.splice(this.hands.indexOf(edit.lastHand), 1);
            } else if (edit.lastTrigger) {
                this.triggers.splice(this.triggers.indexOf(edit.lastTrigger), 1);

                for (var d = 0; d < this.hands.length; ++d) {
                    var unhand = this.hands[d];
                    if (unhand.trigger == edit.lastTrigger) {
                        unhand.trigger = null;
                    }
                }
            }

            edit.lastHand = null;
            edit.lastTrigger = null;
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
            this.hands[h].draw(context, this.editData !== null);
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
    
    World.prototype.moved = function (agent, relocated, isPlayer) {
        if (isPlayer) {
            this.startRestep();
        }
        for (var t = 0; t < this.triggers.length; ++t) {
            var trigger = this.triggers[t];
            if (relocated && trigger.contains(agent)) {
                if (trigger.action == TRIGGER_ACTIONS.Clockwise || trigger.action == TRIGGER_ACTIONS.Counterclock) {
                    for (var h = 0; h < this.hands.length; ++h) {
                        var hand = this.hands[h];
                        if (hand.trigger == trigger) {
                            hand.advance();
                        }
                    }
                }
            }
        }
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
        for (var h = 0; h < this.hands.length; ++h) {
            this.hands[h].rewind();
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
            data.push(this.hands[h].save(this.triggers));
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
                t = handData.trigger,
                trigger = (t == parseInt(t, 10)) ? this.triggers[t] : null;
            this.hands.push(new ClockHand(handData.i, handData.j, handData.angle * QTURN, trigger, handData.persist));
        }
        
        this.setupPlayer();
        this.loading = false;
    };
    
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
        load: loadWorld
    };
}());