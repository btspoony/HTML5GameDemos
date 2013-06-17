// statics 
var STATE_MONS_READY = "mons_ready";
var STATE_WAIT = "wait";
var STATE_YOUR_TURN = "yourturn";
var STATE_INIT = "init";
var STATE_CARDS_READY = "cards_ready";
var STATE_PLAY_ATTACK = "play_attack";

var CARDs = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
var TYPEs = ['C','D','H','S'];

// utils
function uid(len) {
  var buf = [],
   chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',//~!@#$%^&*()_+-=[]{}:;?><.,'
   charlen = chars.length;

  for (var i = 0; i < len; ++i) {
    buf.push(chars[randomInt(charlen)]);
  }
  return buf.join('');
}
function randomInt( max ){
  return Math.floor(Math.random() * max);
}

// Manager Classes
var Progress = cc.Class.extend({ 
  _currentLeader: -1,
  _currentPlayer: -1,
  ctor: function ( sceneCtrl ) {
    this.scheduler = game.director.getScheduler();
    this._scene = sceneCtrl;
    // progress state
    this._state = STATE_INIT;
    this.__defineGetter__("state", function(){ return this._state;});

    // init players cards
    this._playercards = [];
    for( var i = 0; i < 4 ; i ++ ){
      this._playercards[i] = [];
      for(var j = 0; j < 13 ; j++ ){
        this._playercards[i][j] = {
          id: "char"+randomInt(25),
          value: randomInt(13),
          type: randomInt(3),
          flag: (j === 0)
        };
      }
    }
    this.pickcards = [];
    
    // init current mons
    this._currentMons = null;
    this.__defineGetter__("mons", function(){ return this._currentMons;});
    
    // some actions 
    this.__defineGetter__("_newRoundSeq", function(){
      var delay = cc.DelayTime.create(1);
      var func = cc.CallFunc.create(this.newRound,this);
      return cc.Sequence.create(delay, func);
    });

    this.__defineGetter__("_nextPickSeq", function(){
      var delay = cc.DelayTime.create(0.5);
      var func = cc.CallFunc.create(this.nextPick,this);
      return cc.Sequence.create(delay, func);
    });

    this.__defineGetter__("_attackSeq", function(){
      var delay = cc.DelayTime.create(0.5);
      var func = cc.CallFunc.create(this.attack,this);
      return cc.Sequence.create(delay, func);
    });

    this.__defineGetter__("_damageSeq", function(){
      var delay = cc.DelayTime.create(2);
      var func = cc.CallFunc.create(this._damage,this);
      return cc.Sequence.create(delay, func);
    });

    this.__defineGetter__("_nextWaveSeq", function(){
      var delay = cc.DelayTime.create(2);
      var func = cc.CallFunc.create(this.nextWave,this);
      return cc.Sequence.create(delay, func);
    });

  },
  runSeq: function( seq ){
    // game.director.getRunningScene().runAction(seq);
    this._scene.rootNode.runAction(seq);
  },
  nextWave: function() {
    this._state = STATE_MONS_READY;
    var mons = [];
    for (var i = 0; i < 3; i++) {
      mons[i] = {
        id: "char"+randomInt(25),
        name: uid(6),
        level: randomInt(10)+1,
        hp: 100
      };
    }
    this._currentMons = mons;
    // call on mons ready
    this._scene.onMonsReady();
    // new round in 1s
    this.runSeq(this._newRoundSeq);
  },
  newRound: function() {
    this._state = STATE_WAIT;
    // change card values
    for( var i = 0; i < 4 ; i ++ ){
      for(var j = 0; j < 13 ; j++ ){
        this._playercards[i][j].value = randomInt(13);
      }
    }
    // choose a current leader
    this.chooseLeader();

    // call on new round
    this._scene.onNewRound( this.autoPick() );
    // next pick in 0.5s
    this.runSeq(this._nextPickSeq);
  },
  getCards: function(){
    this._state = STATE_YOUR_TURN;

    var all = this._playercards[this.getCurrentPlayer()].slice();
    all.shift();

    var picked = [];
    for (var i = picked.length; i < 4; i++) {
      picked.push(all.splice(randomInt(all.length), 1)[0] );
    }
    return picked;
  },
  onePick: function( card ) {
    // add to pickcards
    this.pickcards.push(card);

    // call scene display
    this._scene.onOnePick( this._currentPlayer, card, function(){
      // check next
      if( !this.checkCardsDone() ){
        this.nextPlayer();
        this.nextPick();
      }else{
        // attack in 1.0s
        this.runSeq(this._attackSeq);
      }
    });
  },
  nextPick: function(){},
  autoPick: function(){},
  nextPlayer: function(){},
  chooseLeader: function(){
    this._currentPlayer = 0;
    this._currentLeader = 0;
  },
  getCurrentPlayer: function(){ return this._currentPlayer; },
  getCurrentLeader: function(){ return this._currentLeader; },
  checkCardsDone: function(){
    var isDone = this.pickcards.length === 5;
    if( isDone ){
      this._state = STATE_CARDS_READY;
    }
    return isDone;
  },
  attack: function() {
    this._state = STATE_PLAY_ATTACK;
    // set scene ready
    this._scene.onCardsReady();

    this.pickcards.sort(function(a,b){
      return a.value - b.value;
    });
    // calculate data
    var cards = this.pickcards.map(function(card){
      return CARDs[card.value]+TYPEs[card.type];
    });
    var result = rankHandInt(cards);
    // display result
    this._scene.onRoundResult( result );

    // then damage mons
    this.runSeq(this._damageSeq);
  },
  _damage:function(){
    // calcutate attack info
    var damage = [];
    var allhp = 0;
    for (var i = 2; i >= 0; i--) {
      damage[i] = randomInt(33);
      this._currentMons[i].hp = Math.max(0, this._currentMons[i].hp - damage[i]);
      allhp += this._currentMons[i].hp;
    }
    this._scene.onAttack(damage);
    // then next round
    if( allhp > 0 ){
      this.runSeq(this._newRoundSeq);
    }else{
      this.runSeq(this._nextWaveSeq);
    }
  }
});

var MultiPlayerProgress = Progress.extend({
  ctor: function (sceneCtrl) {
    this._super(sceneCtrl);
    // actions
    this.__defineGetter__("_aiPickSeq", function(){
      var delay = cc.DelayTime.create(0.5);
      var func = cc.CallFunc.create(this.aiPick,this);
      return cc.Sequence.create(delay, func);
    });
  },
  getCards: function(){
    var picked = this._super();
    if( this._currentLeader !== this._currentPlayer ){
      var all = this._playercards[this._currentPlayer].slice();
      
      picked = [];
      for (var i = picked.length; i < 4; i++) {
        picked.push(all.splice(randomInt(all.length), 1)[0] );
      }
    }
    return picked;
  },
  autoPick: function(){
    this.pickcards = [this._playercards[this._currentLeader][0]];
    return this.pickcards;
  },
  nextPick: function(){
    if( this._currentPlayer === 0 ){
      this._scene.onCurrentPlayerStart();
    }else{
      // ai pick
      this.runSeq(this._aiPickSeq);
    }
  },
  aiPick: function(){
    var cards = this.getCards();
    var card = cards[randomInt(cards.length)];
    this.onePick(card);
  },
  nextPlayer: function(){
    this._currentPlayer = (this._currentPlayer + 1) % 4;
  },
  chooseLeader: function() {
    this._currentLeader = (this._currentLeader + 1) % 4;
    this._currentPlayer = this._currentLeader;
  }
});

var SinglePlayerProgress = Progress.extend({
  _isNewRound: true,
  ctor: function(sceneCtrl) {
    this._super(sceneCtrl);
    this.mine = this._playercards[0];
    this.friend = this._playercards[1];
  },
  autoPick: function(){
    this.pickcards = [this.mine[0], this.friend[0]];
    return this.pickcards;
  },
  nextPick: function(){
    if( this._isNewRound ){
      // call scene
      this._scene.onCurrentPlayerStart();
      this._isNewRound = false;
    }else{
      this._scene.onWaitPick();
    }
  },
  chooseLeader: function() {
    this._super();
    this._isNewRound = true;
  }
});

var GameCreator = function() {
  var self = {};
  self.mode = 1;
  self.state = "main";

  var _director;
  self.__defineGetter__("director", function(){
    if( !_director ){
      _director = cc.Director.getInstance();
    }
    return _director;
  });

  self.getGameScene = function() {
    var scene = cc.BuilderReader.loadAsScene("GameScene.ccbi");
    return scene;
  };
  
  self.getMainScene = function() {
    var scene = cc.BuilderReader.loadAsScene("MainScene.ccbi");
    return scene;
  };

  self.createCard = function( data ) {
    var card = cc.BuilderReader.load("cardFrame.ccbi");
    card.controller.init(data);
    return card;
  };

  self.startNewGame = function( sceneCtrl ){
    if( self.progress ){
      delete self.progress;
    }
    self.progress = self.mode == 1? new MultiPlayerProgress(sceneCtrl): new SinglePlayerProgress(sceneCtrl);
    return self.progress;
  };

  return self;
};
var game = GameCreator();

// Controller classes
var MainScene = function(){};

MainScene.prototype.onStartMultiPlayer = function(){
  game.mode = 1;
  game.state = "game";
  game.director.replaceScene( cc.TransitionFade.create(1, game.getGameScene()) );
};

MainScene.prototype.onStartSinglePlayer = function() {
  game.mode = 2;
  game.state = "game";
  game.director.replaceScene( cc.TransitionFade.create(1, game.getGameScene()) );
};

// Game Scene controller
var GameScene = function(){};
// game init
GameScene.prototype.onDidLoadFromCCB = function()
{
  // chars sprite cache
  cc.SpriteFrameCache.getInstance().addSpriteFrames("allchars.plist");

  this.players = [this.player0, this.player1, this.player2, this.player3];
  // check game mode then set player frames
  for (var i = this.players.length - 1; i > 0; i--) {
    if( game.mode == 2 ){
      this.players[i].setOpacity(10);
    }else{
      this.players[i].controller.init({
        name : "NPC["+uid(2)+"]",
        level: randomInt(10)+1
      });
    }
  }
  this.players[0].controller.init({
    name: "Player",
    level: randomInt(10)+1
  });

  // hide mons
  this.mons.setVisible(false);

  // start the game
  this.progress = game.startNewGame(this);
  this.progress.nextWave();

  // picked
  this._pickedCards = [];
 };

// menu
GameScene.prototype.onBackToMain = function(){
  game.state = "main";
  game.director.replaceScene( cc.TransitionFade.create(1, game.getMainScene()) );
};

// update
GameScene.prototype.onMonsReady = function(){
    var i;
    // set mons info
    var monsInfo = this.progress.mons;
    var info;
    this.mons.setVisible(false);
    for (i = monsInfo.length - 1; i >= 0; i--) {
      this["mon"+i].controller.init(monsInfo[i]);
    }
    // fade to display
    this.mons.setVisible(true);
};

GameScene.prototype.onNewRound = function( auto ){
  this._pickedCards.length = 0;
  if( auto ){
    // set auto pick cards
    for (i = auto.length - 1; i >= 0; i--) {
      // this.addPickCard(auto[i]);
      this.addPickCard(null, auto[i]);
    }
  }

  // set leader flag
  var leader = this.progress.getCurrentLeader();
  for (var i = 3; i >= 0; i--) {
    this["player"+i].controller.setActive(leader == i);
  }
};

GameScene.prototype.onCurrentPlayerStart = function(){
  if( this.progress.getCurrentPlayer() !== 0 ) return;

  var cards = this._currentCards = this.progress.getCards();
  this.mycards.setVisible(false);
  for (var i = cards.length - 1; i >= 0; i--) {
    cards[i].index = i;
    var card = game.createCard(cards[i]);
    this["card"+i].addChild(card);
  }
  this.mycards.setPositionX(320);
  this.mycards.setVisible(true);
  var move = cc.EaseBackOut.create( cc.MoveTo.create(0.5, cc.p(0, this.mycards.getPositionY())) );
  var func = cc.CallFunc.create(this.onWaitPick, this);
  this.mycards.runAction( cc.Sequence.create(move, func) );
};

GameScene.prototype.onOnePick = function( index, card, callback) {
  var player = this["player"+index];
  card = game.createCard( card );
  player.addChild(card);

  // then add to add Pick Card;
  var delay = cc.DelayTime.create(0.5);
  var func = cc.CallFunc.create(this.addPickCard, this, card);
  var cb = cc.CallFunc.create( callback, this.progress );
  this.rootNode.runAction(cc.Sequence.create(delay, func, cb ));
};

GameScene.prototype.onWaitPick = function() {
  // TODO use user interface

  var delay = cc.DelayTime.create(1);
  var func = cc.CallFunc.create(this._pickCard, this, randomInt(this._currentCards.length));
  this.rootNode.runAction(cc.Sequence.create(delay, func));
};

GameScene.prototype._pickCard = function( self, index ){
  var card = this._currentCards.splice(index,1)[0];
  this.progress.onePick(card);

  // invisible card
  this["card"+card.index].setVisible(false);
};

GameScene.prototype.onCardsReady = function(){
  var cards = [];
  var card, i;
  for (i = this._pickedCards.length - 1; i >= 0; i--) {
    card = this._pickedCards[i];
    card.removeFromParent();
    cards.push(card);
  }
  // sort card
  cards.sort(function(a,b){
    return a.controller.data.value - b.controller.data.value;
  });
  for (i = 0; i< 5; i++) {
    this['pick'+i].addChild(cards[i]);
  }
};

GameScene.prototype.onRoundResult = function( result ){
  var self = this;
  this.result.setString(result.message);
  this.result.setOpacity(0);
  this.result.setVisible(true);
  var fadeIn = cc.FadeIn.create(0.3);
  var delay = cc.DelayTime.create(1.5);
  var fadeOut = fadeIn.reverse();
  this.result.runAction(cc.Sequence.create( fadeIn, delay, fadeOut) );
};

GameScene.prototype.onAttack = function( damage ){
  // on hit
  var hit;
  for (var i = damage.length - 1; i >= 0; i--) {
    hit = damage[i];
    this["mon"+i].controller.hit(hit);
  }

  // fade out cards
  var delay = cc.DelayTime.create(0.5);
  var hide = cc.Hide.create();
  var func = cc.CallFunc.create(this.onCleanStage, this);
  this.allcards.runAction(cc.Sequence.create( delay, hide, func ));
};

GameScene.prototype.onCleanStage = function(){
  var i;
  for (i = 4; i >= 0; i--) {
    if( i < 4){
      this["card"+i].removeAllChildren(true);
      this["card"+i].setVisible(true);
    }
    this["pick"+i].removeAllChildren(true);
  }
  this.allcards.setVisible(true);
};

GameScene.prototype.addPickCard = function( self, info ){
  var card;
  if( info instanceof cc.Node ){
    card = info;
    card.removeFromParent();
  }else{
    card = game.createCard(info);
  }
  // card.setScale( cc.p(0.8,0.8) );
  card.setScale( 0.8,0.8 );

  this._pickedCards.push(card);
  var index = this._pickedCards.length-1;
  this["pick"+index].addChild(card);
};

// Player Frame Controller
var PlayerFrame = function(){};
PlayerFrame.prototype.onDidLoadFromCCB = function(){
  this.name.setString("");
  this.level.setString("");
  this.flag.setVisible(false);
};

PlayerFrame.prototype.init = function( data ){
  this.name.setString(data.name);
  this.level.setString("Lv."+data.level);
};
PlayerFrame.prototype.setActive = function( value ){
  this.flag.setVisible(!!value);
};

// Monster Frame Controller
var MonFrame = function(){};
MonFrame.prototype.onDidLoadFromCCB = function(){
  this.rootNode.removeChild(this.bar);
  this.pbar = cc.ProgressTimer.create(this.bar);
  this.pbar.setType(cc.PROGRESS_TIMER_TYPE_BAR);
  this.pbar.setAnchorPoint(cc.p(0.5,0));
  this.pbar.setPositionY(-1);
  this.pbar.setBarChangeRate(cc.p(1, 0))
  this.pbar.setMidpoint(cc.p(0,0));
  this.rootNode.addChild(this.pbar);

  this.__defineGetter__("hp", function(){ return this._hp; });
};
MonFrame.prototype.init = function( data ){
  this.rootNode.setVisible(false);
  this.name.setString(data.name);
  this.level.setString("Lv."+data.level);

  if( this._currDO ){
    this.charnode.removeChild(this._currDO, true);
  }
  this._currDO = cc.Sprite.createWithSpriteFrameName(data.id);
  this._currDO.setOpacity(0);
  this._currDO.runAction(cc.FadeIn.create(1));
  this.charnode.addChild(this._currDO);
  
  this._hp = data.hp;
  this._hpmax = data.hp;
  this.pbar.setPercentage(100);
  this.rootNode.setVisible(true);
};
MonFrame.prototype.hit = function ( damage ){
  var curr = this._hp;
  if( curr<=0 ){
    return;
  }

  var action = cc.ProgressFromTo.create(0.3, curr / this._hpmax * 100, Math.max(0,(curr - damage) / this._hpmax * 100 ))
  this.pbar.runAction(action);
  this._hp = curr - damage;

  if( this._currDO.numberOfRunningActions() === 0 ){
    if( this._hp <= 0 ){
      this._currDO.runAction(cc.FadeOut.create(1));
    }else{
      this._currDO.runAction(cc.Blink.create(0.4, 2));
    }
  }
};

// Card Frame Controller
var CardFrame = function(){};
CardFrame.prototype.onDidLoadFromCCB = function(){
  this.rootNode.setVisible(false);
};
CardFrame.prototype.init = function( data ){
  this.data = data;
  // set info
  this.value.setString(CARDs[data.value]);
  this["type"+data.type].setVisible(true);
  this.flag.setVisible(!!data.flag);

  // set display
  if( this._currDO ){
    this.charnode.removeChild(this._currDO, true);
  }
  this._currDO = cc.Sprite.createWithSpriteFrameName(data.id);
  var parentSize = this["type"+data.type].getContentSize();
  var size = this._currDO.getContentSize();
  if( parentSize.width < size.width ){
    var scale = parentSize.width/size.width;
    this._currDO.setScale( scale, scale );
    // this._currDO.setScale( cc.p(scale, scale) );
    // size = this._currDO.getContentSize();
    // this._currDO.setPosition( cc.p(size/2,size/2) );
  }
  this.charnode.addChild(this._currDO);

  this.rootNode.setVisible(true);
};