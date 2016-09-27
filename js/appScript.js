/***************************************************\
* @author       Niall Ainsworth                     *
* @contact      niallainsworth@gmail.com            *
* @date         08-02-2016                          *
* @description  JavaScript code for EyePan gaze     *
*               tracking and doodle application in  *
*               HTML5 created and written by Niall  *
*               Ainsworth. Created as part of a     *
*               final year project with Prof.Barack *
*               Pearlmutter for National University *
*               of Ireland, Maynooth.               *
*                                                   * 
*  Quick search for sections using '@SECTION_NAME'  *
\***************************************************/

//////// @GLOBAL VARIABLES \\\\\\\\\

  //Expose public objects to allow access from HTML elements
  var Canvas, Menu, Toolbox, Brush, Gaze, View;

(function($) {

///////// @DEBUGGING \\\\\\\\
    //Canvas for drawing debug info to when nessisary
    var debugCan = $('#canvas_debug')[0];
      debugCan.width = window.innerWidth;
      debugCan.height = window.innerHeight;
    var debugCtx = debugCan.getContext('2d');

  //Initally hide debug video
    var showVid = '0';
    xLabs.setConfig('frame.stream.preview', '0');
    $('#xLabsPreview').toggle();



//////// @CANVAS \\\\\\\\

  //Inititiate canvas and context for drawing eyetracking points to
  var can = $('#canvas_tools')[0];
    can.width = window.innerWidth;
    can.height = window.innerHeight;
  var ctx = can.getContext('2d');
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';

//Inititiate canvas and context for painting to
  var canP = $('#canvas_paint')[0];
    canP.width = canP.clientWidth;
    canP.height = canP.clientHeight;
  var ctxP = canP.getContext('2d');
    ctxP.lineWidth = 8;
    ctxP.strokeStyle = '#36F';
    ctxP.lineCap = 'round';
    ctxP.lineJoin = 'round';

  Canvas = {
    //Stores all data drawen to canvas
    log : [],
    hisPos : -1,

    //Continuos scroll state
    scrolldx : 0,
    scrolldy : 0,
    scrollSp : 15,

    //Holds the edge values of the image boundaries
    edge : [0, 0, 0, 0],

    //Holds data for an uploaded image
    image : {
      x : 0,
      y : 0,
      loaded : false
    },

    //Clears current canvas
    clear : function() {
      var viewDim = View.getDim();
      var relOrigin = View.canToCtx(0, 0);
      ctxP.clearRect(relOrigin.x, relOrigin.y, viewDim.width, viewDim.height);
    },

    //Reset the canvas context view and history
    reset : function() {
      this.clear();
      this.log = [];
      this.hisPos = -1;
      View.pos = [0, 0, 1];
      ctxP.setTransform(1, 0, 0, 1, 0, 0);
      ctxP.translate(canP.width / 2, canP.height / 2);
      View.translate(canP.width / -2, canP.height / -2);
    },

    //Draws data to canvas from log
    draw : function() {
      this.clear();

      if (this.image.loaded) {
        ctxP.drawImage(this.image.file, this.image.x, this.image.y);
      }

      if (this.log.length > 0) {
        ctxP.beginPath();
        ctxP.moveTo(this.log[0].x, this.log[0].y);
        for(var i = 0; i <= this.hisPos; i += 1) {
          if (typeof this.log[i].x === 'undefined') {
            ctxP.stroke();
            ctxP.strokeStyle = this.log[i].colour;
            ctxP.lineWidth = this.log[i].size;
            ctxP.beginPath();
            ctxP.moveTo(this.log[i + 1].x, this.log[i + 1].y);
            i += 1;
          } else {
            ctxP.lineTo(this.log[i].x, this.log[i].y);
          }
        }
        ctxP.stroke();
      }

      /*ctxP.beginPath();
        ctxP.moveTo(-1000, this.edge[0]);
        ctxP.lineTo(1000, this.edge[0]);
        ctxP.moveTo(-1000, this.edge[2]);
        ctxP.lineTo(1000, this.edge[2]);
        ctxP.moveTo(this.edge[1], -1000);
        ctxP.lineTo(this.edge[1], 1000);
        ctxP.moveTo(this.edge[3], -1000);
        ctxP.lineTo(this.edge[3], 1000);
      ctxP.stroke();*/
    },

    //Loads previous canvas image from history array
    undo : function() {
      if (this.hisPos > -1) {
        for (var i = this.hisPos; ; i -= 1) {
          if (typeof this.log[i].x === 'undefined' || i === 0) {
            this.hisPos = i - 1;
            break;
          }
        }
        this.draw();
      }
    },

    //Loads last saved canvas image from history array
    redo : function() {
      if (this.hisPos < this.log.length - 1) {
        for (var i = this.hisPos + 2; ; i += 1) {
          if (i === this.log.length || typeof this.log[i].x === 'undefined') {
            this.hisPos = i - 1;
            break;
          }
        }
        this.draw();
      }
    },

    //Checks scrolling state to enable continuous scrolling
    checkScroll : function() {
      if (this.scrolldx !== 0 || this.scrolldy !== 0) {
        //if (this.scrolldx > 0 && this.edge)
        this.scroll();
      }
    },

    //Scroll canvas content
    scroll : function() {
      var sX = this.scrolldx * View.pos[2];
      var sY = this.scrolldy * View.pos[2];
      View.translate(-sX, -sY);
      ctxP.translate(sX, sY);
      this.draw();
    },

    zoom : function(dz) {
      var offX = (View.pos[0] - (canP.width / - 2)) * View.pos[2];
          offY = (View.pos[1] - (canP.height / -2)) * View.pos[2];
      ctxP.translate(offX, offY);
      ctxP.scale(dz, dz);
      ctxP.translate(-offX, -offY);
      
      View.translate(-offX, -offY);
      View.scale(1 / dz, 1 / dz);
      View.translate(offX, offY);

      this.draw();
    },

    targetZoom: function(target) {
      var tar = Math.pow(target - View.pos[2], 3);
      this.zoom(1 - tar);
    },

    //Checks all the points of the last drawn line to see if the image boundaries have been expanded
    checkEdge : function(pt) {
      var i = this.log.length - 1;
      while (typeof this.log[i].x !== 'undefined') {
        if (this.log[i].y > this.edge[0]) {
          this.edge[0] = this.log[i].y;
        } else if (this.log[i].y < this.edge[2]) {
          this.edge[2] = this.log[i].y;
        }
        if (this.log[i].x > this.edge[1]) {
          this.edge[1] = this.log[i].x;
        } else if (this.log[i].x < this.edge[3]) {
          this.edge[3] = this.log[i].x;
        }
        i -= 1;
      }
    }
  }

  //Scroll bar click listeners
  $('#scrollLeft' ).mousedown(function() { Canvas.scrolldx = -Canvas.scrollSp; }).
                      mouseup(function() { Canvas.scrolldx = 0; });
  $('#scrollRight').mousedown(function() { Canvas.scrolldx =  Canvas.scrollSp; }).
                      mouseup(function() { Canvas.scrolldx = 0; });
  $('#scrollUp'   ).mousedown(function() { Canvas.scrolldy = -Canvas.scrollSp; }).
                      mouseup(function() { Canvas.scrolldy = 0; });
  $('#scrollDown' ).mousedown(function() { Canvas.scrolldy =  Canvas.scrollSp; }).
                      mouseup(function() { Canvas.scrolldy = 0; });


//////// TRACK CANVAS @TRANSFORMS \\\\\\\\

 View = {
    //x, y translation and scale
    pos : [0, 0, 1],

    baseZ : 1,

    getDim : function() {
      var origin = this.canToCtx(0, 0);
      var corner = this.canToCtx(canP.width, canP.height);

      return {width : corner.x - origin.x, height : corner.y - origin.y}
    },

    translate : function(xIn, yIn) {
      this.pos[0] += xIn / this.pos[2];
      this.pos[1] += yIn / this.pos[2];
    },

    scale : function(sIn) {
      this.pos[2] *= sIn;
    },

    canToCtx : function(px, py) {
      var x = px;
      var y = py;
      px = (x + this.pos[0]) * this.pos[2];
      py = (y + this.pos[1]) * this.pos[2];
      return {x : px, y : py};
    },

    scrToCtx : function(px, py) {
      var rect = canP.getBoundingClientRect();
      px -= rect.left;
      py -= rect.top;
      return this.canToCtx(px, py);
    }
  }

  //Position view at center of canvas
  ctxP.translate(canP.width / 2, canP.height / 2);
  View.translate(canP.width / -2, canP.height / -2);


//////// PAINTING @BRUSH \\\\\\\\

  //Stores brush state
  Brush =  {
    drawing : false,
    colour: ctxP.strokeStyle,
    size: ctxP.lineWidth,
  }

  //Mouse Events for Brush on Canvas
  canP.onmousedown = function(e) {
    //Overwrite history if nessisary
    if (Canvas.hisPos < Canvas.log.length - 1) {
      Canvas.log.length = Canvas.hisPos + 1;
    }

    //Store colour and size of each line before logging
    Canvas.log.push({colour : Brush.colour, size : parseInt(Brush.size)});
    Brush.drawing = true;
    Canvas.log.push(View.scrToCtx(e.clientX, e.clientY));
    Canvas.log.push(View.scrToCtx(e.clientX, e.clientY + 1));
    Canvas.hisPos += 3;

    //Prevents toolbox interupting line drawing
    $('#toolbox').css('pointerEvents', 'none');
  }
  canP.onmouseup = function(e) {
    Brush.drawing  = false;
    Canvas.checkEdge();
    Canvas.draw();

    //Allows toolbox interation and visible cursor again
    $('#toolbox').css('pointerEvents', 'auto');
    canP.style.cursor = 'default';
  }
  canP.onmousemove = function(e) {
    if (Brush.drawing) {
      var rect = canP.getBoundingClientRect();
      Canvas.log.push(View.scrToCtx(e.clientX, e.clientY));
      Canvas.hisPos += 1;
    }
  }



//////// WINDOW @EVENT LISTENERS \\\\\\\\

  //Keyboard Listeners
  window.onkeyup = function(e) {
    var key = e.keyCode ? e.keyCode : e.which;

    switch (key) {
      case 32: // space
        Gaze.paused = !Gaze.auto;
        Gaze.endCalibrate();
        break;
      case 90: // Z
        Canvas.undo();
        break;
      case 220: // \
        Canvas.redo();
        break;
      case 66: // B
        Toolbox.toggle();
        break;
      case 46: // del
        Gaze.clearData();
        break;
      case 78: // N
        Canvas.reset();
        break;
      case 83: // S
        Menu.save();
        break;
      case 76: // L
        Menu.openModal('upload');
        break;
      case 66: // B
        Toolbox.toggle();
        break;
      case 37: // left
        Canvas.scrolldx = 0;
        break;
      case 39: // right
        Canvas.scrolldx = 0;
        break;
      case 38: // up
        Canvas.scrolldy = 0;
        break;
      case 40: // down
        Canvas.scrolldy = 0;
        break;
      case 87: // W
        Canvas.zoom(0.8);
        View.baseZ *= 0.8;
        break;
      case 86: // V
        (showVid === '0') ? showVid = '1' : showVid = '0';
        xLabs.setConfig('frame.stream.preview', showVid);
        $('#xLabsPreview').toggle();
        break;
      case 81: // Q
        Canvas.zoom(1.25);
        View.baseZ *= 1.25;
        break;
      case 219: // [
        Brush.size = (Brush.size - 10 < 1) ? 1 : Brush.size + 10;
        break;
      case 221: // ]
        Brush.size += 10;
      break;
      case 69: // E
        Menu.gazeToggle();
        break;
      case 82: // R
        Gaze.calibrate();
        break;
      case 84: // T
        Menu.autoToggle();
        break;
      case 72: // H
        Menu.openModal('hotkeys');
        break;
      case 88: // X
        Menu.closeModal();
        break;
      case 48: // 0
        Brush.colour = '#000000';
        break;
      case 49: // 1
        Brush.colour = '#FFFFFF';
        break;
      case 50: // 2
        Brush.colour = '#FF6600';
        break;
      case 51: // 3
        Brush.colour = '#FFFF00';
        break;
      case 52: // 4
        Brush.colour = '#FF0000';
        break;
      case 53: // 5
        Brush.colour = '#FF0066';
        break;
      case 54: // 6
        Brush.colour = '#660033';
        break;
      case 55: // 7
        Brush.colour = '#3366FF';
        break;
      case 56: // 8
        Brush.colour = '#00CC00';
        break;
      case 57: // 9
        Brush.colour = '#993300';
        break;
    }
  }
  window.onkeydown = function(e) {
    var key = e.keyCode ? e.keyCode : e.which;
    // space - paused / activate eye pan
    if (key === 32)
        Gaze.paused = Gaze.auto;
    // 'ARROW' Keys - Pan
    if (key === 37) {
      Canvas.scrolldx = -Canvas.scrollSp;
    } else if (key === 39) {
      Canvas.scrolldx = Canvas.scrollSp;
    }
    if (key === 38) {
      Canvas.scrolldy = -Canvas.scrollSp;
    } else if (key === 40) {
      Canvas.scrolldy = Canvas.scrollSp;
    }
  }

  //Window resize listener
  window.onresize = function(e) {
    //Reinitiate canvas element with new window size
    can.width = window.innerWidth;
    can.height = window.innerHeight;
    ctx = can.getContext('2d');
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';

    canP.width = canP.clientWidth;
    canP.height = canP.clientHeight;
    ctxP = canP.getContext('2d');
      ctxP.lineWidth = 8;
      ctxP.strokeStyle = '#36F';
      ctxP.lineCap = 'round';

    //Redraw canvas image on resized canvas
    Canvas.draw();

    //Reposition toolbox within window
    if ((Toolbox.x + 150) > window.innerWidth) {
      Toolbox.move(window.innerWidth - (Toolbox.x + 150), 0)
    }
    if ((Toolbox.y - 100) > window.innerHeight) {
      Toolbox.move(0, window.innerHeight - (Toolbox.y - 100))
    }
  }
  

//////// @MENUS \\\\\\\\

  //Controls interation with toolbar menus and inital home screen menu
  Menu = {
    //Controls button on the starting home screen
    selectHomeBtn : function(button) {
      $('#homeScreen').fadeOut();
      $('#appScreen').css({
          pointerEvents : 'auto'
        });
      $('#appTitleImg').fadeTo("slow", 0.8);

      if (button === 'load') {
        this.openModal('upload');
      } else if (button === 'about') {
        this.openModal('about');
      } else if (button === 'new'){
        Gaze.calibrate();
      }
    },

    //States: 0 = file menu, 1 = gaze menu, 2 = about menu
    state : 0,

    fill : function(button) {
      this.state = button;
      switch(button) {
        case 0:
          $('#menuDropDown :nth-child(1)').html('<i class="fa fa-file"></i> New');
          $('#menuDropDown :nth-child(3)').html('<i class="fa fa-upload"></i> Load Image');
          $('#menuDropDown :nth-child(5)').html('<i class="fa fa-download"></i> SaveFile');
          break;
        case 1:
          if (Gaze.active) {
            $('#menuDropDown :nth-child(1)').html('<i class="fa fa-eye"></i> EyePan <b> ON </b>');
          } else {
            $('#menuDropDown :nth-child(1)').html('<i class="fa fa-eye-slash"></i> EyePan <b> OFF </b>');
          }
          if (Gaze.auto) {
            $('#menuDropDown :nth-child(3)').html('<i class="fa fa-play-circle"></i> Auto Pan');
          } else {
            $('#menuDropDown :nth-child(3)').html('<i class="fa fa-pause-circle"></i> Space to Pan');
          }
          $('#menuDropDown :nth-child(5)').html('<i class="fa fa-refresh"></i> Re-Calibrate');
          break;
        case 2:
          $('#menuDropDown :nth-child(1)').html('<i class="fa fa-question-circle"></i> Help ');
          $('#menuDropDown :nth-child(3)').html('<i class="fa fa-keyboard-o"></i> Hotkeys');
          $('#menuDropDown :nth-child(5)').html('<i class="fa fa-info-circle"></i> About EyePan');
          break;
      }
    },

    //Open/close dropdown menu
    toggle : function() {
      if ($('#menuDropDown').css('display') === 'none') {
        Gaze.paused = true;
        $('#menu').css({zIndex : '100'});
      } else {
        Gaze.paused = !Gaze.auto;
        $('#menu').css({zIndex : '0'});
      }
      $('#menuDropDown').slideToggle();
    },
    close : function() {
      Gaze.paused = !Gaze.auto;
      $('#menu').css({zIndex : '0'});
      $('#menuDropDown').slideUp();
    },

    //Calls function on menu item press
    select : function(item) {
      item += Menu.state * 10;
      switch(item) {
        case 0:
          Canvas.reset();
          break;
        case 1:
          this.openModal('upload');
          break;
        case 2:
          this.save();
          break;
        case 10:
          this.gazeToggle();
          break;
        case 11:
          this.autoToggle();
          break;
        case 12:
          Gaze.calibrate();
          break;
        case 20:
          this.openModal('help');
          break;
        case 21:
          this.openModal('hotkeys');
          break;
        case 22:
          this.openModal('about');
          break;
      }
    },

    //Downloads iamge on canvas
    save : function() {
      var dataURL = canP.toDataURL('image/png');
      window.location.href = dataURL;
    },

    //Turns on/off gaze panning and edits appropriate text in toolbar
    gazeToggle : function() {
      if (Gaze.active) {
        $('#menuDropDown :nth-child(1)').first().html('<i class="fa fa-eye-slash"></i> EyePan <b> OFF </b>');
        $('#status').html('Eye-pan is turned <b> OFF </b>');
      } else {
        $('#menuDropDown :nth-child(1)').first().html('<i class="fa fa-eye"></i> EyePan <b> ON </b>');
        if (!Gaze.auto) {
          $('#status').html('Hold <b> SPACE </b> to eye-pan');
        } else {
          $('#status').html('Hold <b> SPACE </b> to pause eye-pan');
        }
      }
      Gaze.active = !Gaze.active;
    },

    //Toggles automatic/space bar activated gaze panning and edits appropriate text in toolbar
    autoToggle : function() {
      if (Gaze.auto) {
        $('#menuDropDown :nth-child(3)').html('<i class="fa fa-pause-circle"></i> Space to Pan');
        $('#status').html('Hold <b> SPACE </b> to eye-pan');
      } else {
        Gaze.paused = false;
        $('#menuDropDown :nth-child(3)').html('<i class="fa fa-play-circle"></i> Auto Pan');
        $('#status').html('Hold <b> SPACE </b> to pause eye-pan');
      }
      Gaze.auto = !Gaze.auto;
    },

    openModal : function(mod) {
      this.close();
      Gaze.paused = true;
      $('#modal-back').fadeIn().click(Menu.closeModal);
      $('#' + mod + 'Modal').fadeIn();
    },

    closeModal : function() {
      Gaze.paused = !Gaze.auto;
      $('#modal-back').fadeOut();
      $('#helpModal, #aboutModal, #hotkeysModal, #uploadModal').fadeOut();
    }
  }

  //Handle image upload
  $('#startUploadBtn').hide();
  var handleUpload = function(evt) {
    $('#startUploadBtn').show();

    var image = evt.target.files[0];
    if (image.type.match('image.*')) {
      var reader = new FileReader();

      // Closure to capture the file information.
      reader.onload = (function(theFile) {
        return function(e) {
          var loadedImg = new Image;
          loadedImg.src = e.target.result;

          Canvas.image.file = loadedImg;
          Canvas.image.x = -loadedImg.width / 2;
          Canvas.image.y = -loadedImg.height / 2;
        };
      })(image);

      // Read in the image file as a data URL.
      reader.readAsDataURL(image);
    }
  }

  //Reset canvas with image in center;
  $('#startUploadBtn').click(function() {
    Canvas.reset();
    Canvas.image.loaded = true;
    Canvas.draw();
    Menu.closeModal();
  });

  document.getElementById('files').addEventListener('change', handleUpload, false);

  //////// @TOOLBOX \\\\\\\\

  Toolbox = {
    box : $('#toolbox'),
    menuBtn : $('#toolboxMin'),
    x : $('#toolbox').offset().left,
    y : $('#toolbox').offset().top,
    drag : false,
    open: true,

    //Move toolbox during drag & drop
    move : function(dx, dy) {
      this.x += dx;
      this.y += dy;
      this.box.css('left', this.x + 'px');
      this.box.css('top', this.y + 'px');
    },

    //Animate the fading out/in of toolbox and toolbox menu item
    toggle : function() {
      if (this.open) {
        this.box.fadeOut("fast");
        removeHoverFade(this.box);
        Toolbox.menuBtn.animate({ top: '0px', fontSize: '16px' }, { duration: 400, queue: false }).
                        toggle("scale");
        addHoverFade(this.menuBtn);
      } else {
        this.box.fadeTo("fast", 0.6);
        addHoverFade(this.box);
        Toolbox.menuBtn.css({opacity: '0.6'});
        Toolbox.menuBtn.animate({ top: '25px', fontSize: '0px' }, { duration: 400, queue: false }).
                        toggle("scale");
        removeHoverFade(this.menuBtn);
      }
      this.open = !this.open;
    }
  }

  //Controls movement of toolbox on drag & drop of top bar
  $('#dragbar').mousedown(function(e) {
    Toolbox.drag = true;
    window.addEventListener('mousemove', toolboxDrag);
    window.addEventListener('mouseup', toolboxDrop);
  });
  var toolboxDrag = function(e) {
     if (Toolbox.drag && e.clientX > 10 && e.clientY > 10 &&
          e.clientX < window.innerWidth && e.clientY < window.innerHeight) {
        Toolbox.move(e.clientX - Toolbox.x - 115, e.clientY - Toolbox.y + 215)
      }
  }
  var toolboxDrop = function(e) {
    Toolbox.drag = false;
    window.removeEventListener('mousemove', toolboxDrag);
    window.removeEventListener('mouseup', toolboxDrop);
  }



//////// @ANIMATIONS \\\\\\\\

  var addHoverFade = function(el) {
    //Convert elements to jQuery objects
    if (typeof(el) === 'string') {
      el = $(el);
    }

    el.on('mouseenter', function(e) {
      $(this).fadeTo("fast", 1);
    });
    el.on('mouseleave', function(e) {
      $(this).fadeTo("fast", 0.6);
    });
  }
  var removeHoverFade = function(el) {
    if (typeof(el) === 'string') {
      el = $(el);
    }

    $(el).off('mouseenter');
    $(el).off('mouseleave');
  }
  
  addHoverFade('#toolbox');
  addHoverFade('#menu div');
  removeHoverFade('#menuDropDown');



/////// @GAZE TRACKING OBJECT \\\\\\\\

  //Gaze panning options
  Gaze = {
    active: true,
    paused: true,
    auto: false,
    ptX: 0,
    ptY: 0,

    //Calibration drawing variables
    caliCtx: null,
    caliDraw: false,
    caliX: 0,
    caliY: 0,
    caliXs: [0, 0, 0, 0, 0, 0, 0, 0],
    caliCount: 0,

    //Inititate Calibration Canvas
    initCanCali : function() {
      var canCali =  $('#canCali')[0];
      canCali.width = window.innerWidth;
      canCali.height = window.innerHeight;
      this.caliCtx = canCali.getContext('2d');
      this.caliCtx.lineWidth = 10;
      this.caliCtx.strokeStyle = '#3366FF';
      this.caliCtx.lineCap = 'round';

      //Setup Xs to listen for being crossed twice
      var xs = $('.caliX');
      xs.each(function(index) {
        this.onmousemove = function(e) {
          if (Gaze.caliDraw) {
            if (Gaze.caliXs[index] === 0) {
              Gaze.caliXs[index] = 1;
            } else if (Gaze.caliXs[index] === 2) {
              Gaze.caliXs[index] = 3;
            }
          }
          //refire mouse event to continue drawing on canvas
          canCali.onmousemove(e);
        }
        //refire mouse event to continue drawing on canvas
        this.onmousedown = function(e) {
          canCali.onmousedown(e);
        }
        //refire mouse event to continue drawing on canvas
        this.onmouseup = function(e) {
          canCali.onmouseup(e);
        }
      });

      //Draw on canvas
      canCali.onmousedown = function(e) {
        Gaze.caliDraw = true;
        Gaze.caliX = e.clientX;
        Gaze.caliY = e.clientY;
      }
      canCali.onmouseup = function(e) {
        Gaze.caliDraw = false;
        //Change state of once-crossed Xs
        for (var i = 0; i < 8; i += 1) {
          if (Gaze.caliXs[i] === 1) {
            Gaze.caliXs[i] = 2;
          } else if (Gaze.caliXs[i] === 3) {
            xs[i].style.color = '#3366FF';
            Gaze.caliCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            Gaze.caliXs[i] = 4;
            Gaze.caliCount += 1;
          }
        }
        if (Gaze.caliCount === 8) {
          Gaze.endCalibrate();
        }
      }
      canCali.onmousemove = function(e) {
        if (Gaze.caliDraw) {
          Gaze.caliCtx.beginPath();
            Gaze.caliCtx.moveTo(Gaze.caliX, Gaze.caliY);
            Gaze.caliCtx.lineTo(e.clientX, e.clientY);
          Gaze.caliCtx.stroke();
          Gaze.caliX = e.clientX;
          Gaze.caliY = e.clientY;
        }
      }
    },
    
    //Scroll canvas when gaze enters edge regions
    absScroll : function() {
      if (this.active && !Brush.drawing) {
          this.calcPos(); 
          var h = window.innerHeight / 5,
              w = window.innerWidth / 10;

          if (this.ptX < w) {
            Canvas.scrolldx = -15;
          } else if (this.ptX > window.innerWidth - w) {
            Canvas.scrolldx = 15;
          } else {
            Canvas.scrolldx = 0;
          }

          if (this.ptY < h) {
            Canvas.scrolldy = -15;
          } else if (this.ptY > window.innerHeight - h) {
            Canvas.scrolldy = 15;
          } else {
            Canvas.scrolldy = 0;
          }
        }
    },

    //Continuously scroll canvas according to eased gaze tracking data
    gradScroll : function() {
      if (this.active && !Brush.drawing && !this.paused) {
        this.calcPos();

        var dx = ((window.innerWidth / 2) - this.ptX);
        var dy = ((window.innerHeight / 2) - this.ptY);

        var z = Math.min(Math.sqrt((dx*dx) + (dy*dy)), canP.width / 2) / (canP.width / 2);
        z *= (View.baseZ * 0.8);
        z += View.baseZ;

        Canvas.targetZoom(z);

        dx *= 0.05;
        dy *= 0.05;

        Canvas.scrolldx = dx;
        Canvas.scrolldy = dy;
      } else {
        Canvas.scrolldx = 0;
        Canvas.scrolldy = 0;
      }
    },

    //Calcualtes gaze point's position on screen and eased point from gaze data
    calcPos : function() {
      this.ptX = parseFloat(xLabs.getConfig( "state.gaze.estimate.x")); //screen coords
      this.ptY = parseFloat(xLabs.getConfig( "state.gaze.estimate.y"));

      this.ptX = xLabs.scr2docX(this.ptX);
      this.ptY = xLabs.scr2docY(this.ptY);
    },

    //Draws eased gaze point to canvas
    drawPoint : function() {
      this.calcPos();
      ctx.beginPath();
        ctx.arc(this.ptX, this.ptY, 35, 0, 2 * Math.PI);
      ctx.fill();
    },

    //Calibrates gaze tracking
    calibrate : function() {
      $('#menu').css({zIndex : '0'});
      Menu.closeModal();

      //Clear previous gaze data and enter calibration mode
      this.clearData();

      $('#calibrate').fadeIn();
      $('#caliMessage').fadeIn("slow").delay(2500).fadeOut("slow");
      $('.caliX').delay(3300).fadeIn("slow");
    },

    endCalibrate : function() {
      //Reset values
      this.caliCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.caliXs = [0, 0, 0, 0, 0, 0, 0, 0];
      this.caliCount = 0;

      //Fade out
      $('#calibrate').delay(400).fadeOut("slow");
      $('.caliX').delay(400).fadeOut("slow");
      setTimeout(function() {
        $('.caliX').css({color: 'rgba(255, 255, 255, 0.3)'});
      }, 800);
    },

    //clears current tracking data
    clearData : function() {
      xLabs.setConfig("calibration.clear", true);
    }
  };

  Gaze.initCanCali();


//////// MAIN APPLICATION @LOOP \\\\\\\\\

  var time = 0, oldTime = new Date().getTime();

  function mainLoop() {
    //Limit FPS for efficientcy
    time = new Date().getTime();
    if (time - oldTime > 40) {
      oldTime = time;

      //Redraws tracking point to tracking canvas
      ctx.clearRect(0, 0, can.width, can.height);

      Canvas.checkScroll();
      Gaze.gradScroll();
      //Gaze.drawPoint();

      if (Brush.drawing) {
        Canvas.draw();
      }
    }
  }



  //////// GAZE TRACKING @API \\\\\\\\

  //Configure gaze tracking API state
  function onTrackReady() {
    xLabs.setConfig("system.mode", "learning");
    xLabs.setConfig("browser.canvas.paintLearning", "0");
  }

  //Start applciaiton loop once API has loaded
  function onTrackUpdate() {
    mainLoop();
  }

  //Turn off gaze tracking on application exit
  window.addEventListener("beforeunload", function() {
    xLabs.setConfig("system.mode", "off");
  });


  //Inititae gaze tracking API
  xLabs.setup(onTrackReady, onTrackUpdate, null, "tgo09iy0thgjsd3");


})(jQuery);