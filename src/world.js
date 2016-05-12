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
            Alarm: 4,
            COUNT: 5
        },
        QTURN = Math.PI / 2,
        TICK_TIME = 400,
        UNTICK_TIME = 32,
        UNMOVE_TIME = 64,
        UNSQUISH_TIME = 500,
        UNRING_TIME = 500,
        REWIND_PAUSE = 250,
        HAND_PIVOT = 48,
        MUSIC_REWIND_FADE_OUT = 500,
        MUSIC_REWIND_FADE_IN = 500,
        DEFAULT_FRAME_TIME = 32,
        RING_FRAME_TIME = DEFAULT_FRAME_TIME,
        RING_FRAMES = 60,
        RING_TOTAL = RING_FRAME_TIME * RING_FRAMES,
        batch = new BLIT.Batch("images/"),
        background = batch.load("bg.png"),
        tile2x2 = batch.load("floor-tile.png"),
        panel = batch.load("panel.png"),
        movePanel = batch.load("moves-box.png"),
        rewindPanel = batch.load("rewinds-box.png"),
        textBubble = batch.load("text-bubble.png"),
        handImage = batch.load("clock-hand.png"),
        persistOverlay = batch.load("hand-persist-2.png"),
        persistTint = batch.load("hand-persist-1.png"),
        fixedHandImage = batch.load("clock-hand-fixed.png"),
        crankImage = batch.load("crank-left.png"),
        crankImageTint = batch.load("crank-left-2.png"),
        trapImage = batch.load("trap.png"),
        trapCheese = batch.load("trap-cheese.png"),
        alarmImage = batch.load("alarm.png"),
        DECORATIONS = [
            batch.load("bits.png"),
            batch.load("clockface.png"),
            batch.load("variant-tile.png"),
            batch.load("variant-tile2.png")
        ],
        exitBlockFlip = new BLIT.Flip(batch, "skull_", RING_FRAMES, 2),
        alarmFlip = new BLIT.Flip(batch, "alarm-shake_", RING_FRAMES, 2),
        resetFlip = new BLIT.Flip(batch, "reset_", 18, 2),
        resetAnim = resetFlip.setupPlayback(DEFAULT_FRAME_TIME, false, 0),
        titleAnim = new BLIT.Flip(batch, "title_", 12, 2).setupPlayback(DEFAULT_FRAME_TIME, true),
        goatExcited = new BLIT.Flip(batch, "_goat_excited_", 15, 2).setupPlayback(DEFAULT_FRAME_TIME, true),
        goatStoic = new BLIT.Flip(batch, "_goat_stoic_", 1, 2).setupPlayback(DEFAULT_FRAME_TIME, true),
        rewindSound = new BLORT.Noise("sounds/rewind01.wav"),
        crankSound = new BLORT.Noise("sounds/crank01B.wav"),
        crankRevSound = new BLORT.Noise("sounds/crankREVB.wav"),
        tickSound = new BLORT.Noise("sounds/clockturn01B.wav"),
        tickRevSound = new BLORT.Noise("sounds/clockturn01REVB.wav"),
        alarmSound = new BLORT.Noise("sounds/alarm.wav"),
        victorySound = new BLORT.Noise("sounds/victory.wav"),
        deathSounds = [],
        musicTracks = [],
        music = null,
        nextTint = 0,
        entropy = ENTROPY.makeRandom(),
        puzzles = [
            "puzzles/puzzle1.json",
            "puzzles/puzzle2.json",
            "puzzles/puzzle3.json",
            "puzzles/puzzle4.json",
            "puzzles/puzzle5.json",
            "puzzles/puzzle6.json",
            "puzzles/puzzle7.json",
            "puzzles/puzzle8.json"
        ],
        clockTween = [
            [0.0, 0.00],
            [0.1, 0.05],
            [0.2, 0.02],
            [0.3, 0.08],
            [0.4, 0.15],
            [0.5, 0.30],
            [0.6, 0.50],
            [0.7, 0.75],
            [0.8, 0.95],
            [0.9, 1.05],
            [1.0, 1.00]
        ],
        puzzleIndex = 0,
        editArea = null;

    (function () {
        batch.commit();
        var TRACKS = 2, DEATHS = 2;
        for (var track = 1; track <= TRACKS; ++track) {
            if (track == 1 && entropy.select(0.5)) {
                continue;
            }
            var tune = new BLORT.Tune("sounds/MusicLoop0" + track);
            tune.setVolume(0.0);
            musicTracks.push(tune);
        }
        for (var d = 1; d <= DEATHS; ++d) {
            var noise = new BLORT.Noise("sounds/death0" + d + ".wav");
            deathSounds.push(noise);
        }
    }());
    
    function interpolate(fraction, curve) {
        for (var i = 1; i < curve.length; ++i) {
            var before = curve[i-1],
                after = curve[i];
            
            if ((i == 1 || before[0] <= fraction) && fraction <= after[0]) {
                fraction = Math.max(0, fraction - before[0]);
                var range = after[0] - before[0];
                fraction = fraction / range;
                return after[1] * fraction + (1 - fraction) * before[1];
            }
        }
        return curve[curve.length - 1][1];
    }

    function screamInPain() {
        entropy.randomElement(deathSounds).play();
    }

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
        this.triggered = false;
        this.triggerAnim = null;
    }

    Trigger.prototype.rewind = function () {
        this.triggered = false;
        this.triggerAnim = null;
    };

    Trigger.prototype.contains = function (entity) {
        return entity.i == this.i && entity.j == this.j;
    };

    Trigger.prototype.update = function (world, elapsed, now) {
        if (this.triggerAnim && this.triggered) {
            this.triggerAnim.update(elapsed);
        }
    };

    Trigger.prototype.updating = function () {
        return this.triggered && this.triggerAnim && this.triggerAnim.fractionComplete < 1;
    };

    Trigger.prototype.draw = function (context, world, scale) {
        var x = (this.i + 0.5) * world.tileWidth,
            y = (this.j + 0.5) * world.tileHeight;
        if (this.action === TRIGGER_ACTIONS.Clockwise || this.action === TRIGGER_ACTIONS.Counterclock) {
            var mirror = this.action === TRIGGER_ACTIONS.Counterclock,
                width = crankImage.width * scale,
                height = crankImage.height * scale;
            BLIT.draw(context, crankImage, x, y, BLIT.ALIGN.Center, width, height, mirror);
            BLIT.draw(context, crankImageTint, x, y, BLIT.ALIGN.Center, width, height, mirror, TINTS[this.tint]);
            return;
        }
        if (this.action === TRIGGER_ACTIONS.Mousetrap) {
            BLIT.draw(context, trapImage, x, y, BLIT.ALIGN.Center, trapImage.width * scale, trapImage.height * scale);
            BLIT.draw(context, trapCheese, x, y, BLIT.ALIGN.Center, trapCheese.width * scale, trapCheese.height * scale);
            return;
        }
        if (this.action === TRIGGER_ACTIONS.Exit) {
            if (!this.triggerAnim) {
                this.triggerAnim = exitBlockFlip.setupPlayback(RING_FRAME_TIME, false);
            }
        }
        if (this.action === TRIGGER_ACTIONS.Alarm) {
            if (!this.triggerAnim) {
                this.triggerAnim = alarmFlip.setupPlayback(RING_FRAME_TIME, false);
            }
        }
        this.triggerAnim.draw(context, x, y, BLIT.ALIGN.Center, this.triggerAnim.width() * scale, this.triggerAnim.height() * scale);
    };

    Trigger.prototype.blocks = function () {
        return this.action == TRIGGER_ACTIONS.Exit && !this.triggered;
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
            angle -= QTURN * interpolate(this.tickTimer / TICK_TIME, clockTween) * this.direction();
        }
        context.translate(x, y);
        context.rotate(angle);
        context.scale(imageScale, imageScale);
        var image = this.trigger ? (this.persist ? persistTint : handImage) : fixedHandImage,
            tint = this.trigger ? TINTS[this.trigger.tint] : null;
        BLIT.draw(context, image, -HAND_PIVOT, -HAND_PIVOT, BLIT.ALIGN.TopLeft, 0, 0, BLIT.MIRROR.None, tint);
        if (this.persist && this.trigger) {
            BLIT.draw(context, persistOverlay, -HAND_PIVOT, -HAND_PIVOT, BLIT.ALIGN.TopLeft);
        }
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
            
            var sweep = this.sweepInfo(),
                xOffset = world.tileHeight * 0.5,
                yOffset = world.tileHeight * 0.5;
                
            context.strokeStyle = "rgb(255,0,0)";
            context.beginPath();
            context.moveTo(sweep.i * world.tileWidth + xOffset, sweep.j * world.tileHeight + yOffset);
            context.lineTo(sweep.newI * world.tileWidth + xOffset, sweep.newJ * world.tileWidth + yOffset);
            context.stroke();
            context.fillStyle = "rgb(255,0,0)";
            context.fillRect(sweep.newI * world.tileWidth + xOffset - 4, sweep.newJ * world.tileHeight + yOffset - 4, 8, 8);
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
        var qDir = Math.round(canonicalAngle(this.angle) / QTURN),
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
    
    function Decoration(i, j, deco) {
        this.i = i;
        this.j = j;
        this.deco = deco;
    }
    
    Decoration.prototype.draw = function (context, world, scale) {
        var image = DECORATIONS[this.deco];
        BLIT.draw(context, image, this.i * world.tileWidth, this.j * world.tileHeight, BLIT.ALIGN.TopLeft, image.width * scale, image.height * scale);
    };
    
    Decoration.prototype.save = function () {
        return {
            i: this.i,
            j: this.j,
            deco: this.deco
        };
    };

    function Untick(hand, direction, sweeps) {
        this.hand = hand;
        this.startAngle = hand.angle;
        this.angleDelta = - direction * QTURN;
        this.sweeps = sweeps;
        this.time = UNTICK_TIME;
    }
    
    Untick.prototype.start = function () {
        crankRevSound.play();
        tickRevSound.play();
    };

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
    
    Unmove.prototype.start = function () {
    };

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

    function Unsquish(players) {
        this.squishes = [];
        for (var p = 0; p < players.length; ++p) {
            var player = players[p];
            this.squishes.push({ player: player, i: player.i, j: player.j});
        }
        this.time = UNSQUISH_TIME;
    }
    
    Unsquish.prototype.start = function () {
    };

    Unsquish.prototype.update = function (world, fraction) {
        for (var s = 0; s < this.squishes.length; ++s) {
            var squish = this.squishes[s];
            squish.player.rewindTo(squish.i, squish.j, 0, 1 - fraction);
        }
    };

    function Unring(alarm, exits) {
        this.alarm = alarm;
        this.exits = exits;
        this.time = UNRING_TIME;
    }
    
    Unring.prototype.start = function () {
    };

    Unring.prototype.update = function (world, fraction) {
        var offset = (1 - fraction) * RING_TOTAL;
        for (var e = 0; e < this.exits.length; ++e) {
            this.exits[e].triggerAnim = exitBlockFlip.setupPlayback(RING_FRAME_TIME, false, offset);
        }
        this.alarm.triggerAnim = alarmFlip.setupPlayback(RING_FRAME_TIME, false, offset);
    };

    function Rewinder() {
        this.actions = [];
        this.timer = null;
        this.startedAction = null;
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
        if (lastAction != this.startedAction) {
            lastAction.start();
            this.startedAction = lastAction;
        }
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
        this.decos = [];
        this.rewinder = new Rewinder();
        this.rewinding = false;
        this.resettingAnim = null;
        this.gameOver = false;
        this.setupPlayer();
        this.musicTimer = null;
        this.tutorial = ["TAP, CLICK, WASD", "or arrow keys to move."];
    }

    World.prototype.reset = function() {
        this.replayers = [];
        this.setupPlayer();

        for (var t = 0; t < this.triggers.length; ++t) {
            this.triggers[t].rewind();
        }

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

    World.prototype.fadeMusic = function () {
        this.musicTimer = MUSIC_REWIND_FADE_OUT;
    };

    World.prototype.resumeMusic = function () {
        this.musicTimer = MUSIC_REWIND_FADE_OUT;
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

        if (music === null) {
            if (musicTracks[0].isLoaded()) {
                music = musicTracks[0];
                music.play();
            }
        } else {
            if (this.musicTimer !== null) {
                this.musicTimer = Math.max(0, this.musicTimer - elapsed);
            }
            var volume = 0.2;
            if (this.rewinding) {
                volume = Math.max(0.05, volume * (this.musicTimer / MUSIC_REWIND_FADE_OUT));
            } else {
                volume = Math.max(0.05, volume * (1 - (this.musicTimer / MUSIC_REWIND_FADE_IN)));
            }
            music.setVolume(volume);
        }

        if (titleAnim) {
            titleAnim.update(elapsed);
            if (keyboard.keysDown() > 0 || pointer.activated()) {
                titleAnim = null;
            }
            return true;
        }
       
        if (keyboard.wasKeyPressed(IO.KEYS.Space) || this.clickedReset(pointer)) {
            if (this.editData !== null) {
                this.reset();
            } else {
                this.resettingAnim = resetFlip.setupPlayback(DEFAULT_FRAME_TIME, false);
            }
        }

        if (this.editUpdate(now, elapsed, keyboard, pointer)) {
            return true;
        }

        AGENT.updateAnims(elapsed);
        
        if (this.tutorial) {
            if (keyboard.keysDown() > 0 || pointer.activated()) {
                this.tutorial = null;
            }
            return;
        }

        if (this.rewinding) {
            BLIT.updatePlaybacks(elapsed, [goatExcited, goatStoic]);
            if (!this.rewinder.update(this, now, elapsed)) {
                this.rewound();
            }
            return;
        }
        
        if (this.resettingAnim !== null) {
            if (this.resettingAnim.update(elapsed)) {
                this.resettingAnim = null;
                this.reset();
            }
        }

        var sweeping = false;
        for (var h = 0; h < this.hands.length; ++h) {
            sweeping |= this.hands[h].update(now, elapsed);
        }

        for (var t = 0; t < this.triggers.length; ++t) {
            this.triggers[t].update(this, elapsed, now);
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
        var waiting = this.stepTimer !== null || this.triggering() || this.gameOver || this.resettingAnim !== null;
        this.player.update(this, waiting, sweeping, now, elapsed, keyboard, pointer);
        if (this.player.moves.length >= this.moveLimit && !this.updating()) {
            this.tryRewind();
        }
        return true;
    };
    
    World.prototype.clickedReset = function (pointer) {
        if (pointer.activated()) {
            var point = this.pointerLocation(pointer);
            return (point.squareI == this.width - 1) && (point.squareJ == this.height);
        }
        return false;
    };

    World.prototype.tryRewind = function () {
        if (this.replayers.length < this.replayLimit) {
            this.rewinding = true;
            this.fadeMusic();
            rewindSound.play();
        } else {
            this.gameOver = true;
        }
    };

    World.prototype.triggering = function () {
        for (var t = 0; t <  this.triggers.length; ++t) {
            if (this.triggers[t].updating()) {
                return true;
            }
        }
        return false;
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
        return this.triggering();
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
        if (keyboard.wasAsciiPressed("E") && keyboard.isShiftDown()) {
            if (this.editData !== null) {
                this.editData = null;
                editArea.className = "hidden";
                this.checkpoint();
            } else {
                this.editData = {
                    hand: null,
                    trigger: null,
                    deco: null,
                    lastHand: null,
                    lastTrigger: null,
                    lastDeco: null
                };
                editArea.className = "";
            }
        } else if (keyboard.wasAsciiPressed("S")) {
            editArea.value = this.save();
            editArea.select();
            editArea.focus();
            document.execCommand("copy");
            this.checkpoint();

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
        } else if (edit.trigger) {
            if (pointer.primary) {
                edit.trigger.i = at.squareI;
                edit.trigger.j = at.squareJ;
            } else {
                edit.lastTrigger = edit.trigger;
                edit.trigger = null;
            }
        } else if (edit.deco) {
            if (pointer.primary) {
                edit.deco.i = at.squareI;
                edit.deco.j = at.squareJ;
            } else {
                edit.lastDeco = edit.deco;
                edit.deco = null;
            }
        } else if (pointer.activated()) {
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
                edit.lastDeco = null;
            } else if(keyboard.isAltDown()) {
                for (var d = 0; d < this.decos.length; ++d) {
                    var deco = this.decos[d];
                    if (deco.i == at.squareI && deco.j == at.squareJ) {
                        edit.deco = deco;
                    }
                }
                if (!edit.deco) {
                    at = this.clampPoint(at);
                    edit.deco = new Decoration(at.squareI, at.squareJ, 0);
                    this.decos.push(edit.deco);
                }
                edit.lastHand = null;
                edit.lastTrigger = null;
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

                for (var u = 0; u < this.hands.length; ++u) {
                    var unhand = this.hands[u];
                    if (unhand.trigger == edit.lastTrigger) {
                        unhand.trigger = null;
                    }
                }
            } else if (edit.lastDeco) {
                this.decos.splice(this.decos.indexOf(edit.lastDeco), 1);
            }

            edit.lastHand = null;
            edit.lastTrigger = null;
            edit.lastDeco = null;
        } else if (keyboard.wasAsciiPressed("T")) {
            if (edit.lastHand !== null) {
                edit.lastHand.persist = !edit.lastHand.persist;
            } else if (edit.lastTrigger !== null) {
                edit.lastTrigger.action = (edit.lastTrigger.action + 1) % TRIGGER_ACTIONS.COUNT;
                edit.lastTrigger.triggerAnim = null;
            } else if (edit.lastDeco !== null) {
                edit.lastDeco.deco = (edit.lastDeco.deco + 1) % DECORATIONS.length;
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
            this.decos = [];
        } else if (keyboard.wasAsciiPressed("1") && keyboard.isShiftDown()) {
            this.width = Math.max(this.width - 1, 4);
        } else if (keyboard.wasAsciiPressed("1")) {
            this.width = Math.min(this.width + 1, 10);
        } else if (keyboard.wasAsciiPressed("2") && keyboard.isShiftDown()) {
            this.height = Math.max(this.height - 1, 2);
        } else if (keyboard.wasAsciiPressed("2")) {
            this.height = Math.min(this.height + 1, 10);
        } else if (keyboard.wasAsciiPressed("3") && keyboard.isShiftDown()) {
            this.moveLimit = Math.max(this.moveLimit - 1, 1);
        } else if (keyboard.wasAsciiPressed("3")) {
            this.moveLimit = Math.min(this.moveLimit + 1, 20);
        } else if (keyboard.wasAsciiPressed("4") && keyboard.isShiftDown()) {
            this.replayLimit = Math.max(this.replayLimit - 1, 0);
        } else if (keyboard.wasAsciiPressed("4")) {
            this.replayLimit = Math.min(this.replayLimit + 1, 5);
        } else if (keyboard.wasAsciiPressed("L")) {
            this.load(JSON.parse(editArea.value));
        } else if (keyboard.wasAsciiPressed("N")) {
            this.loadNext(1);
        } else if (keyboard.wasAsciiPressed("P")) {
            this.loadNext(-1);
        }
        return true;
    };

    World.prototype.draw = function (context, width, height) {
        if (background.complete) {
            var bgWidth = width,
                bgHeight = (width / background.width) * background.height;
            if ((background.width / background.height) > (width / height)) {
                bgHeight = height;
                bgWidth = (height / background.height) * background.width;
            }
            BLIT.draw(context, background, width * 0.5, height * 0.5, BLIT.ALIGN.Center, bgWidth, bgHeight);
        }

        if (this.loading || !batch.loaded) {
            context.save();
            context.font = "30px sans-serif";
            BLIT.centeredText(context, "LOADING", width / 2, height / 2, "rgb(128,0,128)", "rgb(255,0,255)", 1);
            context.restore();
            return;
        }
        
        if (titleAnim) {
            var titleWidth = width,
                titleHeight = (width / titleAnim.width()) * titleAnim.height();
            if ((titleAnim.width() / titleAnim.height()) < (width / height)) {
                titleHeight = height;
                titleWidth = (height / titleAnim.height()) * titleAnim.width();
            }

            titleAnim.draw(context, width * 0.5, height * 0.5, BLIT.ALIGN.Center, titleWidth, titleHeight);
            return;
        }

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
        
        for (var d = 0; d < this.decos.length; ++d) {
            this.decos[d].draw(context, this, scale);
        }
        
        if (this.resettingAnim !== null) {
            context.globalAlpha = 1 - this.resettingAnim.fractionComplete;
        }
        
        var minRow = 0,
            maxRow = this.height;
            
        for (i = 0; i < this.hands.length; ++i) {
            minRow = Math.min(minRow, this.hands[i].j);
            maxRow = Math.max(maxRow, this.hands[i].j);
        }
        
        for (i = 0; i < this.triggers.length; ++i) {
            minRow = Math.min(minRow, this.triggers[i].j);
            maxRow = Math.max(maxRow, this.triggers[i].j);
        }

        for (var row = minRow; row <= maxRow; ++row) {
            for (var h = 0; h < this.hands.length; ++h) {
                if (this.hands[h].j === row) {
                    this.hands[h].draw(context, this, this.editData !== null, scale);
                }
            }
        }

        for (row = minRow; row <= maxRow; ++row) {
            for (var t = 0; t < this.triggers.length; ++t) {
                if (this.triggers[t].j === row) {
                    this.triggers[t].draw(context, this, scale);
                }
            }
            
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

        context.globalAlpha = 1;
        
        var moveText = this.player.moves.length + " of " + this.moveLimit,
            replayText = this.replayers.length + " of " + this.replayLimit,
            shadow = "rgb(0,0,0)",
            uiScale = 1.25 * scale,
            uiY = this.totalHeight() + this.tileHeight * 0.5 - 2;
        context.font = "14px sans-serif";
        BLIT.draw(context, movePanel, this.tileWidth, uiY, BLIT.ALIGN.Center, movePanel.width * uiScale, movePanel.height * uiScale);
        BLIT.draw(context, rewindPanel, 2.25 * this.tileWidth, uiY, BLIT.ALIGN.Center, rewindPanel.width * uiScale, rewindPanel.height * uiScale);
        BLIT.centeredText(context, moveText, this.tileWidth, uiY + 6, "rgb(255,0,0)", shadow, 1);
        BLIT.centeredText(context, replayText, 2.25 * this.tileWidth, uiY + 6, "rgb(255,255,0)", shadow, 1);
        
        context.font = "24px sans-serif";
        BLIT.centeredText(context, "LEVEL " + (puzzleIndex + 1), this.width * 0.5 * this.tileWidth, -this.tileHeight * 0.75, "rgb(196,0,196)", shadow, 2);
        
        var reset = this.resettingAnim !== null ? this.resettingAnim : resetAnim;
        reset.draw(context, (this.width - 0.5) * this.tileWidth, (this.height + 0.25) * this.tileHeight, BLIT.ALIGN.Center, reset.width() * scale, reset.height() * scale);

        var goat = this.rewinding ? goatExcited : goatStoic;
        goat.draw(context, -this.tileHeight * 0.7, this.totalHeight() * 0.5, BLIT.ALIGN.Center, goat.width() * scale, goat.height() * scale, BLIT.MIRROR.Horizontal);
        
        if (this.tutorial) {
            BLIT.draw(context, textBubble, 0, this.totalHeight() * 0.5, BLIT.ALIGN.Left | BLIT.ALIGN.Center);
            context.font = "20px sans-serif";
            var TEXT_HEIGHT = 40,
                yOffset = -(this.tutorial.length - 1) * TEXT_HEIGHT * 0.5;
            for (var line = 0; line < this.tutorial.length; ++line) {
                BLIT.centeredText(context, this.tutorial[line], 270, this.totalHeight() * 0.5 + yOffset, "black");
                yOffset += TEXT_HEIGHT;
            }
        }
        
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

        for (var t = 0; t < this.triggers.length; ++t) {
            var trigger = this.triggers[t];
            if (trigger.i == newI && trigger.j == newJ && trigger.blocks()) {
                return false;
            }
        }

        return true;
    };

    World.prototype.moved = function (agent, move, relocated, playerControlled) {
        if (playerControlled) {
            this.startRestep();
        }
        if (move !== null) {
            this.rewinder.add(new Unmove(agent, move, relocated));
        }
        for (var t = 0; t < this.triggers.length; ++t) {
            var trigger = this.triggers[t];
            if (relocated && trigger.contains(agent)) {
                this.activateTrigger(trigger, agent);
            }
        }
    };

    World.prototype.activateTrigger = function (trigger, agent) {
        if (trigger.action == TRIGGER_ACTIONS.Clockwise || trigger.action == TRIGGER_ACTIONS.Counterclock) {
            crankSound.play();
            tickSound.play();
            var pushed = [];
            for (var h = 0; h < this.hands.length; ++h) {
                var hand = this.hands[h];
                if (hand.trigger == trigger) {
                    var push = hand.turn();
                    this.sweep(push, pushed);
                }
            }
        } else if(trigger.action == TRIGGER_ACTIONS.Mousetrap) {
            if (!trigger.triggered) {
                trigger.triggered = true;
                this.squish(agent);
                this.rewinder.add(new Unsquish([agent]));
                screamInPain();
            }
        } else if(trigger.action == TRIGGER_ACTIONS.Alarm && !trigger.triggered) {
            trigger.triggered = true;
            var exits = [];
            for (var t = 0; t < this.triggers.length; ++t) {
                var other = this.triggers[t];
                if (other.action == TRIGGER_ACTIONS.Exit) {
                    other.triggered = true;
                    exits.push(other);
                }
            }
            alarmSound.play();
            this.rewinder.add(new Unring(trigger, exits));
        } else if(trigger.action == TRIGGER_ACTIONS.Exit) {
            victorySound.play();
            
            if (agent != this.player) {
                var i = agent.i,
                    j = agent.j;
                agent.i = this.player.i;
                agent.j = this.player.j;
                this.player.i = i;
                this.player.j = j;
            }

            this.player.win();
        }
    };
    
    function inList(list, item) {
        for (var i = 0; i < list.length; ++i) {
            if (list[i] == item) {
                return true;
            }
        }
        return false;
    }

    World.prototype.sweep = function (push, pushed) {
        var sweeps = [],
            squishes = [];
        if (this.player.isAt(push.i, push.j) && !inList(pushed, this.player)) {
            pushed.push(this.player);
            if (this.canMove(this.player, push.newI, push.newJ, push.hand)) {
                this.player.sweep(push);
                sweeps.push(new Unmove(this.player, push.move, true));
            } else {
                this.squish(this.player);
                squishes.push(this.player);
            }
        }

        for (var r = 0; r < this.replayers.length; ++r) {
            var replayer = this.replayers[r];
            if (replayer.isAt(push.i, push.j) && !replayer.squished() && !inList(pushed, replayer)) {
                pushed.push(replayer);
                if (this.canMove(replayer, push.newI, push.newJ, push.hand)) {
                    replayer.sweep(push);
                    sweeps.push(new Unmove(replayer, push.move, true));
                } else {
                    this.squish(replayer);
                    squishes.push(replayer);
                }
            }
        }
        this.rewinder.add(new Untick(push.hand, push.direction, sweeps));
        if (squishes.length > 0) {
            this.rewinder.add(new Unsquish(squishes));
            screamInPain();
        }
    };

    World.prototype.squish = function (player) {
        player.squish();
    };

    World.prototype.onDeath = function (playerControlled) {
        if (playerControlled) {
            this.tryRewind();
        }
    };

    World.prototype.onWin = function () {
        this.loadNext(1);
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
        for (var t = 0; t < this.triggers.length; ++t) {
            this.triggers[t].rewind();
        }
        for (var h = 0; h < this.hands.length; ++h) {
            this.hands[h].rewind();
        }
        this.replayers.push(new AGENT.Replayer(this.startI, this.startJ, this.player.moves));
        this.setupPlayer();

        this.rewinder = new Rewinder();
        this.rewinding = false;

        this.startRestep();
        this.resumeMusic();
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
            hands: this.saveHands(),
            decos: this.saveDecos()
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

    World.prototype.saveDecos = function () {
        var data = [];
        for (var d = 0; d < this.decos.length; ++d) {
            data.push(this.decos[d].save());
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
        this.decos = [];
        this.replayers = [];
        this.rewinder = new Rewinder();
        this.rewinding = false;

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
        
        if (data.decos) {
            for (var d = 0; d < data.decos.length; ++d) {
                var decoData = data.decos[d];
                this.decos.push(new Decoration(decoData.i, decoData.j, decoData.deco));
            }
        }

        this.setupPlayer();
        this.loading = false;
    };

    World.prototype.loadNext = function (offset) {
        puzzleIndex += offset;
        if (0 <= puzzleIndex && puzzleIndex < puzzles.length) {
            loadWorld(puzzles[puzzleIndex], this);
        }
    };

    function loadWorld(resource, world) {
        if (!world) {
            world = new World(10, 10);
            var parts = window.location.href.split("load=");
            if (parts.length > 1) {
                resource = "puzzles/" + parts[1].split("&")[0];
            }
        } else {
            world.checkpoint();
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

    function start() {
        return loadWorld(puzzles[puzzleIndex]);
    }

    return {
        World: World,
        start: start
    };
}());
