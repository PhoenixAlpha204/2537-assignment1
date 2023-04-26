require("./utils.js");
require('dotenv').config();
const express = require('express');
const app = express();
const session = require('express-session');
const port = process.env.PORT || 3000;
const bcrypt = require('bcrypt');
const saltRounds = 12;
const MongoStore = require('connect-mongo');
const expireTime = 60 * 60 * 1000; //expires after 1 hour (minutes * seconds * millis)
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const node_session_secret = process.env.NODE_SESSION_SECRET;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
var { database } = include('databaseConnection');
const userCollection = database.db(mongodb_database).collection('users');
var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/test`,
    crypto: {
        secret: mongodb_session_secret
    }
});
const Joi = require("joi");

app.use("/images", express.static("./public"));

app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    resave: false,
    saveUninitialized: false
}));

app.get('/', (req, res) => {
    if (req.session.authenticated) {
        var name = req.session.name;
        res.send(`Hello, ` + name + `<br><button type='button' onclick="window.location.href='/members'">Go to Members Area</button>
            <br><button type='button' onclick="window.location.href='/logout'">Logout</button>`);
    } else {
        res.send(`<button type='button' onclick="window.location.href='/signup'">Sign up</button>
        <br><button type='button' onclick="window.location.href='/login'">Log in</button>`);
    }
});

app.get('/signup', (req, res) => {
    var missing = req.query.missing;
    var html = `create user<br>
        <form action='/signupSubmit' method='post'>
        <input type='text' name='name' placeholder='name'><br>
        <input type='email' name='email' placeholder='email'><br>
        <input type='password' name='password' placeholder='password'><br>
        <button>submit</button>
        </form>`;
    if (missing == 1) {
        html += "name is required";
    } else if (missing == 2) {
        html += "email is required";
    } else if (missing == 3) {
        html += "password is required";
    }
    res.send(html);
});

app.post('/signupSubmit', async (req, res) => {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;
    if (!name) {
        res.redirect('/signup?missing=1');
    } else if (!email) {
        res.redirect('/signup?missing=2');
    } else if (!password) {
        res.redirect('/signup?missing=3');
    } else {
        const schema = Joi.object({
            name: Joi.string().alphanum().max(20).required(),
            email: Joi.string().email().max(30).required(),
            password: Joi.string().max(20).required()
        });
        const validationResult = schema.validate({ name, email, password });
        if (validationResult.error != null) {
            console.log(validationResult.error);
            res.redirect("/signup");
            return;
        }
        var hashedPassword = bcrypt.hashSync(password, saltRounds);
        await userCollection.insertOne({ name: name, email: email, password: hashedPassword });
        req.session.authenticated = true;
        req.session.name = name;
        req.session.cookie.maxAge = expireTime;
        res.redirect('/members');
    }
});

app.get('/login', (req, res) => {
    var missing = req.query.missing;
    var html = `log in<br>
    <form action='/loginSubmit' method='post'>
    <input type='email' name='email' placeholder='email'><br>
    <input type='password' name='password' placeholder='password'><br>
    <button>submit</button>
    </form>`;
    if (missing == 1) {
        html += "incorrect email or password";
    }
    res.send(html);
});

app.post('/loginSubmit', async (req, res) => {
    var email = req.body.email;
    var password = req.body.password;
    const schema = Joi.string().email().max(30).required();
    const validationResult = schema.validate(email);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login?missing=1");
        return;
    }
    const result = await userCollection.find({ email: email }).project({ name: 1, email: 1, password: 1, _id: 1 }).toArray();
    if (result.length != 1) {
        res.redirect("/login?missing=1");
        return;
    }
    if (await bcrypt.compare(password, result[0].password)) {
        req.session.authenticated = true;
        req.session.name = result[0].name;
        req.session.cookie.maxAge = expireTime;
        res.redirect('/members');
        return;
    }
    else {
        res.redirect("/login?missing=1");
        return;
    }
});

app.get('/members', (req, res) => {
    if (!req.session.authenticated) {
        res.redirect('/');
    }
    var randomNum = Math.floor(Math.random() * 3) + 1;
    var name = req.session.name;
    res.send(`Hello, ` + name + `<br><img src='/images/cat` + randomNum + `.jpg' style='width: 250px;'>
        <br><button type='button' onclick="window.location.href='/logout'">Logout</button>`);
});

app.get('/logout', (req,res) => {
	req.session.destroy();
    res.redirect('/');
});

app.get("*", (req, res) => {
    res.status(404).send("Page not found - 404");
});

app.listen(port, () => {
    console.log("Node application listening on port " + port);
}); 
