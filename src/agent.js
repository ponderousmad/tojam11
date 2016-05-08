var AGENT = (function () {
    "use strict";
    
    var PLAYER_FRAME_TIME = 32,
        REWIND_FRAME_TIME = 10,
        DEATH_FRAMES = 15,
        batch = new BLIT.Batch("images/"),
        playerAnim = new BLIT.Flip(batch, "mouse-A-idle-2_", 20, 2).setupPlayback(PLAYER_FRAME_TIME, true),
        playerRewind = new BLIT.Flip(batch, "mouse-A-rewind_", 10, 2).setupPlayback(REWIND_FRAME_TIME, true),
        playerWalkFlip = new BLIT.Flip(batch, "mouse-A-walk-00_", 10, 2),
        playerDeathFlip = new BLIT.Flip(batch, "mouse-A-dead_", DEATH_FRAMES, 2),
        replayerAnim = new BLIT.Flip(batch, "mouse-B-idle-", 1, 2).setupPlayback(PLAYER_FRAME_TIME, true),
        replayerRewind = new BLIT.Flip(batch, "mouse-B-rewind-00_", 10, 2).setupPlayback(REWIND_FRAME_TIME, true),
        splatImage = batch.load("splat.png"),
        loopAnims = [
            playerAnim, playerRewind, replayerAnim, replayerRewind
        ],
        stepSounds = [],
        entropy = ENTROPY.makeRandom();
    

    (function () {
        var STEP_SOUNDS = 3;
        for (var step = 1; step <= STEP_SOUNDS; ++step) {
            var noise = new BLORT.Noise("sounds/steps0" + step + ".wav");
            stepSounds.push(noise);
        }
        batch.commit();
    }());
    
    function canMove(world, player, move) {
        return world.canMove(player, player.i + move.i, player.j + move.j);
    }
    
    function doMove(world, player, move) {
        player.i += move.i;
        player.j += move.j;
    }
    
    function doRewind(player, i, j, iDir, unsquishFraction, deathFlip) {
        player.rewinding = true;
        player.i = i;
        player.j = j;
        if (iDir !== 0) {
            player.facing = iDir > 0;
        }
        if (unsquishFraction !== null) {
            player.deathAnim = deathFlip.setupPlayback(PLAYER_FRAME_TIME, false, PLAYER_FRAME_TIME * DEATH_FRAMES * unsquishFraction);
        } else {
            player.deathAnim = null;
        }
    }
    
    function updatePush(world, player) {
        if (player.push !== null) {
            if (!player.push.hand.moving()) {
                doMove(world, player, player.push.move);
                world.moved(player, null, true, false);
                player.push = null;
            }
            return true;
        }
        return false;
    }
    
    function draw(context, world, anim, x, y, facing, scale) {
        if (!batch.loaded) {
            return;
        }
        var width = anim.width(),
            height = anim.height();
        anim.draw(context, x, y, BLIT.ALIGN.Center, width * scale, height * scale, facing);
    }
    
    function Player(i, j) {
        this.i = i;
        this.j = j;
        this.moves = [];
        this.moveTimer = null;
        this.push = null;
        this.facing = BLIT.MIRROR.None;
        this.walk = null;
        this.rewinding = false;
        this.deathAnim = null;
    }
    
    Player.prototype.update = function (world, waiting, sweeping, now, elapsed, keyboard, pointer) {
        if (this.walk !== null) {
            if (this.walk.update(elapsed)) {
                this.walk = null;
            }
        }
        if (waiting || sweeping) {
            updatePush(world, this);
            return;
        }
        if (this.deathAnim !== null) {
            if (this.deathAnim.update(elapsed)) {
                world.onDeath(true);
            }
            return;
        }
        
        if (this.moveTimer) {
            this.moveTimer -= elapsed;
            if (this.moveTimer < 0) {
                this.moveTimer = null;
                var move = this.moves[this.moves.length - 1],
                    relocated = false;
                if (canMove(world, this, move)) {
                    doMove(world, this, move);
                    relocated = true;
                }
                world.moved(this, move, relocated, true);
            }
            return;
        }
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
    
    Player.prototype.squish = function () {
        this.deathAnim = playerDeathFlip.setupPlayback(PLAYER_FRAME_TIME, false);
    };
    
    Player.prototype.updating = function () {
        if (this.moveTimer !== null) {
            return true;
        }
        if (this.push !== null) {
            return true;
        }
        return false;
    };

    Player.prototype.tryMove = function (world, iStep, jStep) {
        this.moves.push({i:iStep, j:jStep});
        this.moveTimer = world.stepDelay;
        if (iStep !== 0) {
            this.facing = iStep < 0 ? BLIT.MIRROR.Horizontal : BLIT.MIRROR.None;
        }
        this.walk = playerWalkFlip.setupPlayback(PLAYER_FRAME_TIME, false);
        
        entropy.randomElement(stepSounds).play();
    };
    
    Player.prototype.sweep = function(push) {
        this.push = push;
    };

    Player.prototype.isAt = function (i, j) {
        return this.i == i && this.j == j;
    };
    
    Player.prototype.rewindTo = function (i, j, iDir, unsquishFraction) {
        doRewind(this, i, j, iDir, unsquishFraction, playerDeathFlip);
    };
    
    Player.prototype.draw = function (context, world, imageScale) {
        var x = (this.i + 0.5) * world.tileWidth,
            y = (this.j + 0.5) * world.tileHeight,
            anim = null,
            move = null,
            moveFraction = 0;
        
        if (this.deathAnim !== null) {
            anim = this.deathAnim;
        } else if (this.rewinding) {
            anim = playerRewind;
        } else {
            anim = this.walk !== null ? this.walk : playerAnim;
            if (this.push !== null) {
                moveFraction = this.push.hand.moveFraction();
                move = this.push.move;
            } else if (this.moveTimer !== null) {
                moveFraction = 1 - this.moveTimer / world.stepDelay;
                move = this.moves[this.moves.length-1];   
            }

            if (move !== null) {
                if (moveFraction > 0.5 && !canMove(world, this, move)) {
                    moveFraction = 1 - moveFraction;
                }
                x += moveFraction * move.i * world.tileWidth;
                y += moveFraction * move.j * world.tileHeight;
            }
        }
        
        draw(context, world, anim, x, y, this.facing, imageScale);
    };
    
    function Replayer(i, j, moves) {
        this.i = i;
        this.j = j;
        this.startI = i;
        this.startJ = j;
        this.moves = moves;
        this.moveIndex = 0;
        this.push = null;
        this.facing = BLIT.MIRROR.None;
        this.rewinding = false;
        this.deathAnim = null;
    }
    
    Replayer.prototype.squish = function () {
        this.deathAnim = playerDeathFlip.setupPlayback(PLAYER_FRAME_TIME, false);
    };
    
    Replayer.prototype.step = function (world) {
        if (this.moveIndex >= this.moves.length) {
            return;
        }
        
        var move = this.moves[this.moveIndex],
            relocated = false;
        if (move.i !== 0) {
            this.facing = move.i < 0 ? BLIT.MIRROR.Horizontal : BLIT.MIRROR.None;
        }
        if (canMove(world, this, move)) {
            doMove(world, this, move);
            relocated = true;
        }
        world.moved(this, move, relocated, false);
        this.moveIndex += 1;
    };
    
    Replayer.prototype.update = function (world, now, elapsed) {
        if (this.deathAnim !== null) {
            this.deathAnim.update(elapsed);
        }
        updatePush(world, this);
    };
    
    Replayer.prototype.updating = function () {
        if (this.push !== null) {
            return true;
        }
        return false;
    };
    
    Replayer.prototype.rewind = function () {
        this.moveIndex = 0;
        this.i = this.startI;
        this.j = this.startJ;
        this.rewinding = false;
        this.push = null;
        this.facing = BLIT.MIRROR.None;
        this.deathAnim = null;
    };
    
    Replayer.prototype.rewindTo = function (i, j, iDir, unsquishFraction) {
        doRewind(this, i, j, iDir, unsquishFraction, playerDeathFlip);
    };

    Replayer.prototype.isAt = function (i, j) {
        return this.i == i && this.j == j;
    };
    
    Replayer.prototype.sweep = function (push) {
        this.push = push;
    };
    
    Replayer.prototype.draw = function (context, world, imageScale, moveFraction) {
        var x = (this.i + 0.5) * world.tileWidth,
            y = (this.j + 0.5) * world.tileHeight,
            move = null,
            anim = replayerAnim;
        if (this.deathAnim) {
            anim = this.deathAnim;
            context.save();
            var splatFactor = this.deathAnim.fractionComplete;
            context.globalAlpha = splatFactor;
            splatFactor *= imageScale;
            BLIT.draw(context, splatImage, x, y, BLIT.ALIGN.Center, splatImage.width * splatFactor, splatImage.height * splatFactor);
            context.restore();
            if (this.deathAnim.fractionComplete >= 1.0) {
                return;
            }
        }
        else if (this.rewinding) {
            anim = replayerRewind;
        } else {
            if (this.push !== null) {
                move = this.push.move;
                moveFraction = this.push.hand.moveFraction();
            } if (moveFraction !== null && this.moveIndex < this.moves.length) {
                move = this.moves[this.moveIndex];
                if (!canMove(world, this, move) & moveFraction > 0.5) {
                    moveFraction = 1 - moveFraction;
                }
            }
            if (move !== null) {
                x += world.tileWidth * move.i * moveFraction;
                y += world.tileWidth * move.j * moveFraction;
            }
        }
        draw(context, world, anim, x, y, this.facing, imageScale);
    };
    
    return {
        Player: Player,
        Replayer: Replayer,
        updateAnims: function(elapsed) { BLIT.updatePlaybacks(elapsed, loopAnims); }
    };
}());