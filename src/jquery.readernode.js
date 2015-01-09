/*
 *  jQuery ReaderNode v0.0.1
 *  A speed reading widget ala spritz for jquery
 *  http://github.com/
 *
 *  Made by willg
 *  inspired by github.com/miserlou/glance
 *  Under MIT License
 */
// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ( $, window, document, undefined ) {

  // Create the defaults once
  var pluginName = "readerNode",
    defaults = {
      wpm: 500,
      src: "",
      title: "Click Play"
    };

  // The actual plugin constructor
  function Plugin ( element, options ) {
    this.element = element;
    this.settings = $.extend( {}, defaults, options );
    this._defaults = defaults;
    this._name = pluginName;
    this.init();
  }

  // Avoid Plugin.prototype conflicts
  $.extend(Plugin.prototype, {
    wpm: 0,
    delay: 0,
    data: null,
    words: [],
    pointer: 0,
    running: false,
    decoderNode: null,
    contentNode: null,
    toolbarNode: null,

    init: function () {

      var my = this;
      my.setWpm(my.settings.wpm);

      $(my.element).addClass("readernode");
      my.decoderNode = $("<div/>");
      my.contentNode = $("<div/>", {"class": "word-content"}).appendTo(my.element);
      my.toolbarNode = $("<div/>", {"class": "word-toolbar"}).appendTo(my.element);

      my.wpsInput = $("<input/>", {
        "class": "wps-input",
        "value": my.wpm,
        "change": function() {
          my.setWpm(my.wpsInput.val());
        }
      }).appendTo(my.toolbarNode);

      my.toggleButton = $("<button/>", {
        "class": "toggle-button",
        "click": function() {
          my.togglePlayback();
        }
      }).appendTo(my.toolbarNode);

      if (my.settings.src) {
        my.setSource(my.settings.src);
      }
    },

    //
    //
    // loads src, resets pointer
    //
    //
    setSource: function(src) {

      var my = this,
          ogstate = this.running,
          resumeFunc = function() {
            if (ogstate) {
              my.startPlayback();
            }
          };

      my.stopPlayback();
      my.pointer = 0; // reset pointer

      if (typeof src === "string") {
        my.setData(src);
        resumeFunc();
      } else if (typeof src === "object") {
        my.setData(src.val());
        resumeFunc();
      } else {
        console.error("invalid src");
      }
    },

    //
    //
    // sets the wordsperminute rate
    //
    //
    setWpm: function(wpm) {
      this.wpm = wpm;
      this.delay = 60000 / this.wpm;
    },


    //
    //
    // splits the raw string into the words array
    //
    //
    setData: function(data) {
      this.data = data;
      this.words = this.data.split(/\s+/);
      if (this.words[0] === "") {
        this.words.shift();
      }

      if (this.words[ this.words.length - 1 ] === "") {
        this.words.pop();
      }
    },

    //
    //
    // set pointer to specific point
    //
    //
    setPointer: function(index) {
      this.pointer = index;
    },

    //
    //
    // advance the the word pointer 1 step
    //
    //
    fwdPointer: function() {
      this.setPointer(this.pointer + 1);
    },

    //
    //
    // retard the the word pointer 1 step
    //
    //
    revPointer: function() {
      this.setPointer(this.pointer - 1);
    },

    //
    //
    //
    //
    //
    getWord: function (index) {

      var word = {
        index: index,
        raw: this.decodeEntities( this.words[index] ),
        delay: this.delay, //ms to flash word for
        pre: "",   //pre pivot particle
        pivot: "", //pivot character
        post: ""  //post pivot particle
      },
      pivot = 1;

      if (word.raw.match(/[\,\:\-\(\.]|\w{8,}/)) {
        word.delay *= 2; //double delay characters and long words
      }

      if (word.raw.length > 1) {
        if (word.raw.length <= 5) {
          pivot = 2;
        } else if (word.raw.length <= 9) {
          pivot = 3;
        } else if (word.raw.length <= 13) {
          pivot = 4;
        } else {
          pivot = 5;
        }
      }

      word.pre = word.raw.substr(0, pivot-1);
      if (word.pre === "") {//prevent empty leading cell
        word.pre = "&nbsp;";
      }

      word.pivot = word.raw.substr(pivot-1, 1);
      word.post = word.raw.substr(pivot, word.raw.length);

      return word;
    },

    decodeEntities: function (str) {
      if(str && typeof str === "string") {
        // strip script/html tags
        str = str.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, "");
        str = str.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gmi, "");
        this.decoderNode.innerHTML = str;
        str = this.decoderNode.innerHTML;
      } else {
        console.error("str isnt a string");
      }
      console.groupEnd();
      return str;
    },

    renderWord: function(word) {

      $( this.contentNode ).empty();

      var wordNode = $("<div/>", {"class": "word"}).appendTo(this.contentNode),
          preNode = $("<div/>", {"class": "word-pre"}).appendTo(wordNode),
          pivotNode = $("<div/>", {"class": "word-pivot"}).appendTo(wordNode),
          postNode = $("<div/>", {"class": "word-post"}).appendTo(wordNode);


      preNode.html(word.pre);
      pivotNode.html(word.pivot);
      postNode.html(word.post);

    },

    flashWord: function(word) {
      var my = this,
          deferred = $.Deferred();

      if (typeof word.delay === "number" && word.delay > 0) {

        my.renderWord(word);
        $(my.element).trigger("wordup", word);

        setTimeout(function() {
          deferred.resolve(true);
        }, my.delay * 2);
      } else {
        deferred.error("invalid word");
      }

      return deferred;
    },

    pauseWord: function(ms) {

      var deferred = $.Deferred();
      if (typeof ms === "number" && ms > 0) {
        this.flashWord({
          raw: "",
          delay: ms,
          pre: "",
          pivot: "",
          post: ""
        }).then(function() {
          deferred.resolve(true);
        });
      } else {
        deferred.error("invalid pause duration");
      }
      return deferred;

    },

    ticker: function() {

      if (this.running) { //queue the next one
        var my = this,
            word = my.getWord(my.pointer);

        my.flashWord(word).then(function() {
          my.fwdPointer();
          if (word.raw.match(/[\.\,]/)) { //add a blank gap after sentences
            my.pauseWord(3*my.delay).then(function() {
              console.log("pausing for sentence "+3*my.delay+"ms");
              my.ticker();
            });
          } else {
            my.ticker();
          }
        });
      }
    },


    //
    //
    //
    //
    //
    togglePlayback: function() {
      return (this.running) ? this.stopPlayback() : this.startPlayback();
    },


    //
    //
    //
    //
    //
    startPlayback: function() {
      this.running = true;
      $(my.element).trigger("playbackStarted", this.pointer);
      this.toggleButton.addClass("active");
      this.ticker();

    },

    //
    //
    //
    //
    //
    stopPlayback: function() {
      this.running = false;
      $(my.element).trigger("playbackStopped", this.pointer);
      this.toggleButton.removeClass("active");
    }

  });

  // A really lightweight plugin wrapper around the constructor,
  // preventing against multiple instantiations
  $.fn[ pluginName ] = function ( options ) {
    this.each(function() {
      if ( !$.data( this, "plugin_" + pluginName ) ) {
        $.data( this, "plugin_" + pluginName, new Plugin( this, options ) );
      }
    });

    // chain jQuery functions
    return this;
  };

})( jQuery, window, document );
