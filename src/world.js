var WORLD = (function () {
    "use strict";
    
    var TILE_WIDTH = 80,
        TILE_HEIGHT = 80,
        DIRECTIONS = {
            right: 0,
            down: Math.PI / 2,
            left: Math.PI,
            up: (3 * Math.PI) / 2
        },
        TINTS = [
            [1.0, 0.5, 0.5],
            [0.5, 1.5, 0.5],
            [0.5, 0.5, 1.5],
            [1.5, 1.5, 0.5],
            [0.5, 1.5, 1.5],
            [1.5, 0.5, 1.5]
        ],
        TRIGGER_ACTIONS = {
            Exit: 0,
            Clockwise: 1,
            Counterclock: 2,
            Mousetrap: 3,
            COUNT: 4
        },
        QTURN = Math.PI / 2,
        TICK_TIME = 64,
        UNTICK_TIME = 32,
        UNMOVE_TIME = 64,
        REWIND_PAUSE = 250,
        HAND_PIVOT = 48,
        batch = new BLIT.Batch("images/"),
        background = batch.load("bg.png"),
        tile2x2 = batch.load("floor-tile.png"),
        panel = batch.load("panel.png"),
        handImage = batch.load("clock-hand.png"),
        fixedHandImage = batch.load("clock-hand-fixed.png"),
        crankImage = batch.load("crank-left.png"),
        crankImageTint = batch.load("crank-left-2.png"),
        trapImage = batch.load("trap.png"),
        trapCheese = batch.load("trap-cheese.png"),
        goat = new BLIT.Flip(batch, "_goat_excited_", 15, 2).setupPlayback(32, true),
        nextTint = 0,
        editArea = null;
        
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
    
    function fixTint(tint) {
        if (parseInt(tint, 10) === tint) {
            return tint % TINTS.length;
        }
        tint = nextTint;
        nextTint = fixTint(nextTint + 1);
        return tint;
    }

    function Trigger(i, j, action, tint) {
        this.i = i;
        this.j = j;
        this.action = action;
        this.tint = fixTint(tint);
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
    
    Trigger.prototype.draw = function (context, world, scale) {
        var x = (this.i + 0.5) * world.tileWidth,
            y = (this.j + 0.5) * world.tileHeight;
        if (this.action == TRIGGER_ACTIONS.Clockwise || this.action == TRIGGER_ACTIONS.Counterclock) {
            var mirror = this.action == TRIGGER_ACTIONS.Counterclock,
                width = crankImage.width * scale,
                height = crankImage.height * scale;
            BLIT.draw(context, crankImage, x, y, BLIT.ALIGN.Center, width, height, mirror);
            BLIT.draw(context, crankImageTint, x, y, BLIT.ALIGN.Center, width, height, mirror, TINTS[this.tint]);
            return;
        }
        if (this.action == TRIGGER_ACTIONS.Mousetrap) {
            BLIT.draw(context, trapImage, x, y, BLIT.ALIGN.Center, trapImage.width * scale, trapImage.height * scale);
            BLIT.draw(context, trapCheese, x, y, BLIT.ALIGN.Center, trapCheese.width * scale, trapCheese.height * scale);
            return;
        }
        context.save();
        context.fillStyle = this.style();
        context.fillRect(this.i * world.tileWidth, this.j * world.tileHeight, world.tileWidth, world.tileHeight);
        context.restore();
    };
    
    Trigger.prototype.save = function () {
        return {
            i: this.i,
            j: this.j,
            action: actionName(this.action),
            tint: this.tint
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
    
    ClockHand.prototype.updating = function () {
        return this.tickTimer !== null;
    };
    
    ClockHand.prototype.draw = function (context, world, editing, imageScale) {
        context.save();
        var x = this.i * world.tileWidth,
            y = this.j * world.tileHeight,
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
            tint = this.trigger ? TINTS[this.trigger.tint] : null;
        BLIT.draw(context, image, -HAND_PIVOT, -HAND_PIVOT, BLIT.ALIGN.TopLeft, 0, 0, BLIT.MIRROR.None, tint);
        context.restore();
        
        if (editing && this.trigger) {
            var endX = (this.trigger.i + 0.5) * world.tileWidth,
                endY = (this.trigger.j + 0.5) * world.tileHeight;
            
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
            hand: this,
            direction: dir
        };
    };
    
    ClockHand.prototype.save = function (triggers) {
        var data = {
            i: this.i,
            j: this.j,
            angle: Math.round(this.startAngle / QTURN),
            persist: this.persist
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
    
    function Untick(hand, direction, sweeps) {
        this.hand = hand;
        this.startAngle = hand.angle;
        this.angleDelta = - direction * QTURN;
        this.sweeps = sweeps;
        this.time = UNTICK_TIME;
    }
    
    Untick.prototype.update = function (world, fraction) {
        if (!this.hand.persist) {
            this.hand.angle = this.startAngle + this.angleDelta * fraction;
        }
        for (var s = 0; s < this.sweeps.length; ++s) {
            this.sweeps[s].update(world, fraction);
        }
    };
    
    function Unmove(player, move, relocated) {
        this.player = player;
        this.i = player.i;
        this.j = player.j;
        this.move = relocated ? { i: -move.i, j: -move.j } : move;
        this.relocated = relocated;
        this.time = UNMOVE_TIME;
    }
    
    Unmove.prototype.update = function (world, fraction) {
        if (!this.relocated && fraction > 0.5) {
            fraction = 1 - fraction;
        }
        this.player.rewindTo(
            this.i + (this.move.i * fraction),
            this.j + (this.move.j * fraction),
            this.relocated ? this.move.i : 0,
            null
        );
    };
    
    function Unsquish(player) {
        this.player = player;
        this.i = player.i;
        this.j = player.j;
    }
    
    Unsquish.prototype.update = function (world, fraction) {
        this.player.drawAt(this.i, this.j, 0, fraction);
    };
    
    function Rewinder() {
        this.actions = [];
        this.timer = null;
    }

    Rewinder.prototype.update = function (world, now, elapsed) {
        if (this.actions.length === 0) {
            if (this.timer === null) {
                this.timer = REWIND_PAUSE;
            }
            this.timer -= elapsed;
            return this.timer > 0;
        }
        var lastAction = this.actions[this.actions.length - 1];
        if (this.timer === null) {
            this.timer = lastAction.time;
        } else {
            this.timer -= elapsed;
        }
        var fraction = this.timer < 0 ? 1.0 : 1.0 - (this.timer / lastAction.time);
        lastAction.update(world, fraction);
        if (this.timer < 0) {
            this.actions.pop();
            if (this.actions.length > 0) {
                this.timer = this.actions[this.actions.length - 1].time;
            } else {
                this.timer = REWIND_PAUSE;
            }
        }
        return true;
    };
    
    Rewinder.prototype.add = function (action) {
        this.actions.push(action);
    };
    
    function World(width, height) {
        this.loading = false;
        this.editData = null;
        this.width = width;
        this.height = height;
        this.replayLimit = 4;
        this.moveLimit = 5;
        this.tileWidth = TILE_WIDTH;
        this.tileHeight = TILE_HEIGHT;
        this.xOffset = 0;
        this.yOffset = 0;
        this.startI = 0;
        this.startJ = 0;
        this.replayers = [];
        this.stepIndex = 0;
        this.stepTimer = null;
        this.stepDelay = 100;
        this.triggers = [];
        this.hands = [];
        this.rewinder = new Rewinder();
        this.rewinding = false;
        this.gameOver = false;
        this.setupPlayer();
    }
    
    World.prototype.reset = function() {
        this.replayers = [];
        this.setupPlayer();
        
        for (var h = 0; h < this.hands.length; ++h) {
            var hand = this.hands[h];
            hand.angle = hand.startAngle;
        }
        
        this.stepTimer = null;
        this.stepIndex = 0;
        this.rewinder = new Rewinder();
        this.rewinding = false;
        this.gameOver = false;
    };
    
    World.prototype.setupPlayer = function () {
        this.player = new AGENT.Player(this.startJ, this.startI);
    };
    
    World.prototype.totalWidth = function () {
        return this.width * this.tileWidth;
    };
    
    World.prototype.totalHeight = function () {
        return this.height * this.tileHeight;
    };

    World.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.loading) {
            return false;
        }

        if (this.editUpdate(now, elapsed, keyboard, pointer)) {
            return true;
        }
        
        AGENT.updateAnims(elapsed);
        
        if (this.rewinding) {
            BLIT.updatePlaybacks(elapsed, [goat]);
            if (!this.rewinder.update(this, now, elapsed)) {
                this.rewound();
            }
            return;
        }

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
        this.player.update(this, this.stepTimer !== null || this.gameOver, sweeping, now, elapsed, keyboard, pointer);
        if (this.player.moves.length >= this.moveLimit && !this.updating()) {
            if (this.replayers.length < this.replayLimit) {
                this.rewinding = true;
            } else {
                this.gameOver = true;
            }
        }
        return true;
    };
    
    World.prototype.updating = function () {
        if (this.stepTimer !== null) {
            return true;
        }
        if (this.player.updating()) {
            return true;
        }
        for (var r = 0; r < this.replayers.length; ++r) {
            if (this.replayers[r].updating()) {
                return true;
            }
        }
        for (var h = 0; h <  this.hands.length; ++h) {
            if (this.hands[h].updating()) {
                return true;
            }
        }
        return false;
    };
    
    World.prototype.pointerLocation = function (pointer) {
        var point = pointer.location();
        
        if (point) {
            var x = (point.x - this.xOffset) / this.tileWidth,
                y = (point.y - this.yOffset) / this.tileHeight;
            
            return {
                x: x, y: y,
                gridI: Math.round(x),
                gridJ: Math.round(y),
                squareI: Math.round(x - 0.5),
                squareJ: Math.round(y - 0.5)
            };
        }
        
        return null;
    };
    
    World.prototype.clampPoint = function (point) {
        return {
            x: point.x, y: point.y,
            gridI: Math.min(point.gridI, this.width),
            gridJ: Math.min(point.gridJ, this.width),
            squareI: Math.min(point.squareI, this.width - 1),
            squareJ: Math.min(point.squareJ, this.height - 1)
        };
    };
    
    World.prototype.checkpoint = function () {
        console.log(this.save());
        try {
            window.localStorage.setItem("puzzle", this.save());
        } catch (error) {
            console.log("Error storing puzzle: " + error);
        }
    };
    
    World.prototype.editUpdate = function (now, elapsed, keyboard, pointer) {
        if (editArea === null) {
            editArea = document.getElementById("puzzle");
            var self = this;
            editArea.addEventListener("paste", function (event) {
                setTimeout(function () { self.load(JSON.parse(editArea.value)); });
            }, false);
            
            try {
                editArea.value = window.localStorage.getItem("puzzle");
            } catch (error) {
                console.log("Error loading puzzle: " + error);
            }
        }
        if (keyboard.wasAsciiPressed("E")) {
            if (this.editData !== null) {
                this.editData = null;
                editArea.className = "hidden";
                this.checkpoint();
            } else {
                this.editData = {
                    hand: null,
                    trigger: null,
                    lastHand: null,
                    lastTrigger: null
                };
                editArea.className = "";
            }
        } else if (keyboard.wasAsciiPressed("S")) {
            editArea.value = this.save();
            editArea.select();
            editArea.focus();
            document.execCommand("copy");
            this.checkpoint();

        } else if (keyboard.wasKeyPressed(IO.KEYS.Space)) {
            this.reset();
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
                edit.hand.startAngle = edit.hand.angle;
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
                    at = this.clampPoint(at);
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
                    at = this.clampPoint(at);
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
        } else if (keyboard.wasAsciiPressed("C")) {
            var colorTrigger = edit.lastTrigger;
            if (edit.lastHand !== null && edit.lastHand.trigger) {
                colorTrigger = edit.lastHand.trigger;
            }
            if (colorTrigger !== null) {
                colorTrigger.tint = fixTint(colorTrigger.tint + 1);
            }
        } else if (keyboard.wasKeyPressed(IO.KEYS.Backspace) && keyboard.isShiftDown()) {
            this.hands = [];
            this.triggers = [];
        } else if (keyboard.wasAsciiPressed("1") && keyboard.isShiftDown()) {
            this.width = Math.max(this.width - 1, 4);
        } else if (keyboard.wasAsciiPressed("1")) {
            this.width = Math.min(this.width + 1, 10);
        } else if (keyboard.wasAsciiPressed("2") && keyboard.isShiftDown()) {
            this.height = Math.max(this.height - 1, 4);
        } else if (keyboard.wasAsciiPressed("2")) {
            this.height = Math.min(this.height + 1, 10);
        } else if (keyboard.wasAsciiPressed("3") && keyboard.isShiftDown()) {
            this.moveLimit = Math.max(this.moveLimit - 1, 2);
        } else if (keyboard.wasAsciiPressed("3")) {
            this.moveLimit = Math.min(this.moveLimit + 1, 20);
        } else if (keyboard.wasAsciiPressed("4") && keyboard.isShiftDown()) {
            this.replayLimit = Math.max(this.replayLimit - 1, 2);
        } else if (keyboard.wasAsciiPressed("4")) {
            this.replayLimit = Math.min(this.replayLimit + 1, 5);
        } else if (keyboard.wasAsciiPressed("L")) {
            this.load(JSON.parse(editArea.value));
        }
        return true;
    };
    
    World.prototype.draw = function (context, width, height) {
        context.font = "12px serif";
        if (this.loading || !batch.loaded) {
            BLIT.centeredText(context, "LOADING", width / 2, height / 2);
            return;
        }
        
        var bgWidth = width,
            bgHeight = (width / background.width) * background.height;
        if ((background.width / background.height) > (width / height)) {
            bgHeight = height;
            bgWidth = (height / background.height) * background.width;
        }
        BLIT.draw(context, background, width * 0.5, height * 0.5, BLIT.ALIGN.Center, bgWidth, bgHeight);
        
        context.save();
        this.xOffset = Math.floor((width - this.totalWidth()) / 2);
        this.yOffset = Math.floor((height - this.totalHeight()) / 2);
        context.translate(this.xOffset, this.yOffset);
        
        var scale = 2 * this.tileWidth / tile2x2.width;
        for (var i = 0; i < this.width; i += 2) {
            var tileWidth = this.tileWidth,
                sourceX = tile2x2.width * 0.5,
                x = i * this.tileWidth;
            if ((this.width - i) != 1) {
                tileWidth = 2 * this.tileWidth;
                sourceX = tile2x2.width;
            }
            for (var j = 0; j < this.height; j += 2) {
                var tileHeight = this.tileHeight,
                    sourceY = tile2x2.height * 0.5,
                    y = j * this.tileHeight;
                if ((this.height - j) != 1) {
                    tileHeight = 2 * this.tileHeight;
                    sourceY = tile2x2.height;
                }
                context.drawImage(tile2x2, 0, 0, sourceX, sourceY, x, y, tileWidth, tileHeight);
            }
            context.drawImage(panel, 0, 0, sourceX, panel.height, x, this.totalHeight(), tileWidth, panel.height * scale);
        }
        
        for (var t = 0; t < this.triggers.length; ++t) {
            this.triggers[t].draw(context, this, scale);
        }
        
        for (var h = 0; h < this.hands.length; ++h) {
            this.hands[h].draw(context, this, this.editData !== null, scale);
        }
        
        for (var row = 0; row < this.height; ++row) {
            for (var r = 0; r < this.replayers.length; ++r) {
                var replayer = this.replayers[r],
                    stepFraction = null;
                if (Math.floor(replayer.j) != row) {
                    continue;
                }
                if (this.stepIndex == r && this.stepTimer !== null) {
                    stepFraction = 1 - (this.stepTimer / this.stepDelay);
                }
                replayer.draw(context, this, scale, stepFraction);
            }
            if (Math.floor(this.player.j) == row) {
                this.player.draw(context, this, scale);
            }
        }
        var moveText = "Moves: " + (this.moveLimit - this.player.moves.length) + " / " + this.moveLimit,
            replayText = "Rewinds: " + (this.replayLimit - this.replayers.length) + " / " + this.replayLimit,
            fill = "rgb(255,255,255)",
            shadow = "rgb(0,0,0)";
        BLIT.centeredText(context, moveText, this.tileWidth, this.totalHeight() + this.tileHeight * 0.5, fill, shadow, 1);
        BLIT.centeredText(context, replayText, 2 * this.tileWidth, this.totalHeight() + this.tileHeight * 0.5, fill, shadow, 1);
        
        goat.draw(context, -this.tileHeight * 0.5, this.totalHeight() + this.tileHeight * 0.5, BLIT.ALIGN.Center, goat.width() * scale, goat.height() * scale);
        
        context.restore();
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
    
    World.prototype.moved = function (agent, move, relocated, playerControlled) {
        if (playerControlled) {
            this.startRestep();
        }
        for (var t = 0; t < this.triggers.length; ++t) {
            var trigger = this.triggers[t];
            if (relocated && trigger.contains(agent)) {
                this.activateTrigger(trigger, agent);
            }
        }
        if (move !== null) {
            this.rewinder.add(new Unmove(agent, move, relocated));
        }
    };
    
    World.prototype.activateTrigger = function (trigger, agent) {
        if (trigger.action == TRIGGER_ACTIONS.Clockwise || trigger.action == TRIGGER_ACTIONS.Counterclock) {
            for (var h = 0; h < this.hands.length; ++h) {
                var hand = this.hands[h];
                if (hand.trigger == trigger) {
                    var push = hand.turn();
                    this.sweep(push);
                }
            }
        }
    };
    
    World.prototype.sweep = function (push) {
        var sweeps = [];
        if (this.player.isAt(push.i, push.j)) {
            if (this.canMove(this.player, push.newI, push.newJ, push.hand)) {
                this.player.sweep(push);
                sweeps.push(new Unmove(this.player, push.move, true));
            } else {
                this.squish(this.player);
                sweeps.push(new Unsquish(this.player));
            }
        }
        
        for (var r = 0; r < this.replayers.length; ++r) {
            var replayer = this.replayers[r];
            if (replayer.isAt(push.i, push.j)) {
                if (this.canMove(replayer, push.newI, push.newJ, push.hand)) {
                    replayer.sweep(push);
                    sweeps.push(new Unmove(replayer, push.move, true));
                } else {
                    this.squish(replayer);
                    sweeps.push(new Unsquish(replayer));
                }
            }
        }
        this.rewinder.add(new Untick(push.hand, push.direction, sweeps));
    };
    
    World.prototype.startRestep = function () {
        if (this.replayers.length > 0) {
            this.stepTimer = this.stepDelay;
        }
    };
    
    World.prototype.rewound = function () {
        for (var r = 0; r < this.replayers.length; ++r) {
            this.replayers[r].rewind();
        }
        for (var h = 0; h < this.hands.length; ++h) {
            this.hands[h].rewind();
        }
        this.replayers.push(new AGENT.Replayer(this.startI, this.startJ, this.player.moves));
        this.setupPlayer();

        this.rewinder = new Rewinder();
        this.rewinding = false;

        this.startRestep();
    };
    
    World.prototype.save = function () {
        var data = {
            width: this.width,
            height: this.height,
            startI: this.startI,
            startJ: this.startJ,
            replayLimit: this.replayLimit,
            moveLimit: this.moveLimit,
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
        this.replayLimit = data.replayLimit ? data.replayLimit : 4;
        this.moveLimit = data.moveLimit ? data.moveLimit : 5;
        this.triggers = [];
        this.hands = [];
        this.replayers = [];
        
        for (var t = 0; t < data.triggers.length; ++t) {
            var tData = data.triggers[t];
            this.triggers.push(new Trigger(tData.i, tData.j, TRIGGER_ACTIONS[tData.action], tData.tint));
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