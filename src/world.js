var WORLD = (function () {
    "use strict";
    
    var TILE_WIDTH = 80,
        TILE_HEIGHT = 80,
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
            Mousetrap: 3,
            COUNT: 4
        },
        QTURN = Math.PI / 2,
        TICK_TIME = 50,
        HAND_PIVOT = 48,
        batch = new BLIT.Batch("images/"),
        tile2x2 = batch.load("floor-tile.png"),
        handImage = batch.load("clock-hand.png"),
        fixedHandImage = batch.load("clock-hand-fixed.png");
        
    (function () {
        batch.commit();
    }());
    
    function actionName(action) {
        for (var a in TRIGGER_ACTIONS) {
            if (TRIGGER_ACTIONS.hasOwnProperty(a) && TRIGGER_ACTIONS[a] == action) {
                return a;
            }
        }
        return null;
    }
    
    function canonicalAngle(angle) {
        var qTurns = Math.round(angle / QTURN);
        if (qTurns < 0) {
            qTurns += (1 + Math.ceil(qTurns / 4)) * 4;
        }
        return (qTurns % 4) * QTURN;
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
            return true;
        }
        return false;
    };
    
    ClockHand.prototype.draw = function (context, editing, imageScale) {
        context.save();
        var x = this.i * TILE_WIDTH,
            y = this.j * TILE_WIDTH,
            angle = this.angle;
        if (this.tickTimer !== null) {
            angle -= QTURN * (this.tickTimer / TICK_TIME) * this.direction();
        }
        context.translate(x, y);
        context.rotate(angle);
        context.scale(imageScale, imageScale);
        if (this.persist) {
            context.fillStyle = "rgb(0,0,127)";
        }
        var image = this.trigger ? handImage : fixedHandImage,
            tint = this.trigger ? [1.0, 0.5, 0.5] : null;
        BLIT.draw(context, image, -HAND_PIVOT, -HAND_PIVOT, BLIT.ALIGN.TopLeft, 0, 0, BLIT.MIRROR.None, tint);
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
    
    ClockHand.prototype.sweepInfo = function () {
        var qDir = Math.round(this.angle / QTURN),
            dir = this.direction(),
            startI = this.i,
            startJ = this.j,
            sweepI = 0,
            sweepJ = 0;
        if (qDir % 2 === 0) { // Horizontal
            if (qDir === 0) {
                sweepI = -1;
                if (dir < 0) {
                    startJ = this.j - 1;
                }
            } else {
                startI = this.i - 1;
                sweepI = 1;
                if (dir > 0) {
                    startJ = this.j - 1;
                }
            }
        } else { // Vertical
            if (qDir === 1) {
                sweepJ = -1;
                if (dir > 0) {
                    startI = this.i - 1;
                }
            } else {
                startJ = this.j - 1;
                sweepJ = 1;
                if (dir < 0) {
                    startI = this.i - 1;
                }
            }
        }
        
        return {
            i: startI, j: startJ,
            newI: startI + sweepI, newJ: startJ + sweepJ,
            move: { i: sweepI, j: sweepJ },
            hand: this
        };
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
    
    ClockHand.prototype.turn = function () {
        var sweepInfo = this.sweepInfo();
        this.angle = canonicalAngle(this.angle + QTURN * this.direction());
        this.tickTimer = TICK_TIME;
        return sweepInfo;
    };
    
    ClockHand.prototype.direction = function () {
        if (this.trigger && this.trigger.action == TRIGGER_ACTIONS.Counterclock) {
            return -1;
        }
        return 1;
    };
    
    ClockHand.prototype.moving = function () {
        return this.tickTimer !== null;
    };
    
    ClockHand.prototype.moveFraction = function () {
        if (this.tickTimer !== null) {
            return 1 - (this.tickTimer / TICK_TIME);
        }
        return 1;
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
        
        AGENT.updateAnims(elapsed);

        var sweeping = false;
        for (var h = 0; h < this.hands.length; ++h) {
            sweeping |= this.hands[h].update(now, elapsed);
        }

        for (var r = 0; r < this.replayers.length; ++r) {
            sweeping |= this.replayers[r].update(this, now, elapsed);
        }
        
        if (!sweeping && this.stepTimer !== null) {
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
        }
        this.player.update(this, this.stepTimer !== null, sweeping, now, elapsed, keyboard, pointer);
        return true;
    };
    
    World.prototype.pointerLocation = function (pointer) {
        var point = pointer.location();
        
        if (point) {
            var x = point.x / TILE_WIDTH,
                y = point.y / TILE_HEIGHT;
            
            return {
                x: x, y: y,
                gridI: Math.min(Math.round(x), this.width),
                gridJ: Math.min(Math.round(y), this.width),
                squareI: Math.min(Math.round(x - 0.5), this.width - 1),
                squareJ: Math.min(Math.round(y - 0.5), this.height - 1)
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
        } else if (keyboard.wasAsciiPressed("T")) {
            if (edit.lastHand !== null) {
                edit.lastHand.persist = !edit.lastHand.persist;
            } else if (edit.lastTrigger !== null) {
                edit.lastTrigger.action = (edit.lastTrigger.action + 1) % TRIGGER_ACTIONS.COUNT;
            }
        }
        return true;
    };
    
    World.prototype.draw = function (context, width, height) {
        if (this.loading || !batch.loaded) {
            BLIT.centeredText(context, "LOADING", width / 2, height / 2);
            return;
        }
        var scale = 2 * TILE_WIDTH / tile2x2.width;
        for (var i = 0; i < this.width; i += 2) {
            var tileWidth = TILE_WIDTH,
                sourceX = tile2x2.width * 0.5,
                x = i * TILE_WIDTH;
            if ((this.width - i) != 1) {
                tileWidth = 2 * TILE_WIDTH;
                sourceX = tile2x2.width;
            }
            for (var j = 0; j < this.height; j += 2) {
                var tileHeight = TILE_HEIGHT,
                    sourceY = tile2x2.height * 0.5,
                    y = j * TILE_HEIGHT;
                if ((this.height - j) != 1) {
                    tileHeight = 2 * TILE_HEIGHT;
                    sourceY = tile2x2.height;
                }
                context.drawImage(tile2x2, 0, 0, sourceX, sourceY, x, y, tileWidth, tileHeight);
            }
        }
        
        for (var t = 0; t < this.triggers.length; ++t) {
            this.triggers[t].draw(context);
        }
        
        for (var h = 0; h < this.hands.length; ++h) {
            this.hands[h].draw(context, this.editData !== null, scale);
        }
        
        for (var row = 0; row < this.height; ++row) {
            for (var r = 0; r < this.replayers.length; ++r) {
                var replayer = this.replayers[r],
                    stepFraction = null;
                if (replayer.j != row) {
                    continue;
                }
                if (this.stepIndex == r && this.stepTimer !== null) {
                    stepFraction = 1 - (this.stepTimer / this.stepDelay);
                }
                replayer.draw(context, this, scale, stepFraction);
            }
            if (this.player.j == row) {
                this.player.draw(context, this, scale);
            }
        }
    };
    
    World.prototype.canMove = function (player, newI, newJ, skipHand) {
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
            var hand = this.hands[h];
            if (skipHand && skipHand == hand) {
                continue;
            }
            if (hand.blocks(player, newI, newJ)) {
                return false;
            }
        }
        
        return true;
    };
    
    World.prototype.moved = function (agent, relocated, playerControlled) {
        if (playerControlled) {
            this.startRestep();
        }
        for (var t = 0; t < this.triggers.length; ++t) {
            var trigger = this.triggers[t];
            if (relocated && trigger.contains(agent)) {
                if (trigger.action == TRIGGER_ACTIONS.Clockwise || trigger.action == TRIGGER_ACTIONS.Counterclock) {
                    for (var h = 0; h < this.hands.length; ++h) {
                        var hand = this.hands[h];
                        if (hand.trigger == trigger) {
                            var push = hand.turn();
                            this.sweep(push);
                        }
                    }
                }
            }
        }
    };
    
    World.prototype.sweep = function (push) {
        if (this.player.isAt(push.i, push.j)) {
            if (this.canMove(this.player, push.newI, push.newJ, push.hand)) {
                this.player.sweep(push);
            } else {
                this.squish(this.player);
            }
        }
        
        for (var r = 0; r < this.replayers.length; ++r) {
            var replayer = this.replayers[r];
            if (replayer.isAt(push.i, push.j)) {
                if (this.canMove(replayer, push.newI, push.newJ, push.hand)) {
                    replayer.sweep(push);
                } else {
                    this.squish(replayer);
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
                i = handData.trigger,
                trigger = (i == parseInt(i, 10)) ? this.triggers[i] : null;
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