const express = require('express');
const fs = require('fs');
const ejs = require('ejs');
const mariadb = require('mariadb');
const app = express();
const port = process.env.PORT || 8080;
const dbuser = process.env.DBUSER;
const dbpass = process.env.DBPASS;
const dbhost = process.env.DBHOST;
const envkey = process.env.APIKEY;

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
                      external_temp: rows[0].tempExternal
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
        const {tempInternal, tempExternal} = req.body;
        pool.getConnection()
            .then(conn => {
                conn.query(`INSERT INTO \`data\` (\`id\`, \`tempInternal\`, \`tempExternal\`) VALUES (NULL, ${tempInternal}, ${tempExternal});`);    
            }).catch(err => {
            //not connected
            });
        res.status(200).send({"message": "data logged"});
    } else {
        res.status(401).send({"message": "invalid api key"});
    }
});

app.listen(port, () => {
  console.log(`Weather Station API listening at http://:${port}`);
});