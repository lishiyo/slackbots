require('dotenv').load();
if (!process.env.SLACK_TOKEN) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');
var watson = require('watson-developer-cloud');
var personality_insights = watson.personality_insights({
  username: process.env.IBM_USERNAME,
  password: process.env.IBM_PASSWORD,
  version: "v2"
});

// controller spawns specific bot instances that represent a bot identity
// once spawned and connected, the bot can now listen to stuff
var controller = Botkit.slackbot({
    debug: true,
    logLevel: 6 // 0-7 for verbosity
});

// spawn an instance of the bot, connect it to the realtime API
var bot = controller.spawn({
    token: process.env.SLACK_TOKEN
}).startRTM();

controller.hears(['Hi Watson'], ['ambient, mention'], function(bot, message) {
  // save in controller storage
  controller.storage.users.get(message.user, function(err, user) {
    if (!user) {
      console.log("didn't find user! id now: " + message.user);
      user = {
          id: message.user
      };
    }

    var yesResponse = {
      pattern: bot.utterances.yes,
      callback: function(response, convo) {
        console.log("YES response");
        convo.say("Awesome. Personality Insights is an API that devides personalities into five different characteristics. You can try it out  by calling '@watson /analyze' in the channel.");
        convo.next();
      }
    };
    var noResponse = {
      pattern: bot.utterances.no,
      callback: function(response, convo) {
        console.log("NO response");
        convo.say("Alright, but you're missing out!");
        convo.next();
        convo.stop();
      }
    };
    var defaultResponse = {
      default: true,
      callback: function(response, convo) {
        console.log("default response");
        convo.say("Huh? ");
        convo.repeat();
        convo.next();
      }
    }
    bot.startConversation(message, function(err, convo) {
      // array of reply options
      convo.ask("Would you like to learn about personality_insights?", [
        yesResponse, noResponse, defaultResponse
      ]);
    })
  });
});

controller.hears(['hello world'], ['direct_message','direct_mention','mention','ambient'], function(bot, message) {
  // start a conversation to handle this response. 
  bot.startConversation(message,function(err,convo) {
    convo.say('Hello!');
    convo.say('Have a nice day!');
  });
});

//match[1] is the (.*) group. match[0] is the entire group (open the (.*) doors).
controller.hears(["analyze (.*)", "what's up"], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
  var topic = message.match[1];
  bot.reply(message, 'got it! analyzing ' + topic);
  // https://slack.com/api/channels.history
  bot.api.channels.history({
    channel: message.channel,
  },function(err, history) {
    //count: 500,
    if (err) {
      console.log('analyze ERROR', err);
    }

    var messages = [];
    for (var i = 0; i < history.messages.length; i++) {
      messages.push(history.messages[i].text);
    }

    // call the watson api with your text
    var fullText = messages.join("\n");

    personality_insights.profile(
      {
        text: fullText,
        language: 'en'
      },
      function (err, response) {
        if (err) {
          console.log('analyze error:', err, fullText);
        } else {
          bot.startConversation(message,function(task,convo) {
            // response.tree.children.children is a list of the top 5 traits
            var top5 = response.tree.children[0].children[0].children;
            console.log(top5);
            for (var c = 0; c <  top5.length; c++) {
                convo.say('This channel has ' + Math.round(top5[c].percentage*100) + '% ' + top5[c].name);
            }

            bot.reply(message,'You can learn more about Personality Insights using Node here: https://github.com/watson-developer-cloud/personality-insights-nodejs' );

            convo.stop();
          });
        }
      }
    );
  });
});
