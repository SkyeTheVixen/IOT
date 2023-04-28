const express = require('express');
const { Server } = require("socket.io");
const fs = require('fs');
const ejs = require('ejs');
const mariadb = require('mariadb');
const app = express();
const http = require('http');
require('dotenv').config();
const port = process.env.PORT || 8080;
const dbuser = process.env.DBUSER;
const dbpass = process.env.DBPASS;
const dbhost = process.env.DBHOST;
const envkey = process.env.APIKEY;
var connectedUsers = 0;
const server = http.createServer(app);

const io = new Server(server);

const pool = mariadb.createPool({
    host: dbhost,
    user: dbuser,
    password: dbpass,
    database: dbuser
});



app.use(express.json());

app.get('/', (req, res) => {
    pool.getConnection()
        .then(conn => {
            conn.query(`SELECT * FROM \`data\` ORDER BY \`timestamp\` DESC LIMIT 1;`).then((rows) => {
                fs.readFile(__dirname + '/view.html', 'utf8', (err, file) => {
                    if (err) throw err;
                    // Render the file with the data
                    const html = ejs.render(file, {
                      internal_temp: rows[0].tempInternal,
                      external_temp: rows[0].tempExternal,
                      weather_temp: rows[0].tempWeather
                    });
                    res.send(html);
                });
            });
        }).catch(err => {
            //not connected
        });
});

app.post('/v1/data/log', (req, res) => {
    const {apikey} = req.headers;
    if(apikey === envkey){
        const {tempInternal, tempExternal, tempWeather} = req.body;
        pool.getConnection()
            .then(conn => {
                conn.query(`INSERT INTO \`data\` (\`id\`, \`tempInternal\`, \`tempExternal\`, \`tempWeather\`) VALUES (NULL, ${tempInternal}, ${tempExternal}, ${tempWeather});`).then(() => {
                    io.sockets.emit("data", {tempInternal: tempInternal, tempExternal: tempExternal, tempWeather: tempWeather});
                }).catch(err => {
                    res.status(401).send({"message":"conn lost"});
                });
            }).catch(err => {
            res.status(401).send({"message":"conn lost"});
            });
        res.status(200).send({"message": "data logged"});
    } else {
        res.status(401).send({"message": "invalid api key"});
    }
});

server.listen(port, () => {
  console.log(`Weather Station API listening at http://*:${port}`);
});

io.on('connection', (socket) => {
    connectedUsers++;
    console.log('a user connected');
    socket.on('mode', (data) => {
        sendButtonEvent(data);
    });
    socket.on('windows', (data) => {
        console.log(data);
    });
});

io.on('disconnect', (socket) => {
    connectedUsers--;
    console.log('a user disconnected');
});



async function sendButtonEvent(mode){
    var rp = require('request-promise');

    var options = {
        method: 'POST',
        url: 'https://api2.arduino.cc/iot/v1/clients/token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        json: true,
        form: {
            grant_type: 'client_credentials',
            client_id: 'wwy9uQz16szBdzdkCUHZ2KERHTUlg5pE',
            client_secret: '2F2fpRXorIuyxWUqMeubZcguOSycLy7PQuk1b3w3ZN7q1s2lPmhrIsWAWJgBhYNh',
            audience: 'https://api2.arduino.cc/iot'
        }
    };
    var access = "";
    try {
        const response = await rp(options);
        access = response['access_token'];
    }
    catch (error) {
        console.error("Failed getting an access token: " + error)
    }

    var ArduinoIotClient = require('@arduino/arduino-iot-client');
    var defaultClient = ArduinoIotClient.ApiClient.instance;
    
    // Configure OAuth2 access token for authorization: oauth2
    var oauth2 = defaultClient.authentications['oauth2'];
    oauth2.accessToken = access;
    
    var api = new ArduinoIotClient.PropertiesV2Api()
    var id = "f43bbd2d-14a4-4b66-8cb4-ad8140c7c4eb"; // {String} The id of the thing
    var pid = "b0851198-c8ad-469d-bef5-fddc1768e516"; // {String} The id of the property
    mode == "heating" ? mode = 1 : (mode == "cooling" ? mode = 0 : mode = 2);
    mode = parseInt(mode);
    var propertyValue = {device_id: "2e0322e3-3b48-4905-8872-079d59aad442", value: mode}; // {PropertyValue} 
    api.propertiesV2Publish(id, pid, propertyValue).then(function() {
      console.log('API called successfully.');
    }, function(error) {
      console.error(error);
    });
}