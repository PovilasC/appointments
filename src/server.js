import http from 'http'
import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import config from './config.js';
import moment from 'moment';
import logging from './logging.js';
import Appointment from './models/appointments.js';
import fs from 'fs';

const settings = JSON.parse(fs.readFileSync("settings.json", "UTF-8"));
const adminAccountExits = fs.existsSync("admin.json");


if(!adminAccountExits){
  throw Error('no admin account')
}
const NAMESPACE = 'Server'
const app = express();

app.use((req, res, next) => {
  logging.info(NAMESPACE, `METHOD - [${req.method}], URL - [${req.url}], IP - [${req.socket.remoteAddress}]`);
  // logging the request
  res.on('finish', () => {
    logging.info(NAMESPACE, `METHOD - [${req.method}], URL - [${req.url}], IP - [${req.socket.remoteAddress}], STATUS - [${res.statusCode}]`);
  });
  next();
})


app.set("views", "./views");
app.set("view engine", "ejs")
app.use(express.urlencoded({ extended: false }));
app.use(express.json())
app.use(express.static("./public"));

app.use(session({
  secret: settings.session_secret || String(Math.floor(Math.random() * 999999) + 9999),
  resave: false,
  saveUninitialized: false
}));

app.use((req, res, next) => {
  if (req.session.isLoggedIn === undefined) {
    req.session.isLoggedIn = false;
  }
  next();
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method == 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET PATCH DELETE POST PUT');
    return res.status(200).json({});
  }
  next();
});

mongoose
  .connect(config.mongo.url, config.mongo.options)
  .then(() => {
    logging.info(NAMESPACE, 'Connected to mongoDB');
  })
  .catch((error) => {
    logging.error(NAMESPACE, error.message, error);
  });


app.get("/date/:week/:year", (req, res) => {
  Appointment.find()
  .exec()
  .then((data) => {
    let now = moment();
    let realNow = moment();

    if (!isNaN(req.params.year) && req.params.year >= realNow.year() && req.params.year <= realNow.year() + settings.yearsToFuture) {
      now.year(req.params.year);
    }
    else { 
      res.redirect("/");
      return true;
    }

    if (!isNaN(req.params.week) && req.params.week >= 1 && req.params.week <= 52) {
      now.week(req.params.week);
    }
    else { 
      res.redirect("/");
      return true;
    }

    let dateInfo = {
      currentDay: (Number(req.params.week) === realNow.week() && Number(req.params.year) == realNow.year()) ? now.weekday() : null,
      weekNumber: now.week(),
      year: Number(req.params.year),
      nextYear: Number(req.params.year),
      prevYear: Number(req.params.year),
      nextWeek: null,
      prevWeek: null,
      dates: [
        now.locale(settings.moment_language || "en").weekday(0).format("l"),
        now.weekday(1).format("l"),
        now.weekday(2).format("l"),
        now.weekday(3).format("l"),
        now.weekday(4).format("l"),
        now.weekday(5).format("l"),
        now.weekday(6).format("l")
      ]
    };

    // Changing year
    if (dateInfo.weekNumber >= 52) {
      dateInfo.nextWeek = 1;
      dateInfo.nextYear = dateInfo.year + 1;
    }
    else {
      dateInfo.nextWeek = dateInfo.weekNumber + 1;
    }
    if (realNow.weekday(3).diff(now.locale("fi").weekday(3).week(now.week() - 1), "weeks") <= 0) {
      if (dateInfo.weekNumber <= 1) {
        dateInfo.prevWeek = 52;
        dateInfo.prevYear = dateInfo.year - 1;
      }
      else {
        dateInfo.prevWeek = dateInfo.weekNumber - 1;
      }
    }

    res.status(200).render("index", {
      dateInfo: dateInfo,
      companyName: settings.company_name || "Doctor",
      reservations: data,
      error: null,
    });
  }).catch((error) => {
    console.error(error);
    res.status(500).render("index", {
      dateInfo: null,
      companyName: settings.company_name || "Doctor",
      reservations: null,
      error: "Error while retrieving data. Please try again later."
    });
  });
});

app.get('/', (req, res, next) => {
  Appointment.find()
    .exec()
    .then((reservations) => {
      let now = moment();
      let dateInfo = {
        currentDay: now.weekday(), // 0-6
        weekNumber: now.week(), // 1-52
        nextYear: now.year(),
        prevYear: null,
        year: now.year(),
        nextWeek: null,
        prevWeek: null,
        dates: [
          now.locale("en").weekday(0).format("l"),
          now.weekday(1).format("l"),
          now.weekday(2).format("l"),
          now.weekday(3).format("l"),
          now.weekday(4).format("l"),
          now.weekday(5).format("l"),
          now.weekday(6).format("l")
        ]
      };

      // Changing year
      if (dateInfo.weekNumber >= 52) {
        dateInfo.nextWeek = 1;
        dateInfo.nextYear = dateInfo.year + 1;
      }
      else {
        dateInfo.nextWeek = dateInfo.weekNumber + 1;
      }

      res.status(200).render("index", {
        dateInfo: dateInfo,
        companyName: "Doctor",
        reservations: reservations,
        error: null
      });
    })
});


app.post("/newReservation", (req, res, next) => {
  let weHaveError = false;
  let { name, email, message, weekNumber, year, cellId } = req.body;

  //input checking
  if (req.body.name && req.body.weekNumber && req.body.year && req.body.cellId) {
    if (req.body.name.length < 60 && req.body.weekNumber >= 1 && req.body.weekNumber <= 52 && req.body.year >= moment().year() && req.body.year <= moment().year() + settings.yearsToFuture && req.body.cellId >= 0 && req.body.cellId <= 62) {
      if ((!req.body.email || req.body.email.length <= 50) && (!req.body.extraInfo || req.body.extraInfo.length <= 500)) {

          const appointment = new Appointment({
            _id: new mongoose.Types.ObjectId(),
            name,
            email,
            message,
            time: {weekNumber, year, cellId}
          });

          appointment
            .save(appointment)
            .then(() => {
              res.redirect(`/date/${req.body.weekNumber}/${req.body.year}`)})
            .catch((error) => {
              res.json({
                message: error.message,
                error
              });
            });

      }
      else {
        weHaveError = true;
      }
    }
    else {
      weHaveError = true;
    }
  }
  else {
    weHaveError = true;
  }

  if (weHaveError) {
    res.status(400).render("index", {
      dateInfo: null,
      reservations: null,
      companyName:  "Doctor",
      error: "Error while saving your reservation. Please try again later."
    });
  }
});

app.get("/admin", (req, res) => {
  if (req.session.isLoggedIn === true) {
    Appointment.find()
    .exec()
    .then((reservations) => 
    {
      let now = moment();
      let dateInfo = {
        currentDay: now.weekday(),
        weekNumber: now.week(),
        year: now.year(),
        dates: [
          now.weekday(0).format("l"),
          now.weekday(1).format("l"),
          now.weekday(2).format("l"),
          now.weekday(3).format("l"),
          now.weekday(4).format("l"),
          now.weekday(5).format("l"),
          now.weekday(6).format("l")
        ]
      };

      res.status(200).render("admin", {
        dateInfo: dateInfo,
        companyName: settings.company_name || "Doctor",
        reservations: reservations,
      });
    }).catch((error) => {
      console.error(error);
      res.status(500).render("index", {
        dateInfo: null,
        companyName: settings.company_name || "Doctor",
        reservations: null,
        error: "Error while retrieving data. Please try again later."
      });
    });
  }
  else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  req.session.isLoggedIn = true;
  res.redirect("/admin");
});

app.get("/logout", (req, res) => {
  req.session.isLoggedIn = false;
  res.redirect("/");
});

app.listen(config.server.port, () =>  `Server running on ${config.server.hostname}: ${config.server.port}`);