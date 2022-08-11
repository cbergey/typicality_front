
// to start at beginning
var experiment;
window.onload = function(event) {
  experiment = new Experiment();
  showSlide("consent");
};

// disables all scrolling functionality to fix a slide in place on the ipad
document.ontouchmove = function(event){
    event.preventDefault();
};

// ---------------- PARAMETERS ------------------

//amount of white space between trials
const normalpause = 1500;

//pause after picture chosen
const timeafterClick = 1000;

// ---------------- HELPER ------------------

// show slide function
function showSlide(id) {
  $(".slide").hide(); //jquery - all elements with class of slide - hide
  $("#"+id).show(); //jquery - element with given id - show
}

//array shuffle function
function shuffle (o) { //v1.0
  for (var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

function enable(id){
  if(form_ok()) {
    document.getElementById(id).disabled = '';
  }
}

//get radiobutton values for consent
const getCheckedRadioValue = (name) => {
  const radios = document.getElementsByName(name);
  try {
    // calling .value without a "checked" property with throw an exception.
    return Array.from(radios).find((r, i) => radios[i].checked).value
  } catch(e) { }
}

function form_ok() {
  return (getCheckedRadioValue('age') == "eighteen" &&
	  getCheckedRadioValue('understand') == "understood" &&
	  getCheckedRadioValue('give_consent') == "consent");
}

function disable(id){
  document.getElementById(id).disabled = 'disabled';
}


function getCurrentDate () {
  var currentDate = new Date();
  var day = currentDate.getDate();
  var month = currentDate.getMonth() + 1;
  var year = currentDate.getFullYear();
  return (month + "/" + day + "/" + year);
}

function getCurrentTime () {
  var currentTime = new Date();
  var hours = currentTime.getHours();
  var minutes = currentTime.getMinutes();
  var seconds = currentTime.getSeconds();

  if (minutes < 10) minutes = "0" + minutes;
  if(seconds < 10) seconds = "0" + seconds;
  return (hours + ":" + minutes + ":" + seconds);
}

// MAIN EXPERIMENT
class Experiment {
  constructor() {
    // initialize socket to talk to server
    this.subid = "";
    //inputed at beginning of experiment
    this.age = "";
    //inputed at beginning of experiment
    this.trialnum = 0;
    //whether child received list 1 or list 2
    this.target = "";
    //word that child is queried on
    this.leftpic = "";
    //the name of the picture on the left
    this.rightpic = "";
    //the name of the picture on the right
    this.person = "";
    //the identity of original speaker
    this.side = "";
    //whether the child picked the left (L) or the right (R) picture
    this.chosenpic = "";
    //the name of the picture the child picked
    this.response = "";
    //whether the response was the correct response (Y) or the incorrect response (N)
    this.date = getCurrentDate();
    //the date of the experiment
    this.timestamp = getCurrentTime();
    //the time that the trial was completed at 
    this.reactiontime = 0;
    this.data = [];

  }

  // Check subject id

  start() {
    // initialize connection to server
    this.socket = io.connect();
    
    // begin first trial as soon as we hear back from the server
    this.socket.on('onConnected', function(mongoData) {
      this.subid = mongoData['gameid'];
      this.itemid = mongoData['set_id'];
      this.trials = mongoData['trials'];
      this.trials.push({
        occurrence: 'check',
        person: 'check',
        subid: 'check',
        subject: 'check',
        target: 'A1',
        trial: 'check'
      });
      this.numTrials = this.trials.length;
      console.log('num trials', this.numTrials);
      this.age = 'mturk';
      this.stimuli = _.map(this.trials, (trial) => {
  return trial['article'] + " " + trial['adjective'] + " " + trial['noun'];
      });
      setTimeout(function() {
	this.study(0);
      }.bind(this));
    }.bind(this));
  };

  //the end of the experiment
  end () {
    console.log('if submitted, data on mturk would be');
    console.log(this.data);

    setTimeout(function () {
      turk.submit(this.data, true);
      $("#check").fadeOut();
      showSlide("finish");
    }.bind(this), normalpause);
  };

  //concatenates all experimental variables into a string which
  //represents one "row" of data in the eventual csv, to live in the
  //server
  processOneRow () {
    var jsonForRound = _.pick(this, [
      'subid', 'itemid', 'trialnum', 'adjective', 'noun', 'article', 'adj_article', 'rating',
      'date','timestamp','reactiontime', 'occurrence'
    ]);

    // send to server and save locally to submit to mturk
    console.log('data is')
    console.log(jsonForRound);
    this.socket.emit('currentData', jsonForRound);
    this.data.push(jsonForRound);
  };

  study(trialnum) {
    var currTrial = this.trials[trialnum];
    this.trialnum = trialnum;
    this.clickDisabled = true;
    this.article = currTrial['article'];
    this.adjective = currTrial['adj'];
    this.noun = currTrial['noun'];
    this.adj_article = currTrial['adjective_article'];
    
    $("#blank").click();
    $("#instructions").hide();
    $("#question").hide();
    $("#stimulus").hide();
    $("#stage").fadeIn();    
    if (this.article == null) {
      var utterance = "<p>How common is it for " + this.noun + " to be " + this.adjective + " " + this.noun + "?</p>";
    } else {
      var utterance = "<p>How common is it for " + this.article + " " + this.noun + " to be " + this.adj_article + " " + this.adjective + " " + this.noun + "?</p>";
    } 

    
    $('#question').html(utterance);
    $("#question").fadeIn(1000);
    $("#stimulus").fadeIn(1000);
  }

  playAudio(event) {
    // Play audio
    var audio = this.preloadedAudio[this.trialnum];
    console.log('here');
    console.log(audio);
    // after audio finishes, allow to click tangram and start clock
    audio.play(function(){
      this.clickDisabled = false;
      this.startTime = (new Date()).getTime();
    }.bind(this));
  }

  handleClick(rating) {
    // time the participant clicked picture - the time the audio finished
    this.reactiontime = (new Date()).getTime() - this.startTime;
    this.clickDisabled = true; 
    
    this.rating = rating;

    //Process the data to be saved
    this.processOneRow();

    setTimeout(function() { 
      document.getElementById("blank").click();
      setTimeout(function() {
        if (this.trialnum + 1 === this.numTrials) {
          this.end()
        } else {
          this.study(this.trialnum + 1);
        }
      }.bind(this), 200);
    }.bind(this), 200);
  }
}

