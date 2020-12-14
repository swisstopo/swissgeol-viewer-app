const http = require('http');
const axios = require('axios');
const resHeaders = {
  'Content-Type': 'application/json;charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, bdms-authorization, origin, content-type, accept, Referer'
};
const requestListener = function (req, res) {
  const headers = req.headers;
  headers.Host = 'swisstopo.supsi.ch';
  headers.Referer = `https://swisstopo.supsi.ch/bdms${req.url}`;

  if (req.method === 'POST') {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      axios
        .post(`https://swisstopo.supsi.ch/bdms${req.url}`, data, {
          headers: req.headers
        })
        .then(res2 => {
          res.writeHead(200, resHeaders);
          res.write(JSON.stringify(res2.data));
          res.end();
        })
        .catch(error => {
          res.writeHead(500, resHeaders);
          res.end(JSON.stringify(error));
        });
    });
  } else {
    res.writeHead(200, resHeaders);
    res.end();
  }
};

const server = http.createServer(requestListener);
server.listen(9000);
console.log('Port: 9000');
